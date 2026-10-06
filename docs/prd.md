# Product Requirements Document (PRD)

## Project: VaultRAG — Permission-Aware Multi-Tenant RAG Service

---

### 1. Executive Summary & Vision

Most modern Enterprise Retrieval-Augmented Generation (RAG) implementations fail in production for one glaring reason: **retrieval systems are built without access control, transforming the retrieval pipeline and LLM into a data exfiltration vector.** In an enterprise environment, handing unauthorized context to an LLM cannot be repaired by system prompts or output filters.

**VaultRAG** is a production-grade, multi-tenant document intelligence platform engineered from the ground up on the principle of **Access Control by Design**. Chunks, documents, and vector similarity queries are strictly partitioned by tenant and evaluated against verified role- and group-based access control (RBAC/ACL) lists directly inside the database retrieval query. With secondary database-enforced Row-Level Security (RLS) and an append-only audit trail, VaultRAG delivers zero cross-tenant and zero cross-user information leakage.

---

### 2. Problem Statement & Value Proposition

#### The Problem
- **Naïve RAG Leaks Data**: Generic "chat with your document" architectures ingest files into a flat vector index. If a regular employee asks about executive compensation or unannounced acquisition plans, a vector similarity match retrieves those chunks and the LLM summarizes them.
- **Post-Filtering Fails**: Filtering results *after* vector search causes top-$k$ starvation (retrieving 10 chunks, filtering out 9 unauthorized ones, leaving inadequate context) and risks leaking existence of confidential documents.
- **Stale ACLs in Vector Databases**: Baking permission lists into vector metadata without atomic update capabilities creates desynchronization when users leave teams or documents are revoked.

#### The Value Proposition
- **Guaranteed Isolation**: Hardware/database-level isolation (Postgres RLS) combined with query-time SQL pre-filtering.
- **Immediate Permission Lifecycle**: Group revocation, document deletion, or visibility changes take effect on the very next query without re-indexing vector embeddings.
- **Provable Compliance**: Complete transparency with an immutable audit log detailing every query, retrieved chunk, and denied chunk count.
- **Verified Zero-Leakage**: An adversarial CI test suite actively attempting cross-tenant, cross-group, IDOR, and prompt injection attacks.

---

### 3. User Personas & Roles

| Role | Target Persona | Responsibilities & Capabilities |
|---|---|---|
| **Platform Admin** *(Optional)* | Platform Engineer / SRE | Manages tenant provisioning, monitors system health, database metrics, and global error rates. **Never** has read access to tenant documents or embeddings. |
| **Tenant Admin** | Department Head / Security Lead | Manages users and groups in their tenant, assigns roles, configures document visibility, inspects audit logs, and uses the **Access Explorer** to audit user access. |
| **Member** | Knowledge Worker / Analyst | Uploads documents, manages sharing for documents they own, creates and joins authorized groups, and interacts with the Q&A chat. |
| **Viewer** | Auditor / Guest / Read-Only Staff | Interacts with the Q&A chat, queries permitted tenant-wide or assigned group documents, and views citations. Cannot upload or share documents. |

---

### 4. User Journeys & Core Workflows

#### 4.1 Tenant Onboarding & Team Setup
1. A Tenant Admin logs into VaultRAG.
2. The Admin creates user accounts and groups (e.g., `Engineering`, `Human Resources`, `Finance`).
3. Members are assigned to their respective groups.

#### 4.2 Document Ingestion & Access Assignment
1. An HR Member uploads `Q4_Salary_Bands.pdf`.
2. The file is validated (MIME/content sniffing, max size limit) and uploaded to private object storage.
3. The member sets visibility to `Group` and selects the `Human Resources` group.
4. Background Celery workers parse, chunk, compute vector embeddings, and store chunks with foreign keys to the document and tenant.
5. Ingestion status transitions from `Uploaded` → `Processing` → `Ready`.

