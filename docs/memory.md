# Project Memory & Knowledge Context

## Project: VaultRAG — Permission-Aware Multi-Tenant RAG Service

---

### 1. Project Identity & Elevator Pitch

- **Project Name**: VaultRAG (Permission-Aware Multi-Tenant RAG Service)
- **Repository Layout**: Monorepo (`backend/`, `frontend/`, `infra/`, `docs/`)
- **Primary Goal**: Deliver a production-grade multi-tenant document Q&A service where access control is enforced **by design**. Every chunk retrieval is strictly evaluated against user role and group permissions inside the database vector query, backed by PostgreSQL Row-Level Security (RLS) and verified by an automated adversarial CI leakage test suite.
- **Resume Impact**: Demonstrates deep systems engineering across distributed systems, vector database internals (pgvector HNSW pre-filtering), enterprise multi-tenancy, database security (RLS), and automated adversarial testing.

---

### 2. Technology Stack & Key Libraries

| Domain | Technology / Library | Purpose / Rationale |
|---|---|---|
| **Backend Framework** | Django 5 + Django REST Framework | Mature ORM, custom user model, robust migration engine, battle-tested security. |
| **Authentication** | SimpleJWT + Next.js BFF Route Handlers | Stateless JWT verification in backend; tokens wrapped in `HttpOnly`, `SameSite=Strict` cookies in Next.js. |
| **Database & Vectors** | PostgreSQL 16+ with `pgvector` | Native relational joins between document ACLs and vector embeddings; HNSW index with iterative scan; Row-Level Security. |
| **Async Processing** | Celery 5 + Redis | Resilient background file parsing, token chunking, and embedding generation with retry/backoff. |
| **Object Storage** | MinIO (local dev) / S3 (production) | Private, encrypted storage for raw uploaded files; presigned URL access only. |
| **Document Parsing** | PyMuPDF / Unstructured | Reliable extraction of text from `.pdf`, `.docx`, `.md`, `.txt` validated by magic bytes. |
| **Frontend Framework** | Next.js (App Router, TypeScript) | React Server Components, Server-Sent Events (SSE) streaming proxy, fast layout rendering. |
| **UI Components** | shadcn/ui + Tailwind / CSS Tokens + TanStack Table | High-density enterprise tables (Audit Log, Documents), sleek dark mode, accessible dialogs. |
| **Evaluation & QA** | pytest, pytest-django, RAGAS, Playwright | Unit/integration testing, RAG quality scoring (faithfulness, precision), adversarial leakage test suite. |

---

### 3. Core Architectural Invariants (Unbreakable Rules)

1. **Retrieval Requires `UserContext`**:
   `retrieve(user_ctx: UserContext, query: str, ...)` cannot be executed without a validated `UserContext`. No optional arguments, no defaults.
2. **Tokens are the Sole Source of Identity**:
   Identity claims (`user_id`, `tenant_id`, `role`) are derived exclusively from the verified JWT signature. Client-supplied headers or body parameters for tenant/user are ignored.
3. **Pre-Filtering Only**:
   Vector queries must include the tenant and group permission predicate in the SQL `WHERE` clause. Post-filtering vector results in application memory is prohibited.
4. **Single Source of Permission Truth**:
   All components (retrieval, document lists, citations, Access Explorer) must call `permissions.service.get_permitted_documents_q()`.
5. **Postgres RLS Defense-in-Depth**:
   Tables have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Application connects as non-superuser/non-owner role `vaultrag_app`.
6. **Transaction-Scoped Tenant Context**:
   Tenant context in database connections is set using `SELECT set_config('app.tenant_id', %s, true)` within atomic transactions. A query with no context set returns **zero rows**.
7. **Zero-Enumeration (404 over 403)**:
   Inaccessible or cross-tenant objects return HTTP 404 rather than 403 to prevent object existence enumeration.
8. **No Document Text in Logs or Traces**:
   Raw text of documents, chunks, and sensitive user queries must never be logged or sent to unredacted external APM/trace collectors.

---

### 4. Key Architectural Decisions & Trade-Offs

