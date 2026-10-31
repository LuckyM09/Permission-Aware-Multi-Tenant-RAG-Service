import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class QueryExpander:
    """
    Advanced Query Expansion Engine for VaultRAG.
    Bridges the vocabulary gap between terse/colloquial user prompts
    and formal technical documentation.
    Produces complementary sub-queries and synonym-expanded variations
    for multi-query Reciprocal Rank Fusion (RRF).
    """

    # Domain-specific abbreviation and synonym mapping
    TECHNICAL_SYNONYMS: dict[str, list[str]] = {
        "rag": ["retrieval augmented generation", "vector search context grounding"],
        "retrieval": ["semantic search", "vector similarity search", "passage retrieval"],
        "chunking": ["text segmentation", "recursive splitting", "token chunk size"],
        "chunk": ["passage", "text segment", "document slice"],
        "rls": ["row level security", "tenant database isolation policy"],
        "jwt": ["json web token", "bearer token authentication", "token claims"],
        "acl": ["access control list", "permission group membership", "document visibility"],
        "permission": ["access authorization", "group privileges", "role assignment"],
        "hnsw": ["hierarchical navigable small world", "vector index cosine distance"],
        "rerank": ["cross-encoder ranking", "re-scoring relevance"],
        "audit": ["immutable activity log", "access ledger trail"],
        "tenant": ["organization workspace", "multi-tenancy isolation"],
    }

    def __init__(self, llm_client: Any = None):
        self.llm_client = llm_client

    def expand_query(self, query: str, max_expansions: int = 2) -> list[str]:
        """
        Generates alternative search queries for multi-query retrieval.
        Always returns the original query as the primary query at index 0.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        queries = [clean_query]

        # 1. Rule-based domain synonym expansion
        words = re.findall(r"\b\w+\b", clean_query.lower())
        synonym_replacements: list[str] = []

        for word in words:
            if word in self.TECHNICAL_SYNONYMS:
                for syn in self.TECHNICAL_SYNONYMS[word][:2]:
                    # Create variation replacing abbreviation with expanded definition
                    expanded = re.sub(
                        rf"\b{re.escape(word)}\b",
                        syn,
                        clean_query,
                        flags=re.IGNORECASE,
                    )
                    if expanded != clean_query and expanded not in queries:
                        synonym_replacements.append(expanded)

        for s in synonym_replacements[:max_expansions]:
            if s not in queries:
                queries.append(s)

        # 2. Key-phrase topical extraction if room remains
        if len(queries) < (max_expansions + 1):
            # Convert question into affirmative document topic
            affirmative = re.sub(
                r"^(what\s+is|how\s+to|explain|can\s+you\s+describe|tell\s+me\s+about)\s+",
                "",
                clean_query,
                flags=re.IGNORECASE,
            ).strip(" ?.")
            if affirmative and affirmative != clean_query and affirmative not in queries:
                queries.append(f"{affirmative} architecture guidelines overview")

        return queries[: max_expansions + 1]

