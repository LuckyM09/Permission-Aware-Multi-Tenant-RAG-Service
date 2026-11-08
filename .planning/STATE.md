# VaultRAG — Current State

**Active Milestone:** All Milestones Complete (M0 - M9)
**Active Phase:** Complete
**Status:** Shipped & Verified

## Completed Milestones
- **M0**: Foundations (Docker Compose, Postgres, Redis, Django, Next.js)
- **M1**: Auth & Tenancy (`accounts`, `tenants`, JWT claims, `UserContext`)
- **M2**: High-Fidelity Ingestion (PyMuPDF layout-aware tables & text, Unstructured parser, Nemotron-3 1B pgvector embeddings, async Celery pipeline)
- **M3**: Permissions Engine (Single source of truth ACL matrix)
- **M4**: Filtered Retrieval & Chat (LangChain LCEL chain with NVIDIA Nemotron 3.5, SSE streaming, Anti-Leak Shield)
- **M5**: PostgreSQL RLS & Audit Hardening (`FORCE ROW LEVEL SECURITY`, `TenantContextMiddleware`, trigger-enforced append-only `AuditLog`, full event wiring in chat/docs/auth, `/audit` viewer dashboard)
- **M6**: Admin UX & Access Explorer (Tenant member & role management, permission groups CRUD, interactive visual Access Explorer simulation)
- **M7**: Adversarial Testing Suite & RAGAS Evaluation (12-category automated penetration suite, zero-leakage verification, automated benchmark command emitting `docs/eval_report.md`)
- **M8**: Production Readiness & Observability (Multi-stage non-root Dockerfiles, Gunicorn WSGI, standalone Next.js 14, `/healthz` & `/readyz` probes, HSTS & secure cookies, DRF rate limiting, structured logging)
- **M9**: Documentation & Portfolio Showcase (Comprehensive portfolio README with Mermaid diagrams, 5-minute scripted demo walkthrough, evaluation benchmarks)
- **Security Audit Remediation**: Resolved external audit findings — runtime non-superuser RLS enforcement (`vaultrag_user` with `NOSUPERUSER NOBYPASSRLS`), dynamic `.sh` database initialization script supporting custom prod passwords, migration runner separation (`migrate` connects as admin role, runtime services connect as unprivileged role), Django RLS startup system check (`vaultrag.security.E001/E002`) triggered in WSGI `ready()` for Gunicorn, CI pipeline role provisioning, SSE generator tenant context lifecycle wrapping, API-level multi-tenant isolation tests, SimpleJWT refresh token blacklisting on logout, server-only dev switcher credentials, PostgreSQL lead persistence with anti-bot honeypots, and transparent benchmark reporting.