| Decision | Chosen Approach | Alternative Considered | Why We Chose It |
|---|---|---|---|
| **Multi-Tenancy Model** | Shared DB, Shared Schema with RLS | Database-per-tenant or Schema-per-tenant | Massive operational overhead with 100+ schemas/databases; shared schema with RLS and pre-filtering achieves enterprise isolation with simple migrations and pooling. |
| **Vector Filtering** | SQL Pre-filtering via pgvector | Post-filtering in Python memory | Post-filtering causes severe top-$k$ starvation (retrieving 10 chunks, filtering out 9, leaving 1 chunk) and leaks confidential document existence. |
| **Permission Storage** | Relational join at query time | Denormalized ACL lists in vector metadata | Baking group lists into vector metadata causes stale permissions when users leave groups or documents change visibility; relational joins are authoritative at query time. |
| **Vector Search Tuning** | HNSW with Iterative Scan (`relaxed_order`) | Exact IVFFlat or plain HNSW | Standard HNSW can terminate early when heavily filtered; iterative scan explores the graph until $k$ authorized neighbors are found. |
| **Audit Log Security** | SQL privilege revocation on table | Application-level read-only checks | Application bugs or compromised credentials could modify logs; revoking `UPDATE` and `DELETE` at the PostgreSQL role level guarantees an append-only audit trail. |

---

### 5. Roadmap & Milestone Progress

- [ ] **M0 — Foundations**: Monorepo layout, Docker Compose (Postgres+pgvector, Redis, MinIO, Django, Next.js), base settings, CI pipeline.
- [ ] **M1 — Auth & Tenancy**: Custom user model, SimpleJWT with tenant claims, Next.js httpOnly BFF, tenant-scoped managers, dev user switcher.
- [ ] **M2 — Document Ingestion**: Upload endpoint, magic byte validation, Celery pipeline (parse -> chunk -> embed -> write), deduplication.
- [ ] **M3 — Access Control & Permissions**: Visibility tiers (`private`, `group`, `tenant`), `document_permissions` table, `permissions` service, test matrix.
- [ ] **M4 — Filtered Retrieval & Chat**: Pre-filtered pgvector search, prompt assembly, citation mapping, SSE streaming, conversation persistence.
- [ ] **M5 — RLS, Audit & Hardening**: Postgres `FORCE RLS`, append-only audit logger, revocation handling, rate limiting, security headers.
- [ ] **M6 — Admin UX & Access Explorer**: Users & groups screens, Access Explorer dual-matrix UI, audit log query inspector.
- [ ] **M7 — Adversarial Testing & Evaluation**: 12-category adversarial leakage suite in CI (0 leaks), RAGAS evaluation metrics report.
- [ ] **M8 — Production Readiness & Deployment**: Multi-stage Dockerfiles, Gunicorn/Uvicorn, health checks, secrets management, load testing.
- [ ] **M9 — Documentation & Demo**: Portfolio-ready README, architecture diagrams, demo video script, verifiable benchmark claims.

---

### 6. Domain Glossary & Key Terms

- **`UserContext`**: Immutable data structure (`tenant_id`, `user_id`, `role`, `group_ids`) created per request upon validating the user's JWT.
- **Pre-Filtering**: Injecting SQL access conditions (`WHERE tenant_id = ... AND (...)`) directly into the vector similarity query before ranking top-$k$ results.
- **Top-$k$ Starvation**: The failure mode of post-filtering where vector similarity retrieves $k$ results, but access control filters out most/all of them, starving the LLM of context.
- **Iterative Index Scan**: A pgvector feature that continues traversing the HNSW graph until the target number of items passing the `WHERE` filter are located.
- **Row-Level Security (RLS)**: PostgreSQL engine feature that restricts which rows a database query can view or modify based on session policies.
- **`FORCE ROW LEVEL SECURITY`**: Postgres directive ensuring that table owners or application roles cannot bypass RLS policies.
- **Access Explorer**: An administrative tool in VaultRAG that visualizes and explains why a specific user can or cannot access any document in the tenant.
- **Leakage Suite**: An automated test harness executing adversarial attacks (cross-tenant queries, IDOR, prompt injection, stale cache tests) with a mandatory score of 0 leaks.

---

### 7. Current Project State & Next Steps

- **Completed**:
  - `docs/plan.md`: Comprehensive 8-week project master plan.
  - `docs/prd.md`: Product Requirements Document (features, personas, user journeys, NFRs).
  - `docs/architecture.md`: Complete system architecture, data models, Mermaid diagrams, RLS design, and ingestion sequence.
  - `docs/rules.md`: Coding standards, 8 golden invariants, backend/frontend guidelines, testing standards.
  - `docs/design.md`: UI/UX direction, design system tokens, screen layouts (Chat, Documents, Access Explorer, Audit Log).
  - `docs/memory.md`: Complete project context, decision records, invariants, and domain dictionary.
- **Immediate Next Step**:
  - Scaffold **Milestone 0 (M0 - Foundations)**: Monorepo directory structure, Docker Compose configuration (`docker-compose.yml`), Django backend initialization, and Next.js frontend setup.
