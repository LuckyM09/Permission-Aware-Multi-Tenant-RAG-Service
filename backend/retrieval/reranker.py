import math
import re
from typing import Any

from decouple import config


class RerankerAdapter:
    """
    Cross-Encoder Reranker Adapter for VaultRAG.
    Re-scores and re-ranks retrieved candidate passages against the user query.
    Supports NVIDIA NIM NeMo Retriever reranking (nvidia/nemotron-3.5-rerank-8b),
    Cohere rerank (rerank-v3.5), or an in-engine semantic-lexical cross-scorer.
    """

    def __init__(self):
        self.nvidia_api_key = config("NVIDIA_API_KEY", default="")
        self.nvidia_rerank_model = config(
            "RERANK_MODEL", default="nvidia/nemotron-3.5-rerank-8b"
        )
        self.use_nvidia = bool(
            self.nvidia_api_key
            and not self.nvidia_api_key.startswith("your_")
            and len(self.nvidia_api_key) > 10
        )

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

        if self.use_nvidia:
            try:
                return self._rerank_nvidia(query, candidates, top_k)
            except Exception as exc:
                print(
                    f"[RerankerAdapter] NVIDIA rerank failed ({exc}), falling back."
                )

        if self.use_cohere:
            try:
                return self._rerank_cohere(query, candidates, top_k)
            except Exception as exc:
                print(
                    f"[RerankerAdapter] Cohere rerank failed ({exc}), using local cross-scorer."
                )

        return self._rerank_local(query, candidates, top_k)

    def _rerank_nvidia(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        import requests

        docs = [c.get("text", "") for c in candidates]
        passages = [{"text": d} for d in docs]
        url = f"https://ai.api.nvidia.com/v1/retrieval/{self.nvidia_rerank_model}/reranking"

        payload = {
            "model": self.nvidia_rerank_model,
            "query": {"text": query},
            "passages": passages,
            "truncate": "END",
        }
        res = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {self.nvidia_api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=payload,
            timeout=15,
        )
        if res.status_code != 200:
            raise RuntimeError(
                f"NVIDIA Rerank API returned {res.status_code}: {res.text[:120]}"
            )

        data = res.json()
        rankings = data.get("rankings", [])
        rankings.sort(key=lambda x: x.get("logit", -999.0), reverse=True)

        results = []
        for item in rankings[:top_k]:
            idx = item["index"]
            cand_copy = dict(candidates[idx])
            logit = item.get("logit", 0.0)
            # Calibrate neural cross-encoder logits:
            # NVIDIA Nemotron-3.5-Rerank-8B outputs uncalibrated logits typically centered at -2.5.
            # Shifting by +2.5 aligns relevant matches (logits -1.5 to 0.0) to scores 0.73 - 0.92,
            # while rejecting irrelevant noise (logits < -3.65) below the 0.25 retrieval cutoff.
            calibrated_logit = logit + 2.5
            norm_score = round(1.0 / (1.0 + math.exp(-calibrated_logit)), 4)
            cand_copy["rerank_score"] = norm_score
            cand_copy["score"] = norm_score
            cand_copy["reranked"] = True
            results.append(cand_copy)
        return results

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
