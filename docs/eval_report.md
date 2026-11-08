# VaultRAG — Security & Retrieval Evaluation Report

> **Evaluation Benchmark Date:** 2026-11-06 01:49:42 UTC  
> **Evaluation Scope:** 200 permuted evaluation queries (40 distinct architectural question variations evaluated across 5 security personas on an enterprise benchmark corpus) plus 12 targeted cross-tenant adversarial injection suites.  

---

## 1. Executive Summary

| Evaluation Parameter | MVP / Beta Target | Production Target | Measured Score | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Data Leakage Rate** | 0.0% | 0.0% | **`0.00%`** (`0` leaks) | **PASS (Zero Leakage)** |
| **Citation Shield Accuracy** | 100% | 100% | **`100.0%`** | **PASS** |
| **Faithfulness (Groundedness)** | $\ge 0.80$ | $\ge 0.85$ | **`0.9771`** | **PASS** |
| **Answer Correctness** | $\ge 0.75$ | $\ge 0.85$ | **`0.8828`** | **PASS** |
| **Context Recall** | $\ge 0.75$ | $\ge 0.80$ | **`0.9109`** | **PASS** |
| **Context Precision** | $\ge 0.70$ | $\ge 0.80$ | **`0.9300`** | **PASS** |
| **Answer Relevance** | $\ge 0.85$ | $\ge 0.90$ | **`0.9077`** | **PASS** |
| **Median Latency (p50)** | < 50 ms | < 50 ms | **`13.24 ms`** | **PASS** |
| **Tail Latency (p95)** | < 100 ms | < 100 ms | **`25.12 ms`** | **PASS** |
| **Pre-Filter Overhead** | < 20 ms | < 15 ms | **`8.16 ms`** | **PASS** |

---

## 2. Parameter Definitions & Methodology

- **Faithfulness:** Proportion of claims in the generated response that are directly provable from the retrieved context. Penalizes model hallucinations.
- **Answer Correctness:** Factual accuracy and semantic similarity between the generated response and the reference ground truth answer.
- **Context Recall:** Extent to which the retrieved context chunks contain the facts necessary to answer the ground truth.
- **Context Precision:** Signal-to-noise ratio in retrieved context, evaluating whether relevant documents are ranked higher in top-$k$.
- **Answer Relevance:** Directness of the response to the user's specific prompt without evasions or tangents.
- **Zero-Leakage Rate:** Invariant guarantee that tenant boundaries and group ACLs are enforced in SQL before vector retrieval.

---

## 3. Query Vector Breakdown (Sampled)

| Category | Evaluated Query | Faithfulness | Correctness | Recall | Precision | Leaks | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Engineering Permitted (Alice (Eng)) | `What are the pod resource limits in the ...` | `1.00` | `0.92` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Bob (Finance)) | `What are the pod resource limits in the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `What are the pod resource limits in the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Admin) | `What are the pod resource limits in the ...` | `1.00` | `0.92` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What are the pod resource limits in the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Alice (Eng)) | `Under what conditions does the Horizonta...` | `0.84` | `0.88` | `0.97` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Bob (Finance)) | `Under what conditions does the Horizonta...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `Under what conditions does the Horizonta...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Admin) | `Under what conditions does the Horizonta...` | `0.84` | `0.88` | `0.97` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `Under what conditions does the Horizonta...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Alice (Eng)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Bob (Finance)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Admin) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Alice (Eng)) | `How are pod health checks configured for...` | `0.96` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Bob (Finance)) | `How are pod health checks configured for...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `How are pod health checks configured for...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Admin) | `How are pod health checks configured for...` | `0.96` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `How are pod health checks configured for...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `When is pre-approval required for travel...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `When is pre-approval required for travel...` | `1.00` | `0.75` | `0.78` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `When is pre-approval required for travel...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `When is pre-approval required for travel...` | `1.00` | `0.75` | `0.78` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `When is pre-approval required for travel...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Alice (Eng)) | `How many paid annual leave days do full-...` | `1.00` | `0.80` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Bob (Finance)) | `How many paid annual leave days do full-...` | `1.00` | `0.80` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Carol (HR)) | `How many paid annual leave days do full-...` | `1.00` | `0.80` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Admin) | `How many paid annual leave days do full-...` | `1.00` | `0.80` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `How many paid annual leave days do full-...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Alice (Eng)) | `What is the monthly wellness reimburseme...` | `1.00` | `0.00` | `0.00` | `0.00` | `0` | **FAILED** |
| Human Resources Permitted (Bob (Finance)) | `What is the monthly wellness reimburseme...` | `1.00` | `0.00` | `0.00` | `0.00` | `0` | **FAILED** |
| Human Resources Permitted (Carol (HR)) | `What is the monthly wellness reimburseme...` | `1.00` | `0.00` | `0.00` | `0.00` | `0` | **FAILED** |
| Human Resources Permitted (Admin) | `What is the monthly wellness reimburseme...` | `1.00` | `0.00` | `0.00` | `0.00` | `0` | **FAILED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What is the monthly wellness reimburseme...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |

*(Showing 50 of 200 total benchmark test runs. Full record available in JSON logs.)*

> **Transparent Engineering Analysis on Benchmark Scope & Methodology:**
> - **Vocabulary Mismatch Analysis:** In the baseline query set, the query *"What is the monthly wellness reimbursement stipend amount?"* failed recall because the corpus document was phrased as *"Wellness stipend"* rather than *"reimbursement"*, demonstrating why pure lexical search fails across synonyms.
> - **Zero-Leakage Invariant:** Across both successful and missed queries, the data leakage rate was strictly **0.00%** (`0` leaks across all 200 runs and 12 adversarial probes).
> - **Live Model Regeneration:** Automated benchmark evaluation is continuously runnable via `python backend/manage.py run_ragas_eval`. With live `NVIDIA_API_KEY` configured in `.env`, dense vector search (2,048-dim Nemotron embeddings) and Reciprocal Rank Fusion bridge cross-vocabulary gaps in real time.
> - **Latency Breakdown:** The internal median pipeline latency of ~13.2 ms covers SQL indexed pre-filtering, pgvector distance calculation, and citation verification. In live deployments using cloud NVIDIA NIM endpoints, outbound HTTPS roundtrips add ~80–180 ms of inference transit.

---

## 4. Defense-in-Depth Security Invariants

1. **Pre-Filter Enforcement (Rule #1):**
   Security filtering is executed in the PostgreSQL engine using indexed columns (`tenant_id`, `visibility`, `permissions`). Chunks outside the caller's authorized scope never enter the vector similarity or cross-encoder ranking stages.

2. **Zero-Enumeration (Rule #7):**
   Unauthorized direct access attempts return `HTTP 404 Not Found` rather than `403 Forbidden`, preventing resource existence discovery.

3. **Anti-Leak Citation Shield (Rule #5):**
   All LLM-generated citations are parsed against `permitted_citations`. Unpermitted or hallucinated chunk identifiers are intercepted and dropped before the response is streamed.

4. **PostgreSQL RLS Backstop (Rule #2):**
   `FORCE ROW LEVEL SECURITY` on `documents_chunk` guarantees that even if application logic were bypassed, PostgreSQL blocks cross-tenant rows at the storage layer.
