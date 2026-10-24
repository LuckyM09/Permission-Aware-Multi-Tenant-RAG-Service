# VaultRAG — Current State

**Active Milestone:** Milestone 5 — PostgreSQL RLS, Append-Only Audit Logging & Hardening
**Active Phase:** 05-rls-audit-hardening
**Status:** In Planning

## Completed Phases
- **M0**: Foundations (Docker Compose, Postgres, Redis, Django, Next.js)
- **M1**: Auth & Tenancy (`accounts`, `tenants`, JWT claims, `UserContext`)
- **M2**: Multimodal Ingestion (Tables, vector clustering, VLM captions, Nemotron-3 1B halfvec embeddings)
- **M3**: Permissions Engine (Single source of truth ACL matrix)
- **M4**: Filtered Retrieval & Chat (LangChain LCEL chain with Llama 3.2 11B Vision, SSE streaming, Anti-Leak Shield)

## Next Focus
Execute Phase 5:
1. Implement `audit` Django app with append-only `AuditLog` model.
2. Revoke `UPDATE` and `DELETE` on `audit_auditlog` for `vaultrag_app` user.
3. Add PostgreSQL raw-SQL migration with `FORCE ROW LEVEL SECURITY` on `documents_document` and `documents_chunk`.
4. Implement database middleware executing `set_config('app.tenant_id', ...)` per request.
5. Build Audit Log viewer UI in the frontend.
