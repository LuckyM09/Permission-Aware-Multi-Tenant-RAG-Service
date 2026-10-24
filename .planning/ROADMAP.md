# VaultRAG — Roadmap

## Milestones & Phases

- [x] **Phase 0: Foundations & Project Skeleton (M0)**
  - Monorepo layout, Docker Compose (Postgres+pgvector, Redis, Django, Next.js), base settings.
- [x] **Phase 1: Multi-Tenancy & Authentication (M1)**
  - Custom User model, Tenant, Membership, Groups, JWT with UserContext, DevUserSwitcher.
- [x] **Phase 2: Multimodal Document Ingestion (M2)**
  - PyMuPDF layout-aware table extraction, vector clustering, VLM captions with Llama 3.2 11B Vision, Nemotron embeddings (2048 dims, HNSW halfvec), Celery pipeline.
- [x] **Phase 3: Access Control & Permissions Engine (M3)**
  - Visibility rules (`private`, `group`, `tenant`), `document_permissions`, single source of truth authorization service, 100% passing test matrix.
- [x] **Phase 4: Filtered Retrieval & Chat Engine (M4)**
  - `VaultRAGRetriever` with SQL vector pre-filtering, LangChain LCEL chain with Llama 3.2 11B Vision, SSE streaming, citation side panel, Anti-Leak citation shield.
- [ ] **Phase 5: PostgreSQL RLS, Append-Only Audit Logging & Hardening (M5)** *(CURRENT)*
  - PostgreSQL `FORCE ROW LEVEL SECURITY` on documents and chunks using `app.tenant_id`.
  - Transaction-scoped connection middleware executing `set_config('app.tenant_id', ...)`.
  - Append-only `audit_auditlog` table with revoked `UPDATE`/`DELETE` for `vaultrag_app`.
  - Audit logging API endpoints and frontend Audit Log viewer.
- [ ] **Phase 6: Admin UX & Access Explorer (M6)**
  - Tenant admin screens for user & group management.
  - Interactive Access Explorer: inspect exactly which documents any user can access and why.
- [ ] **Phase 7: Adversarial Testing Suite & RAGAS Evaluation (M7)**
  - 12-category automated adversarial leakage test suite (cross-tenant, cross-group, IDOR, prompt injection).
  - RAGAS evaluation metrics report (faithfulness, context precision, answer relevance).
- [ ] **Phase 8: Production Readiness & Observability (M8)**
  - Multi-stage non-root Dockerfiles, security headers, rate limiting, Sentry error tracking, health check endpoints.
- [ ] **Phase 9: Documentation & Portfolio Showcase (M9)**
  - System architecture diagram, design ADRs, benchmark results, scripted demo walkthrough.
