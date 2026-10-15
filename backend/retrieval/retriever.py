from typing import Any, List, Optional

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document as LCDocument
from langchain_core.retrievers import BaseRetriever
from pydantic import Field

from accounts.context import UserContext
from retrieval.services import RetrievalService


class VaultRAGRetriever(BaseRetriever):
    """
    LangChain BaseRetriever implementation for VaultRAG.
    Enforces multi-tenant SQL pre-filtering, pgvector cosine search,
    BM25 sparse search, RRF fusion, and cross-encoder reranking
    under the standard LangChain retriever interface.
    """

    user_ctx: Any = Field(description="Tenant-scoped UserContext")
    top_k: int = Field(default=5, description="Number of chunks to retrieve")
    threshold: float = Field(default=0.25, description="Similarity threshold cutoff")
    mode: str = Field(default="hybrid", description="hybrid | dense | sparse")
    rerank: bool = Field(default=True, description="Enable cross-encoder reranker")
    service: Any = Field(default_factory=RetrievalService, description="Underlying RetrievalService")

    class Config:
        arbitrary_types_allowed = True

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: Optional[CallbackManagerForRetrieverRun] = None,
    ) -> List[LCDocument]:
        raw_results = self.service.search(
            user_ctx=self.user_ctx,
            query=query,
            top_k=self.top_k,
            threshold=self.threshold,
            mode=self.mode,
            rerank=self.rerank,
        )

        lc_docs: List[LCDocument] = []
        for r in raw_results:
            meta = r.get("metadata") or {}
            lc_docs.append(
                LCDocument(
                    page_content=r["text"],
                    metadata={
                        "chunk_id": r["chunk_id"],
                        "document_id": r["document_id"],
                        "document_title": r["document_title"],
                        "similarity": r.get("similarity", r.get("score", 0.0)),
                        "visibility": r.get("visibility", "tenant"),
                        "retrieval_mode": r.get("retrieval_mode", self.mode),
                        "reranked": r.get("reranked", False),
                        "page": meta.get("page", 1),
                        "images": meta.get("images", []),
                    },
                )
            )
        return lc_docs

    @classmethod
    def for_user(
        cls,
        user_ctx: UserContext,
        top_k: int = 5,
        threshold: float = 0.25,
        mode: str = "hybrid",
        rerank: bool = True,
    ) -> "VaultRAGRetriever":
        """Factory method to construct a tenant-safe retriever for a UserContext."""
        return cls(
            user_ctx=user_ctx,
            top_k=top_k,
            threshold=threshold,
            mode=mode,
            rerank=rerank,
        )
