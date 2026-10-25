# VaultRAG — Current State

**Active Milestone:** Milestone 6 — Admin UX & Access Explorer
**Active Phase:** 06-admin-access-explorer
**Status:** Ready to Plan

## Completed Phases
- **M0**: Foundations (Docker Compose, Postgres, Redis, Django, Next.js)
- **M1**: Auth & Tenancy (`accounts`, `tenants`, JWT claims, `UserContext`)
- **M2**: Multimodal Ingestion (Tables, vector clustering, VLM captions, Nemotron-3 1B halfvec embeddings)
- **M3**: Permissions Engine (Single source of truth ACL matrix)
- **M4**: Filtered Retrieval & Chat (LangChain LCEL chain with Llama 3.2 11B Vision, SSE streaming, Anti-Leak Shield)
- **M5**: PostgreSQL RLS & Audit Hardening (`FORCE ROW LEVEL SECURITY`, `TenantContextMiddleware`, trigger-enforced append-only `AuditLog`, full event wiring in chat/docs/auth, `/audit` viewer dashboard)

## Next Focus
Execute Phase 6 (Admin UX & Access Explorer):
1. Tenant admin screens for user & group membership management.
2. Interactive Access Explorer: inspect exactly which documents any user can access and the exact policy rule explaining why.

