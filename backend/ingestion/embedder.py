import hashlib
import logging
import math
import re
from typing import Optional

from decouple import config
from langchain_openai import OpenAIEmbeddings

logger = logging.getLogger(__name__)


class EmbeddingAdapter:
    """
    Provider-agnostic embedding adapter generating 2,048-dimensional vectors.
    Uses LangChain OpenAIEmbeddings pointing to NVIDIA NIM Nemotron-3-Embed-1b
    when credentials are configured; otherwise provides a deterministic
    normalized unit vector generator for offline dev, CI, and testing.
    """

    DIMENSIONS = 2048

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = (
            api_key
            or config("NVIDIA_API_KEY", default="")
            or config("OPENAI_API_KEY", default="")
        )
        self.base_url = (
            base_url
            or config("NVIDIA_BASE_URL", default="")
            or config("OPENAI_BASE_URL", default="https://integrate.api.nvidia.com/v1")
        ).rstrip("/")
        if not self.base_url:
            self.base_url = "https://integrate.api.nvidia.com/v1"

        self.model = (
            model
            or config("EMBEDDING_MODEL", default="nvidia/nemotron-3-embed-1b")
        )

        import sys

        self.is_configured = bool(
            self.api_key
            and not self.api_key.startswith("your_")
            and len(self.api_key) > 10
            and not any(arg in sys.argv for arg in ["test", "pytest"])
        )

        if self.is_configured:
            self.langchain_embeddings: Optional[OpenAIEmbeddings] = OpenAIEmbeddings(
                model=self.model,
                api_key=self.api_key,
                base_url=self.base_url,
                check_embedding_ctx_length=False,
            )
        else:
            self.langchain_embeddings = None

    @property
    def allows_mock(self) -> bool:
        """Mock fallback is strictly permitted in local development/tests only."""
        from django.conf import settings

        return getattr(settings, "ALLOW_MOCK_AI_FALLBACK", getattr(settings, "DEBUG", False))

    def get_embedding(self, text: str) -> list[float]:
        return self.get_embeddings_batch([text])[0]

    def get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if self.langchain_embeddings is not None:
            try:
                return self.langchain_embeddings.embed_documents(texts)
            except Exception as exc:
                logger.error(
                    f"[EmbeddingAdapter] LangChain NIM embedding call failed: {exc}"
                )
                if self.allows_mock:
                    return [self._generate_deterministic_embedding(t) for t in texts]
                raise

        if self.allows_mock:
            # Deterministic semantic unit vector fallback for local development & CI
            return [self._generate_deterministic_embedding(t) for t in texts]

        raise RuntimeError(
            "Embedding model is not configured. A valid NVIDIA_API_KEY or OPENAI_API_KEY is required in production."
        )

    def _stem(self, word: str) -> str:
        for suffix in ["ing", "ies", "es", "ed", "s"]:
            if word.endswith(suffix) and len(word) > len(suffix) + 2:
                return word[: -len(suffix)]
        return word

    def _generate_deterministic_embedding(self, text: str) -> list[float]:
        """
        Generates a deterministic 2,048-dimensional normalized unit vector
        seeded from token hashes and signs. Unrelated vocabularies yield near-zero
        cosine similarity, preventing false-positive vector recall in tests.
        """
        words = re.findall(r"\w+", text.lower())
        vector = [0.0] * self.DIMENSIONS

        for i, word in enumerate(words):
            stemmed = self._stem(word)
            h = int(hashlib.sha256(stemmed.encode()).hexdigest(), 16)
            idx = h % self.DIMENSIONS
            sign = 1.0 if (h >> 16) % 2 == 0 else -1.0
            vector[idx] += sign * (1.0 / (math.log(i + 2) + 1.0))

        # Normalize to unit length (L2 norm = 1.0) for cosine distance
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        else:
            vector[0] = 1.0

        return vector
