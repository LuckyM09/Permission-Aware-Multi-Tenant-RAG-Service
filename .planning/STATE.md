# VaultRAG — Current State

**Active Milestone:** Milestone 8 — Production Readiness & Observability
**Active Phase:** 08-production-observability
**Status:** Ready to Plan

## Completed Phases
- **M0**: Foundations (Docker Compose, Postgres, Redis, Django, Next.js)
- **M1**: Auth & Tenancy (`accounts`, `tenants`, JWT claims, `UserContext`)
- **M2**: Multimodal Ingestion (Tables, vector clustering, VLM captions, Nemotron-3 1B halfvec embeddings)
- **M3**: Permissions Engine (Single source of truth ACL matrix)
- **M4**: Filtered Retrieval & Chat (LangChain LCEL chain with Llama 3.2 11B Vision, SSE streaming, Anti-Leak Shield)
- **M5**: PostgreSQL RLS & Audit Hardening (`FORCE ROW LEVEL SECURITY`, `TenantContextMiddleware`, trigger-enforced append-only `AuditLog`, full event wiring in chat/docs/auth, `/audit` viewer dashboard)
- **M6**: Admin UX & Access Explorer (Tenant member & role management, permission groups CRUD, interactive visual Access Explorer simulation)
- **M7**: Adversarial Testing Suite & RAGAS Evaluation (12-category automated penetration suite, zero-leakage verification, automated benchmark command emitting `docs/eval_report.md`)

## Next Focus
Execute Phase 8 (Production Readiness & Observability):
1. Multi-stage non-root Dockerfiles (`Dockerfile.prod` for backend & frontend).
2. Production security settings (HSTS, secure cookies, CORS, CSP headers).
3. DRF API rate throttling (anon, authenticated, chat, search).
4. Kubernetes / Docker health probes (`/healthz` liveness, `/readyz` readiness).
5. Sentry error tracking & structured JSON logging.
