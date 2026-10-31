import math
import re
from typing import Any

from django.db import connection
from django.db.models import Q
from pgvector.django import CosineDistance

from accounts.context import UserContext
from documents.models import Chunk
from documents.permissions import get_permitted_chunks_q
from ingestion.embedder import EmbeddingAdapter
from retrieval.expansion import QueryExpander
from retrieval.reranker import RerankerAdapter


class RetrievalService:
    """
    Enterprise permission-aware hybrid vector & keyword search engine.
    Guarantees zero data leakage by enforcing tenant and ACL pre-filters
    on BOTH dense and sparse retrieval paths before Reciprocal Rank Fusion,
    query expansion, parent-child expansion, and cross-encoder reranking.
    """

    def __init__(
        self,
        embedder: EmbeddingAdapter | None = None,
        reranker: RerankerAdapter | None = None,
        expander: QueryExpander | None = None,
    ):
        self.embedder = embedder or EmbeddingAdapter()
        self.reranker = reranker or RerankerAdapter()
        self.expander = expander or QueryExpander()

    def search(
        self,
        user_ctx: UserContext,
        query: str,
        top_k: int = 5,
        threshold: float = 0.0,
        mode: str = "hybrid",
        rerank: bool = True,
        alpha: float = 0.5,
        filters: dict[str, Any] | None = None,
        expand_parent: bool = False,
        query_expansion: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Executes permission-filtered retrieval across requested modes.

        :param user_ctx: Authoritative UserContext for active tenant and groups
        :param query: Natural language search query
        :param top_k: Maximum number of ranked chunks to return (1-20)
        :param threshold: Minimum score cutoff (0.0 to 1.0)
        :param mode: Search modality: "hybrid", "dense", or "sparse"
        :param rerank: Whether to apply the cross-encoder reranker
        :param alpha: Weight balance between dense (alpha) and sparse (1-alpha) in RRF
        :param filters: Optional metadata pre-filters (document_id, file_type, date, metadata)
        :param expand_parent: Whether to expand child chunk to parent window context
        :param query_expansion: Whether to perform multi-query expansion
        :return: List of ranked and reranked chunk dictionaries
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        # 1. Enforce strict Tenant and ACL Pre-Filtering on ALL query paths
        base_qs = self._get_acl_scoped_queryset(user_ctx, filters=filters)
        if not base_qs.exists():
            return []

        # Retrieve a broader candidate pool for fusion and reranking (retrieve wide, rerank narrow)
        candidate_limit = max(top_k * 6, 40)

        # 2. Query Expansion (Multi-Query Retrieval) or Single-Query Retrieval
        query_variations = [clean_query]
        if query_expansion:
            query_variations = self.expander.expand_query(clean_query, max_expansions=2)

        multi_query_candidates: list[list[dict[str, Any]]] = []

        for q_text in query_variations:
            if mode == "dense":
                query_vector = self.embedder.get_embedding(q_text)
                cands = self._dense_search(base_qs, query_vector, candidate_limit)
                for c in cands:
                    c["retrieval_mode"] = "dense"
                multi_query_candidates.append(cands)

            elif mode == "sparse":
                cands = self._sparse_search(base_qs, q_text, candidate_limit)
                for c in cands:
                    c["retrieval_mode"] = "sparse"
                multi_query_candidates.append(cands)

            else:  # mode == "hybrid"
                query_vector = self.embedder.get_embedding(q_text)
                dense_cands = self._dense_search(base_qs, query_vector, candidate_limit)
                sparse_cands = self._sparse_search(base_qs, q_text, candidate_limit)
                fused = self._reciprocal_rank_fusion(
                    dense_cands, sparse_cands, alpha=alpha, k=60
                )
                multi_query_candidates.append(fused)

        # Fuse candidate pools across query expansions if multiple queries were used
        if len(multi_query_candidates) == 1:
            candidates = multi_query_candidates[0]
        else:
            candidates = self._multi_query_fusion(multi_query_candidates, k=60)

        if not candidates:
            return []

        # 3. Apply Cross-Encoder Reranking
        if rerank:
            final_results = self.reranker.rerank(clean_query, candidates, top_k=top_k)
        else:
            final_results = candidates[:top_k]

        # 4. Filter by threshold if requested
        if threshold > 0.0:
            final_results = [
                r
                for r in final_results
                if r.get("score", r.get("similarity", 0.0)) >= threshold
            ]

        # 5. Parent-Child Context Expansion (Small-to-Big Retrieval)
        if expand_parent and final_results:
            final_results = self._expand_parent_contexts(final_results, window_size=1)

        return final_results

    def _get_acl_scoped_queryset(
        self, user_ctx: UserContext, filters: dict[str, Any] | None = None
    ):
        """
        Constructs the authoritative SQL pre-filter queryset via Single Source of Truth (Rule 4).
        Applies optional metadata filters (document_id, file_type, date range, custom metadata)
        strictly at the SQL level BEFORE vector/text search.
        """
        qs = Chunk.objects.filter(
            get_permitted_chunks_q(user_ctx)
        ).select_related("document")

        if filters:
            # 1. Document ID(s)
            doc_id = filters.get("document_id") or filters.get("doc_id")
            if doc_id:
                if isinstance(doc_id, (list, tuple, set)):
                    qs = qs.filter(document_id__in=doc_id)
                else:
                    qs = qs.filter(document_id=doc_id)

            doc_ids = filters.get("document_ids")
            if doc_ids and isinstance(doc_ids, (list, tuple, set)):
                qs = qs.filter(document_id__in=doc_ids)

            # 2. File type
            file_type = filters.get("file_type")
            if file_type:
                qs = qs.filter(document__file_type=file_type)

            # 3. Visibility
            visibility = filters.get("visibility")
            if visibility:
                qs = qs.filter(document__visibility=visibility)

            # 4. Date ranges
            created_after = filters.get("created_after") or filters.get("date_from")
            if created_after:
                qs = qs.filter(document__created_at__gte=created_after)

            created_before = filters.get("created_before") or filters.get("date_to")
            if created_before:
                qs = qs.filter(document__created_at__lte=created_before)

            # 5. Arbitrary key-value metadata lookups
            meta_filters = filters.get("metadata")
            if meta_filters and isinstance(meta_filters, dict):
                for k, v in meta_filters.items():
                    qs = qs.filter(
                        Q(**{f"metadata__{k}": v}) | Q(**{f"document__metadata__{k}": v})
                    )

        return qs.distinct()

    def _dense_search(
        self,
        base_qs,
        query_vector: list[float],
        limit: int,
    ) -> list[dict[str, Any]]:
        """Dense semantic vector search using pgvector cosine distance."""
        is_postgres = connection.vendor == "postgresql"

        if is_postgres:
            ranked_qs = base_qs.annotate(
                distance=CosineDistance("embedding", query_vector)
            ).order_by("distance")[:limit]

            results = []
            for chunk in ranked_qs:
                dist = float(chunk.distance) if chunk.distance is not None else 1.0
                sim = max(0.0, min(1.0, 1.0 - dist))
                results.append(
                    {
                        "chunk_id": str(chunk.id),
                        "document_id": str(chunk.document_id),
                        "document_title": chunk.document.title,
                        "visibility": chunk.document.visibility,
                        "position": chunk.position,
                        "text": chunk.text,
                        "distance": round(dist, 4),
                        "similarity": round(sim, 4),
                        "score": round(sim, 4),
                        "metadata": chunk.metadata,
                        "retrieval_mode": "dense",
                    }
                )
            return results

        # In SQLite/Mock fallback: compute cosine distance in Python
        candidates = list(base_qs[: limit * 3])
        scored = []
        for chunk in candidates:
            chunk_vec = chunk.embedding
            if chunk_vec and isinstance(chunk_vec, list):
                dist = self._compute_cosine_distance(query_vector, chunk_vec)
                sim = max(0.0, min(1.0, 1.0 - dist))
            else:
                dist = 0.5
                sim = 0.5
            scored.append((dist, sim, chunk))

        scored.sort(key=lambda x: x[0])
        return [
            {
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "document_title": chunk.document.title,
                "visibility": chunk.document.visibility,
                "position": chunk.position,
                "text": chunk.text,
                "distance": round(dist, 4),
                "similarity": round(sim, 4),
                "score": round(sim, 4),
                "metadata": chunk.metadata,
                "retrieval_mode": "dense",
            }
            for dist, sim, chunk in scored[:limit]
        ]

    def _sparse_search(
        self,
        base_qs,
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Sparse lexical keyword search.
        In PostgreSQL: uses native full-text search (tsvector, tsquery, SearchRank).
        In test fallback: uses token keyword overlap with term frequency scoring.
        """
        words = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
        if not words:
            return []

        is_postgres = connection.vendor == "postgresql"

        if is_postgres:
            try:
                from django.contrib.postgres.search import (
                    SearchQuery,
                    SearchRank,
                    SearchVector,
                )

                search_query = SearchQuery(words[0])
                for w in words[1:]:
                    search_query |= SearchQuery(w)

                search_vector = SearchVector("text", weight="A")
                ranked_qs = (
                    base_qs.annotate(rank=SearchRank(search_vector, search_query))
                    .filter(rank__gt=0.001)
                    .order_by("-rank")[:limit]
                )

                results = []
                for chunk in ranked_qs:
                    r = (
                        float(chunk.rank)
                        if hasattr(chunk, "rank") and chunk.rank
                        else 0.5
                    )
                    sim = round(max(0.1, min(0.99, r * 2.0)), 4)
                    results.append(
                        {
                            "chunk_id": str(chunk.id),
                            "document_id": str(chunk.document_id),
                            "document_title": chunk.document.title,
                            "visibility": chunk.document.visibility,
                            "position": chunk.position,
                            "text": chunk.text,
                            "distance": round(1.0 - sim, 4),
                            "similarity": sim,
                            "score": sim,
                            "metadata": chunk.metadata,
                            "retrieval_mode": "sparse",
                        }
                    )
                if results:
                    return results
            except Exception as exc:
                print(f"[RetrievalService] Postgres full-text query fallback: {exc}")

        # Lexical keyword fallback (word match scoring)
        q_filter = Q()
        for w in words:
            q_filter |= Q(text__icontains=w)

        matched_chunks = list(base_qs.filter(q_filter)[: limit * 2])
        scored = []
        for chunk in matched_chunks:
            text_lower = chunk.text.lower()
            overlap = sum(text_lower.count(w) for w in words)
            score = round(min(0.95, 0.2 + (overlap * 0.15)), 4)
            scored.append((score, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "document_title": chunk.document.title,
                "visibility": chunk.document.visibility,
                "position": chunk.position,
                "text": chunk.text,
                "distance": round(1.0 - sc, 4),
                "similarity": sc,
                "score": sc,
                "metadata": chunk.metadata,
                "retrieval_mode": "sparse",
            }
            for sc, chunk in scored[:limit]
        ]

    def _reciprocal_rank_fusion(
        self,
        dense_candidates: list[dict[str, Any]],
        sparse_candidates: list[dict[str, Any]],
        alpha: float = 0.5,
        k: int = 60,
    ) -> list[dict[str, Any]]:
        """
        Merges dense and sparse candidates using standard Reciprocal Rank Fusion (RRF).
        RRF(d) = alpha * (1 / (k + rank_dense)) + (1 - alpha) * (1 / (k + rank_sparse))
        """
        dense_weight = max(0.0, min(1.0, alpha))
        sparse_weight = 1.0 - dense_weight

        fused_scores: dict[str, float] = {}
        chunk_map: dict[str, dict[str, Any]] = {}

        # 1. Score dense candidates
        for rank, cand in enumerate(dense_candidates):
            cid = cand["chunk_id"]
            chunk_map[cid] = cand
            fused_scores[cid] = fused_scores.get(cid, 0.0) + (
                dense_weight / (k + rank + 1)
            )

        # 2. Score sparse candidates
        for rank, cand in enumerate(sparse_candidates):
            cid = cand["chunk_id"]
            if cid not in chunk_map:
                chunk_map[cid] = cand
            fused_scores[cid] = fused_scores.get(cid, 0.0) + (
                sparse_weight / (k + rank + 1)
            )

        # 3. Sort by combined RRF score
        sorted_cids = sorted(
            fused_scores.keys(), key=lambda cid: fused_scores[cid], reverse=True
        )

        results = []
        for cid in sorted_cids:
            cand = dict(chunk_map[cid])
            rrf_raw = fused_scores[cid]
            norm_score = round(min(0.99, rrf_raw * (k + 1)), 4)
            cand["rrf_score"] = norm_score
            cand["score"] = norm_score
            cand["similarity"] = norm_score
            cand["distance"] = round(max(0.01, 1.0 - norm_score), 4)
            cand["retrieval_mode"] = "hybrid"
            results.append(cand)

        return results

    def _multi_query_fusion(
        self,
        multi_candidates: list[list[dict[str, Any]]],
        k: int = 60,
    ) -> list[dict[str, Any]]:
        """
        Merges multiple ranked lists from query expansion into a consolidated candidate pool.
        """
        fused_scores: dict[str, float] = {}
        chunk_map: dict[str, dict[str, Any]] = {}
        weight_per_query = 1.0 / max(1, len(multi_candidates))

        for cand_list in multi_candidates:
            for rank, cand in enumerate(cand_list):
                cid = cand["chunk_id"]
                if cid not in chunk_map:
                    chunk_map[cid] = cand
                fused_scores[cid] = fused_scores.get(cid, 0.0) + (
                    weight_per_query / (k + rank + 1)
                )

        sorted_cids = sorted(
            fused_scores.keys(), key=lambda cid: fused_scores[cid], reverse=True
        )

        results = []
        for cid in sorted_cids:
            cand = dict(chunk_map[cid])
            norm_score = round(min(0.99, fused_scores[cid] * (k + 1)), 4)
            cand["score"] = norm_score
            cand["similarity"] = norm_score
            results.append(cand)

        return results

    def _expand_parent_contexts(
        self, candidates: list[dict[str, Any]], window_size: int = 1
    ) -> list[dict[str, Any]]:
        """
        Parent-Child Retrieval (Small-to-Big Retrieval Window Expansion).
        For each retrieved child chunk, looks up immediate preceding and succeeding
        adjacent chunks (position - 1, position + 1) in the same parent document.
        Assembles a coherent parent_text context window so the LLM receives full narrative
        continuity without embedding dilution.
        """
        if not candidates:
            return []

        doc_positions: dict[str, set[int]] = {}
        for c in candidates:
            doc_id = c.get("document_id")
            pos = c.get("position")
            if pos is None:
                pos = c.get("metadata", {}).get("position")

            if doc_id and pos is not None:
                needed = set(range(max(0, pos - window_size), pos + window_size + 1))
                doc_positions.setdefault(doc_id, set()).update(needed)

        if not doc_positions:
            return candidates

        q_or = Q()
        for doc_id, positions in doc_positions.items():
            q_or |= Q(document_id=doc_id, position__in=positions)

        sibling_chunks = {
            (str(ch.document_id), ch.position): ch.text
            for ch in Chunk.objects.filter(q_or).only(
                "id", "document_id", "position", "text"
            )
        }

        expanded_candidates = []
        for c in candidates:
            item = dict(c)
            doc_id = c.get("document_id")
            pos = c.get("position")
            if pos is None:
                pos = c.get("metadata", {}).get("position")

            if doc_id and pos is not None:
                parent_parts = []
                for p in range(max(0, pos - window_size), pos + window_size + 1):
                    sibling_text = sibling_chunks.get((doc_id, p))
                    if sibling_text and sibling_text not in parent_parts:
                        parent_parts.append(sibling_text)

                item["parent_text"] = (
                    "\n\n".join(parent_parts) if parent_parts else c["text"]
                )
            else:
                item["parent_text"] = c["text"]

            expanded_candidates.append(item)

        return expanded_candidates

    @staticmethod
    def _compute_cosine_distance(vec_a: list[float], vec_b: list[float]) -> float:
        """Computes cosine distance between two unit vectors."""
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 1.0
        similarity = dot / (norm_a * norm_b)
        return max(0.0, 1.0 - similarity)
