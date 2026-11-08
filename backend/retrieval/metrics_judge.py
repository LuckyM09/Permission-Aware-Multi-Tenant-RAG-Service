import json
import logging
import re
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class LLMJudge:
    """
    RAG Evaluation Judge supporting Faithfulness, Answer Correctness,
    Context Recall, Context Precision, and Answer Relevance.
    Includes robust heuristic fallbacks for offline, mock, or CI/CD test environments.
    """

    def __init__(self, client: Any | None = None):
        self.client = client
        self._openai_available = False
        api_key = getattr(settings, "OPENAI_API_KEY", "") or ""

        if client is not None:
            self._openai_available = True
        elif api_key and api_key != "mock" and not api_key.startswith("test-"):
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=api_key)
                self._openai_available = True
            except Exception as e:
                logger.warning(f"[LLMJudge] Failed to initialize OpenAI client: {e}. Using heuristic evaluator.")
                self._openai_available = False
        else:
            self._openai_available = False

    def evaluate_faithfulness(self, answer: str, contexts: list[str]) -> float:
        """
        Measures Hallucination: fraction of atomic claims in answer directly supported by context.
        Formula: (Supported Claims) / (Total Atomic Claims). Scale: [0.0, 1.0].
        Proper security refusals when context is empty are considered 100% faithful (0% hallucination).
        """
        is_refusal = any(p in answer.lower() for p in ["do not have access", "unauthorized", "access denied", "no document"])
        if not contexts or not answer.strip():
            return 1.0 if (not answer.strip() or is_refusal) else 0.0

        if not self._openai_available:
            return self._heuristic_faithfulness(answer, contexts)

        combined_context = "\n---\n".join(contexts)[:4000]
        prompt = f"""You are a strict factual hallucination auditor.

Retrieved Contexts:
\"\"\"{combined_context}\"\"\"

Generated Answer:
\"\"\"{answer}\"\"\"

Task:
1. Break down the Generated Answer into discrete atomic factual statements.
2. For each statement, determine whether it is DIRECTLY supported by the context without outside knowledge.

Return strictly a JSON object in this format:
{{
  "statements": [
    {{"statement": "claim 1", "supported": true}},
    {{"statement": "claim 2", "supported": false}}
  ]
}}"""
        try:
            res = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
            )
            data = json.loads(res.choices[0].message.content)
            stmts = data.get("statements", [])
            if not stmts:
                return 1.0
            supported = sum(1 for s in stmts if s.get("supported", False))
            return round(supported / len(stmts), 4)
        except Exception as exc:
            logger.warning(f"[LLMJudge] Faithfulness LLM call failed: {exc}. Using heuristic fallback.")
            return self._heuristic_faithfulness(answer, contexts)

    def evaluate_answer_correctness(self, answer: str, ground_truth: str) -> float:
        """
        Measures factual agreement and semantic correctness between answer and reference.
        Scale: [0.0, 1.0].
        """
        gt_refusal = any(p in ground_truth.lower() for p in ["access denied", "unauthorized", "do not have access"])
        ans_refusal = any(p in answer.lower() for p in ["access denied", "unauthorized", "do not have access", "no authorized document"])
        if gt_refusal and ans_refusal:
            return 1.0

        if not ground_truth.strip():
            return 1.0
        if not answer.strip():
            return 0.0

        if not self._openai_available:
            return self._heuristic_similarity(answer, ground_truth)

        prompt = f"""Compare the Generated Answer against the Reference Ground Truth for factual correctness.

Reference Ground Truth:
\"\"\"{ground_truth}\"\"\"

Generated Answer:
\"\"\"{answer}\"\"\"

Scoring Rubric:
- 1.0: Factually complete, exact match in conclusions and statements.
- 0.7 - 0.9: Correct in main claims, with minor omission of non-critical details.
- 0.4 - 0.6: Partially correct, but omits important facts or includes mild inaccuracies.
- 0.0 - 0.3: Factually wrong, misleading, or directly contradicts the ground truth.

Return strictly a JSON object: {{"score": 0.85, "reasoning": "brief explanation"}}"""
        try:
            res = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
            )
            data = json.loads(res.choices[0].message.content)
            score = float(data.get("score", 0.0))
            return round(max(0.0, min(1.0, score)), 4)
        except Exception as exc:
            logger.warning(f"[LLMJudge] Correctness LLM call failed: {exc}. Using heuristic fallback.")
            return self._heuristic_similarity(answer, ground_truth)

    def evaluate_context_recall(self, contexts: list[str], ground_truth: str) -> float:
        """
        Measures retrieval coverage: fraction of ground truth facts present in retrieved contexts.
        Scale: [0.0, 1.0].
        """
        gt_refusal = any(p in ground_truth.lower() for p in ["access denied", "unauthorized", "do not have access"])
        if gt_refusal:
            # For forbidden queries, 0 context retrieved is 100% expected behavior
            return 1.0 if not contexts else 0.0

        if not ground_truth.strip():
            return 1.0
        if not contexts:
            return 0.0

        if not self._openai_available:
            return self._heuristic_context_coverage(contexts, ground_truth)

        combined_context = "\n---\n".join(contexts)[:4000]
        prompt = f"""You are an information retrieval auditor.

Retrieved Contexts:
\"\"\"{combined_context}\"\"\"

Reference Ground Truth Answer:
\"\"\"{ground_truth}\"\"\"

Task:
Determine what proportion of the key factual claims in the Reference Ground Truth can be found in or deduced from the Retrieved Contexts.

Score from 0.0 (None of the ground truth facts are present) to 1.0 (All ground truth facts are covered).
Return strictly a JSON object: {{"recall_score": 1.0, "missing_facts": []}}"""
        try:
            res = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
            )
            data = json.loads(res.choices[0].message.content)
            score = float(data.get("recall_score", 0.0))
            return round(max(0.0, min(1.0, score)), 4)
        except Exception as exc:
            logger.warning(f"[LLMJudge] Recall LLM call failed: {exc}. Using heuristic fallback.")
            return self._heuristic_context_coverage(contexts, ground_truth)

    def evaluate_context_precision(self, expected_doc_ids: set[str], retrieved_doc_ids: list[str]) -> float:
        """
        Rank-weighted precision (Mean Average Precision style).
        Penalizes irrelevant documents appearing above relevant documents.
        Scale: [0.0, 1.0].
        """
        if not expected_doc_ids:
            return 1.0 if not retrieved_doc_ids else 0.0
        if not retrieved_doc_ids:
            return 0.0

        hits = 0
        precision_at_k_sum = 0.0

        for idx, doc_id in enumerate(retrieved_doc_ids, start=1):
            if doc_id in expected_doc_ids:
                hits += 1
                precision_at_k_sum += hits / idx

        if hits == 0:
            return 0.0

        return round(precision_at_k_sum / min(len(expected_doc_ids), len(retrieved_doc_ids)), 4)

    def evaluate_answer_relevance(self, query: str, answer: str) -> float:
        """
        Measures if the answer directly addresses the query without irrelevant tangents.
        Scale: [0.0, 1.0].
        """
        if not query.strip() or not answer.strip():
            return 0.0

        ans_refusal = any(p in answer.lower() for p in ["access denied", "unauthorized", "do not have access", "no authorized document"])
        if ans_refusal:
            return 1.0

        if not self._openai_available:
            return self._heuristic_relevance(query, answer)

        prompt = f"""Rate the relevance of this generated Answer to the original Question.
Does it answer the user's inquiry directly without evasion or off-topic tangents?

Question: \"\"\"{query}\"\"\"
Answer: \"\"\"{answer}\"\"\"

Score from 0.0 (Completely irrelevant or evasive) to 1.0 (Direct, comprehensive, on-point).
Return strictly a JSON object: {{"relevance_score": 0.95}}"""
        try:
            res = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
            )
            data = json.loads(res.choices[0].message.content)
            score = float(data.get("relevance_score", 0.0))
            return round(max(0.0, min(1.0, score)), 4)
        except Exception as exc:
            logger.warning(f"[LLMJudge] Relevance LLM call failed: {exc}. Using heuristic fallback.")
            return self._heuristic_relevance(query, answer)

    # -------------------------------------------------------------------------
    # Deterministic Heuristic Fallbacks (used when offline, mock, or CI/CD test)
    # -------------------------------------------------------------------------

    def _tokenize(self, text: str) -> set[str]:
        words = re.findall(r"\w+", text.lower())
        stopwords = {
            "the", "a", "an", "is", "are", "was", "were", "and", "or", "in", "on", "at",
            "to", "for", "with", "of", "by", "from", "it", "this", "that", "i", "we", "you"
        }
        return {w for w in words if w not in stopwords and len(w) > 2}

    def _stem(self, word: str) -> str:
        for suffix in ["ing", "ies", "es", "ed", "s"]:
            if word.endswith(suffix) and len(word) > len(suffix) + 2:
                return word[:-len(suffix)]
        return word

    def _heuristic_faithfulness(self, answer: str, contexts: list[str]) -> float:
        ans_tokens = {self._stem(w) for w in self._tokenize(answer)}
        if not ans_tokens:
            return 1.0
        ctx_tokens = {self._stem(w) for w in self._tokenize(" ".join(contexts))}
        overlap = ans_tokens & ctx_tokens
        return round(min(1.0, (len(overlap) / len(ans_tokens)) * 1.15), 4)

    def _heuristic_similarity(self, s1: str, s2: str) -> float:
        t1 = {self._stem(w) for w in self._tokenize(s1)}
        t2 = {self._stem(w) for w in self._tokenize(s2)}
        if not t1 or not t2:
            return 0.0
        intersection = len(t1 & t2)
        precision = intersection / len(t1)
        recall = intersection / len(t2)
        if precision + recall == 0:
            return 0.0
        f1 = (2 * precision * recall) / (precision + recall)
        nums1 = set(re.findall(r"\d+", s1))
        nums2 = set(re.findall(r"\d+", s2))
        if nums1 and nums2 and nums1 == nums2:
            f1 = min(1.0, f1 * 1.25)
        return round(f1, 4)

    def _heuristic_context_coverage(self, contexts: list[str], ground_truth: str) -> float:
        gt_tokens = {self._stem(w) for w in self._tokenize(ground_truth)}
        if not gt_tokens:
            return 1.0
        ctx_tokens = {self._stem(w) for w in self._tokenize(" ".join(contexts))}
        overlap = gt_tokens & ctx_tokens
        rec = len(overlap) / len(gt_tokens)
        return round(min(1.0, rec * 1.25), 4)

    def _heuristic_relevance(self, query: str, answer: str) -> float:
        q_tokens = {self._stem(w) for w in self._tokenize(query)}
        a_tokens = {self._stem(w) for w in self._tokenize(answer)}
        if not q_tokens or not a_tokens:
            return 0.0
        overlap = q_tokens & a_tokens
        rel = len(overlap) / len(q_tokens)
        return round(min(1.0, rel * 1.35), 4)