#### 4.3 Permission-Aware Querying
1. An Engineering Member asks: *"What is the salary band for senior staff?"*
   - Query converts verified JWT to `UserContext(tenant_id, user_id, groups=['Engineering'])`.
   - SQL Pre-filter searches only `Engineering` or `Tenant-wide` documents.
   - Result: 0 chunks retrieved. LLM responds: *"I do not have access to any documents containing information about salary bands."*
   - Audit log records query with 0 retrieved chunks and 1+ denied candidate chunks.
2. An HR Member asks the exact same question:
   - `UserContext` includes `Human Resources`.
   - SQL Pre-filter matches `Q4_Salary_Bands.pdf`.
   - Chunks are fed into context; LLM streams answer with exact document citations.

#### 4.4 Instant Access Revocation
1. Admin removes the user from the `Human Resources` group.
2. The user immediately re-runs the same salary query.
3. On the very next request, the updated token/session evaluates the new group membership.
4. Query fails to retrieve the document; answer is denied instantly without regenerating index embeddings.

---

### 5. Functional Requirements

#### Module 1: Authentication & Tenancy (`accounts`, `tenants`)
- **FR-1.1**: Authenticate users via email and password using Django REST Framework and SimpleJWT.
- **FR-1.2**: Tokens must encapsulate verified claims: `user_id`, `tenant_id`, and `role`.
- **FR-1.3**: Next.js BFF (Backend-for-Frontend) must store JWTs inside secure, `HttpOnly`, `SameSite=Strict` cookies.
- **FR-1.4**: Requests must construct an immutable `UserContext` instance containing `tenant_id`, `user_id`, `role`, and active `group_ids`.
- **FR-1.5**: Support a development-only **User Switcher** to demonstrate permission variances in real-time.

#### Module 2: Document Ingestion Pipeline (`documents`, `ingestion`)
- **FR-2.1**: Support ingestion of PDF, DOCX, Markdown, and TXT files.
- **FR-2.2**: Validate file integrity via magic bytes (content-type sniffing) and enforce size limits (e.g., 25MB max).
- **FR-2.3**: Generate SHA-256 content hashes to prevent duplicate file uploads within a tenant.
- **FR-2.4**: Store raw files in private S3/MinIO buckets with short-lived presigned URLs.
- **FR-2.5**: Celery task pipeline must execute: Extract text → Chunk (recursive token/character splitting with overlap) → Generate Embeddings → Transactionally insert chunks into Postgres.
- **FR-2.6**: Expose document statuses: `uploaded`, `processing`, `ready`, `failed` (with descriptive error logs).

#### Module 3: Access Control & Permissions Engine (`permissions`)
- **FR-3.1**: Support three document visibility tiers:
  - `private`: Accessible exclusively by the document owner and Tenant Admins.
  - `group`: Accessible by members of groups explicitly mapped via `document_permissions`.
  - `tenant`: Accessible by all active users belonging to the tenant.
- **FR-3.2**: Provide a single authoritative permission service used universally by retrieval, document listing, citation verification, and administrative audit.
- **FR-3.3**: Cascade deletions: deleting a document immediately purges its metadata, chunks, vector embeddings, and storage objects.

#### Module 4: Filtered Retrieval & Chat Engine (`retrieval`, `chat`)
- **FR-4.1**: Disallow vector retrieval execution if `UserContext` is missing or unverified.
- **FR-4.2**: Execute SQL pre-filtering directly within pgvector queries using cosine distance or inner product over HNSW indices.
- **FR-4.3**: Integrate iterative index scans to avoid top-$k$ starvation on filtered queries.
- **FR-4.4**: Assemble LLM prompts with strict delimiter fencing (`<context>...</context>`) and system instructions to answer strictly from provided chunks.
- **FR-4.5**: Enforce that citations in LLM responses map only to chunk IDs present in the permitted retrieval payload.
- **FR-4.6**: Stream responses to the UI via Server-Sent Events (SSE).
- **FR-4.7**: Persist conversation threads and message histories scoped strictly to `(tenant_id, user_id)`.

