import hashlib
import math

from decouple import config


class EmbeddingAdapter:
    """
    Provider-agnostic embedding adapter generating 1,536-dimensional vectors.
    Uses OpenAI if OPENAI_API_KEY is configured; otherwise provides
    a deterministic normalized vector generator for offline dev, CI, and testing.
    """

    DIMENSIONS = 1536

    def __init__(self):
        self.api_key = config("OPENAI_API_KEY", default="")
        self.use_openai = bool(
            self.api_key and not self.api_key.startswith("your_openai_api_key")
        )

    def get_embedding(self, text: str) -> list[float]:
        return self.get_embeddings_batch([text])[0]

    def get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if self.use_openai:
            try:
                import requests

                res = requests.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "text-embedding-3-small",
                        "input": texts,
                        "dimensions": self.DIMENSIONS,
                    },
                    timeout=30,
                )
                if res.status_code == 200:
                    data = res.json()
                    return [item["embedding"] for item in data["data"]]
            except Exception as exc:
                print(
                    f"[EmbeddingAdapter] OpenAI API call failed, using mock generator: {exc}"
                )

        # Deterministic semantic unit vector fallback for local development & CI
        return [self._generate_deterministic_embedding(t) for t in texts]

    def _generate_deterministic_embedding(self, text: str) -> list[float]:
        """
        Generates a deterministic 1,536-dimensional normalized unit vector
        seeded from the text's SHA-256 and word tokens.
        """
        words = text.lower().split()
        vector = [0.0] * self.DIMENSIONS

        for i, word in enumerate(words):
            # Seed vector coordinates based on word hash
            h = int(hashlib.sha256(word.encode()).hexdigest(), 16)
            idx = h % self.DIMENSIONS
            vector[idx] += 1.0 / (math.log(i + 2) + 1.0)

        # Base seed from entire text to avoid all-zero vectors
        text_hash = hashlib.sha256(text.encode()).digest()
        for i in range(min(len(text_hash), self.DIMENSIONS)):
            vector[i] += float(text_hash[i]) / 255.0

        # Normalize to unit length (L2 norm = 1.0) for cosine distance
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        else:
            vector[0] = 1.0

        return vector
