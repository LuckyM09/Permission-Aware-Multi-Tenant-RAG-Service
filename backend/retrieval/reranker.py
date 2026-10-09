import re
from typing import Any

from decouple import config


class RerankerAdapter:
    """
    Cross-Encoder Reranker Adapter for VaultRAG.
    Re-scores and re-ranks retrieved candidate passages against the user query.
    Supports external reranker APIs (e.g., Cohere) if configured, or uses an
    in-engine semantic-lexical cross-scoring model for zero-dependency operation.
    """

    def __init__(self):
        self.cohere_api_key = config("COHERE_API_KEY", default="")
        self.use_cohere = bool(
            self.cohere_api_key and not self.cohere_api_key.startswith("your_")
        )

    def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Scores and ranks candidate chunks against the query.

        :param query: Natural language search query
        :param candidates: Pre-filtered candidate chunks
        :param top_k: Number of highest-relevance chunks to return
        :return: Reranked list of candidate dictionaries with updated scores
        """
        if not candidates:
            return []

        if len(candidates) == 1:
            candidates[0]["rerank_score"] = 0.95
            candidates[0]["reranked"] = True
            return candidates

        if self.use_cohere:
            try:
                return self._rerank_cohere(query, candidates, top_k)
            except Exception as exc:
                print(
                    f"[RerankerAdapter] Cohere rerank failed ({exc}), using local cross-scorer."
                )

        return self._rerank_local(query, candidates, top_k)

    def _rerank_local(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Cross-attention approximation scoring query-passage interactions:
        1. Exact n-gram token overlap
        2. Query term density & span proximity
        3. Lexical coverage
        4. Base retrieval score combination
        """
        query_tokens = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
        query_bigrams = [
            f"{query_tokens[i]} {query_tokens[i + 1]}"
            for i in range(len(query_tokens) - 1)
        ]

        scored_candidates = []
        for cand in candidates:
            text = cand.get("text", "").lower()
            text_tokens = re.findall(r"\w+", text)

            if not text_tokens or not query_tokens:
                score = cand.get("similarity", 0.5)
            else:
                # 1. Unigram coverage (ratio of query words present)
                matching_unigrams = sum(1 for q in query_tokens if q in text)
                unigram_coverage = matching_unigrams / len(query_tokens)

                # 2. Bigram coverage (exact phrase proximity)
                if query_bigrams:
                    matching_bigrams = sum(1 for bg in query_bigrams if bg in text)
                    bigram_coverage = matching_bigrams / len(query_bigrams)
                else:
                    bigram_coverage = unigram_coverage

                # 3. Term frequency saturation (BM25-style term weighting)
                tf_score = 0.0
                for q in query_tokens:
                    count = text.count(q)
                    if count > 0:
                        tf_score += (count * 2.2) / (count + 1.2)
                tf_norm = min(1.0, tf_score / (len(query_tokens) * 2.0))

                # 4. Synthesize cross-scoring relevance
                base_sim = cand.get("similarity", 0.5)
                cross_score = (
                    0.35 * unigram_coverage
                    + 0.30 * bigram_coverage
                    + 0.15 * tf_norm
                    + 0.20 * base_sim
                )
                score = round(max(0.05, min(0.99, cross_score)), 4)

            cand_copy = dict(cand)
            cand_copy["rerank_score"] = score
            cand_copy["score"] = score
            cand_copy["reranked"] = True
            scored_candidates.append(cand_copy)

        # Sort descending by rerank_score
        scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return scored_candidates[:top_k]

    def _rerank_cohere(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        import requests

        docs = [c.get("text", "") for c in candidates]
        res = requests.post(
            "https://api.cohere.com/v1/rerank",
            headers={
                "Authorization": f"Bearer {self.cohere_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "rerank-v3.5",
                "query": query,
                "documents": docs,
                "top_n": top_k,
            },
            timeout=15,
        )
        if res.status_code != 200:
            raise RuntimeError(f"Cohere API returned {res.status_code}")

        data = res.json()
        results = []
        for item in data.get("results", []):
            idx = item["index"]
            cand_copy = dict(candidates[idx])
            cand_copy["rerank_score"] = round(item["relevance_score"], 4)
            cand_copy["score"] = cand_copy["rerank_score"]
            cand_copy["reranked"] = True
            results.append(cand_copy)
        return results