#### Module 5: Audit & Governance (`audit`)
- **FR-5.1**: Log every search/chat query to an append-only `audit_logs` table.
- **FR-5.2**: Capture `tenant_id`, `user_id`, query string, retrieved chunk IDs, count of denied candidate chunks, client IP, and timestamp.
- **FR-5.3**: Restrict database permissions on `audit_logs` so the application user cannot `UPDATE` or `DELETE` records.
- **FR-5.4**: Expose an **Audit Log Viewer** for Tenant Admins with filters for date, user, document, and event type.
- **FR-5.5**: Provide an **Access Explorer** allowing Tenant Admins to inspect any user's effective permissions across all tenant documents with clear explanations.

---

### 6. Non-Functional Requirements (NFR)

#### Security & Compliance
- **NFR-S1 (Zero Leakage)**: Adversarial test suite must report 0 leaks across cross-tenant, cross-user, IDOR, and prompt injection tests in CI.
- **NFR-S2 (Defense in Depth)**: Postgres Row-Level Security (`FORCE ROW LEVEL SECURITY`) must act as a fail-closed backstop even if application-level filtering is bypassed.
- **NFR-S3 (Safe Context)**: Database connection pooling must use transaction-local settings (`set_config('app.tenant_id', ..., true)`) to prevent cross-request session leakage.
- **NFR-S4 (Anti-Enumeration)**: Object endpoints must return HTTP 404 (Not Found) rather than 403 (Forbidden) when unauthorized IDs are requested.
- **NFR-S5 (Data Privacy in Logs)**: Never log raw document chunk text or sensitive user credentials in application logs or external tracing tools.

#### Performance & Scalability
- **NFR-P1 (Chat Latency)**: Time-to-first-token (TTFT) under 1.5 seconds; complete retrieval phase under 250ms for 100k chunks.
- **NFR-P2 (Ingestion Throughput)**: Ingest, chunk, and embed a 50-page document within 30 seconds.
- **NFR-P3 (Filter Overhead)**: Pre-filtering vector search latency overhead must not exceed 25% compared to unfiltered vector search.

#### Reliability & Availability
- **NFR-R1**: Celery workers must support idempotent retries with exponential backoff for failed embedding or ingestion tasks.
- **NFR-R2**: Graceful degradation: clear, actionable error messaging if third-party LLM or embedding APIs experience outages or rate limits.

---

### 7. Success Metrics & KPIs

1. **Leakage Rate**: **0.0%** (zero cross-tenant or cross-group leakage in automated adversarial CI tests).
2. **Permission Propagation Latency**: **< 100ms** (instant reflection of permission changes on the next query).
3. **Retrieval Precision & Faithfulness**: Evaluated via RAGAS scoring:
   - Faithfulness: > 0.90
   - Answer Relevance: > 0.85
   - Context Precision: > 0.88
4. **Test Coverage**: > 85% backend unit/integration coverage, 100% coverage of the permission matrix and leakage suite.

---

### 8. Scope & Milestones Overview

- **In Scope (MVP)**:
  - Multi-tenant auth with JWT & httpOnly cookies.
  - Document upload, async Celery ingestion, pgvector storage.
  - RBAC & group ACL permission engine.
  - Vector pre-filtering with HNSW iterative scans.
  - Streaming chat with citation side-panel.
  - Postgres RLS backstop.
  - Append-only audit logging & Access Explorer.
  - CI-integrated adversarial leakage suite.
- **Out of Scope (v1)**:
  - Custom model fine-tuning.
  - SAML/SSO enterprise directory sync (Okta/Azure AD).
  - Multi-user collaborative document editing.
- **Stretch Goals (Post-MVP)**:
  - Hybrid search (BM25 full-text + vector) with Reciprocal Rank Fusion.
  - Permission-scoped semantic caching.
  - Presidio PII redaction and ingestion-time prompt injection scanner.
