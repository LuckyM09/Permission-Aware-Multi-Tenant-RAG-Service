import math
from typing import Any

from django.db import connection
from django.db.models import Q
from pgvector.django import CosineDistance

from accounts.context import UserContext
from documents.models import Chunk, Document
from ingestion.embedder import EmbeddingAdapter


class RetrievalService:
    """
    Enterprise permission-aware vector search engine.
    Applies SQL-level tenancy and ACL pre-filtering before cosine ranking.
    """

    def __init__(self, embedder: EmbeddingAdapter | None = None):
        self.embedder = embedder or EmbeddingAdapter()

    def search(
        self,
        user_ctx: UserContext,
        query: str,
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> list[dict[str, Any]]:
        """
        Executes a permission-filtered nearest-neighbor vector search.

        :param user_ctx: Authoritative UserContext for active tenant and groups
        :param query: Natural language search query
        :param top_k: Maximum number of ranked chunks to return
        :param threshold: Minimum cosine similarity score (0.0 to 1.0)
        :return: List of ranked chunk dictionaries
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        # 1. Compute 1,536-dimensional query embedding
        query_vector = self.embedder.get_embedding(clean_query)

        # 2. Strict Tenant Scope & Ready Status
        base_qs = Chunk.objects.filter(
            tenant_id=user_ctx.tenant_id,
            document__status=Document.Status.READY,
        ).select_related("document")

        # 3. Access Control (ACL) Pre-Filtering
        if not user_ctx.is_admin():
            acl_filter = (
                Q(document__visibility=Document.Visibility.TENANT)
                | Q(document__owner_id=user_ctx.user_id)
            )
            if user_ctx.group_ids:
                acl_filter |= (
                    Q(document__visibility=Document.Visibility.GROUP)
                    & Q(document__permissions__group_id__in=user_ctx.group_ids)
                )

            base_qs = base_qs.filter(acl_filter).distinct()

        # 4. Vector Distance Calculation
        is_postgres = connection.vendor == "postgresql"

        if is_postgres:
            # Native PostgreSQL pgvector <=> operator with HNSW index acceleration
            ranked_qs = base_qs.annotate(distance=CosineDistance("embedding", query_vector))

            if threshold > 0.0:
                # similarity = 1 - distance => distance <= 1 - threshold
                max_distance = 1.0 - threshold
                ranked_qs = ranked_qs.filter(distance__lte=max_distance)

            ranked_qs = ranked_qs.order_by("distance")[:top_k]

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
                        "metadata": chunk.metadata,
                    }
                )
            return results

        # 5. Fallback for non-Postgres test runners (e.g. SQLite fallback)
        chunks = list(base_qs)
        scored_chunks = []
        for chunk in chunks:
            dist = self._compute_cosine_distance(query_vector, chunk.embedding)
            sim = max(0.0, min(1.0, 1.0 - dist))
            if threshold > 0.0 and sim < threshold:
                continue
            scored_chunks.append((dist, sim, chunk))

        scored_chunks.sort(key=lambda x: x[0])  # Sort ascending by distance
        top_chunks = scored_chunks[:top_k]

        return [
            {
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "document_title": chunk.document.title,
                "visibility": chunk.document.visibility,
                "text": chunk.text,
                "distance": round(dist, 4),
                "similarity": round(sim, 4),
                "metadata": chunk.metadata,
            }
            for dist, sim, chunk in top_chunks
        ]

    @staticmethod
    def _compute_cosine_distance(vec_a: list[float], vec_b: list[float]) -> float:
        """Computes cosine distance (1.0 - cosine_similarity) between two vectors."""
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 1.0
        similarity = dot / (norm_a * norm_b)
        return max(0.0, 1.0 - similarity)
