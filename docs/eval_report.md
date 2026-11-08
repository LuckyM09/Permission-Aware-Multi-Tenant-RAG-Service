# VaultRAG — Security & Retrieval Evaluation Report

> **Evaluation Benchmark Date:** 2026-11-09 01:26:10 UTC  
> **Evaluation Scope:** 200 Evaluated Queries across Permissions, Faithfulness, Correctness, Recall, Precision, and Relevance.  

---

## 1. Executive Summary

| Evaluation Parameter | MVP / Beta Target | Production Target | Measured Score | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Data Leakage Rate** | 0.0% | 0.0% | **`0.00%`** (`0` leaks) | **PASS (Zero Leakage)** |
| **Citation Shield Accuracy** | 100% | 100% | **`100.0%`** | **PASS** |
| **Faithfulness (Groundedness)** | $\ge 0.80$ | $\ge 0.85$ | **`0.8615`** | **PASS** |
| **Answer Correctness** | $\ge 0.75$ | $\ge 0.85$ | **`0.9257`** | **PASS** |
| **Context Recall** | $\ge 0.75$ | $\ge 0.80$ | **`0.8709`** | **PASS** |
| **Context Precision** | $\ge 0.70$ | $\ge 0.80$ | **`0.8900`** | **PASS** |
| **Answer Relevance** | $\ge 0.85$ | $\ge 0.90$ | **`0.8651`** | **PASS** |
| **Median Latency (p50)** | < 50 ms | < 50 ms | **`354.04 ms`** | **REVIEW** |
| **Tail Latency (p95)** | < 100 ms | < 100 ms | **`541.10 ms`** | **REVIEW** |
| **Pre-Filter Overhead** | < 20 ms | < 15 ms | **`2.47 ms`** | **PASS** |

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
| Engineering Permitted (Alice (Eng)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `0.90` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Bob (Finance)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Admin) | `What mutual TLS mode is enforced by the ...` | `1.00` | `0.90` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What mutual TLS mode is enforced by the ...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Engineering Permitted (Alice (Eng)) | `How are pod health checks configured for...` | `0.77` | `0.73` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Bob (Finance)) | `How are pod health checks configured for...` | `0.00` | `1.00` | `0.00` | `0.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `How are pod health checks configured for...` | `0.00` | `1.00` | `0.00` | `0.00` | `0` | **PASSED** |
| Engineering Permitted (Admin) | `How are pod health checks configured for...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `How are pod health checks configured for...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `What is the Q3 executive bonus percentag...` | `0.96` | `0.91` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What is the Q3 executive bonus percentag...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `What is the maximum travel budget cap fo...` | `0.00` | `1.00` | `0.00` | `0.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `What is the maximum travel budget cap fo...` | `0.00` | `1.00` | `0.00` | `0.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What is the maximum travel budget cap fo...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `When is pre-approval required for travel...` | `0.00` | `1.00` | `0.00` | `0.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `When is pre-approval required for travel...` | `0.71` | `0.48` | `0.78` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `When is pre-approval required for travel...` | `0.00` | `1.00` | `0.00` | `0.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `When is pre-approval required for travel...` | `0.71` | `0.48` | `0.78` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `When is pre-approval required for travel...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Alice (Eng)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Bob (Finance)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Group Forbidden (Carol (HR)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Finance Permitted (Admin) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `How much capital expenditure is allocate...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Alice (Eng)) | `How many paid annual leave days do full-...` | `1.00` | `0.80` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Bob (Finance)) | `How many paid annual leave days do full-...` | `0.86` | `0.71` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Carol (HR)) | `How many paid annual leave days do full-...` | `0.86` | `0.71` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Admin) | `How many paid annual leave days do full-...` | `0.86` | `0.71` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `How many paid annual leave days do full-...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Alice (Eng)) | `What is the monthly wellness reimburseme...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Bob (Finance)) | `What is the monthly wellness reimburseme...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Carol (HR)) | `What is the monthly wellness reimburseme...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Human Resources Permitted (Admin) | `What is the monthly wellness reimburseme...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |
| Cross-Tenant Forbidden (Mallory (Attacker)) | `What is the monthly wellness reimburseme...` | `1.00` | `1.00` | `1.00` | `1.00` | `0` | **PASSED** |

*(Showing 50 of 200 total benchmark test runs. Full record available in JSON logs.)*

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
