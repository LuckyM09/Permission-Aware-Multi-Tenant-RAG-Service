import math
import re
from typing import Any

from django.db import connection
from django.db.models import Q
from pgvector.django import CosineDistance

from accounts.context import UserContext
from documents.models import Chunk, Document
from ingestion.embedder import EmbeddingAdapter
from retrieval.reranker import RerankerAdapter


class RetrievalService:
    """
    Enterprise permission-aware hybrid vector & keyword search engine.
    Guarantees zero data leakage by enforcing tenant and ACL pre-filters
    on BOTH dense and sparse retrieval paths before Reciprocal Rank Fusion
    and cross-encoder reranking.
    """

    def __init__(
        self,
        embedder: EmbeddingAdapter | None = None,
        reranker: RerankerAdapter | None = None,
    ):
        self.embedder = embedder or EmbeddingAdapter()
        self.reranker = reranker or RerankerAdapter()

    def search(
        self,
        user_ctx: UserContext,
        query: str,
        top_k: int = 5,
        threshold: float = 0.0,
        mode: str = "hybrid",
        rerank: bool = True,
        alpha: float = 0.5,
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
        :return: List of ranked and reranked chunk dictionaries
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        # 1. Enforce strict Tenant and ACL Pre-Filtering on ALL query paths
        base_qs = self._get_acl_scoped_queryset(user_ctx)
        if not base_qs.exists():
            return []

        # Retrieve a broader candidate pool for fusion and reranking
        candidate_limit = max(top_k * 3, 15)

        # 2. Execute retrieval based on selected mode
        if mode == "dense":
            query_vector = self.embedder.get_embedding(clean_query)
            candidates = self._dense_search(base_qs, query_vector, candidate_limit)
            for c in candidates:
                c["retrieval_mode"] = "dense"

        elif mode == "sparse":
            candidates = self._sparse_search(base_qs, clean_query, candidate_limit)
            for c in candidates:
                c["retrieval_mode"] = "sparse"

        else:  # mode == "hybrid"
            query_vector = self.embedder.get_embedding(clean_query)
            dense_candidates = self._dense_search(
                base_qs, query_vector, candidate_limit
            )
            sparse_candidates = self._sparse_search(
                base_qs, clean_query, candidate_limit
            )

            # Fuse candidate pools via Reciprocal Rank Fusion (RRF)
            candidates = self._reciprocal_rank_fusion(
                dense_candidates, sparse_candidates, alpha=alpha, k=60
            )

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

        return final_results

    def _get_acl_scoped_queryset(self, user_ctx: UserContext):
        """
        Constructs the authoritative SQL pre-filter queryset.
        This filter MUST be applied to both dense and sparse paths.
        """
        qs = Chunk.objects.filter(
            tenant_id=user_ctx.tenant_id,
            document__status=Document.Status.READY,
        ).select_related("document")

        if not user_ctx.is_admin():
            acl_filter = Q(document__visibility=Document.Visibility.TENANT) | Q(
                document__owner_id=user_ctx.user_id
            )
            if user_ctx.group_ids:
                acl_filter |= Q(document__visibility=Document.Visibility.GROUP) & Q(
                    document__permissions__group_id__in=user_ctx.group_ids
                )
            qs = qs.filter(acl_filter).distinct()

        return qs

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
                        "text": chunk.text,
                        "distance": round(dist, 4),
                        "similarity": round(sim, 4),
                        "score": round(sim, 4),
                        "metadata": chunk.metadata,
                        "retrieval_mode": "dense",
                    }
                )
            return results

        # Non-postgres fallback
        chunks = list(base_qs)
        scored = []
        for chunk in chunks:
            dist = self._compute_cosine_distance(query_vector, chunk.embedding)
            sim = max(0.0, min(1.0, 1.0 - dist))
            scored.append((dist, sim, chunk))

        scored.sort(key=lambda x: x[0])
        return [
            {
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "document_title": chunk.document.title,
                "visibility": chunk.document.visibility,
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
            # Normalize RRF score to 0.0 - 1.0 range
            norm_score = round(min(0.99, rrf_raw * (k + 1)), 4)
            cand["rrf_score"] = norm_score
            cand["score"] = norm_score
            cand["similarity"] = norm_score
            cand["distance"] = round(max(0.01, 1.0 - norm_score), 4)
            cand["retrieval_mode"] = "hybrid"
            results.append(cand)

        return results

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
