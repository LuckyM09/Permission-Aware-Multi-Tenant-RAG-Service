# Engineering Standards & Coding Rules

## Project: VaultRAG — Permission-Aware Multi-Tenant RAG Service

---

### 1. The 8 Golden Non-Negotiable Invariants

All engineers, contributors, and automated agents working on VaultRAG must adhere to these 8 foundational rules:

1. **Retrieval NEVER Runs Without a `UserContext`**:
   The `retrieve(user_ctx, query, ...)` function must require an explicit, validated `UserContext` parameter. No default arguments, no fallback contexts, and no anonymous access are permitted. Calling retrieval without `UserContext` must throw a hard runtime error.
2. **Identity Originates Exclusively from Verified Tokens**:
   Never trust `tenant_id`, `user_id`, or `role` supplied in request bodies, URL query parameters, or client-controlled headers. Identity is established solely by decoding and validating the cryptographic signature of the JWT.
3. **Pre-Filtering Only — Never Post-Filter**:
   Permission checks must occur *inside* the database vector similarity query (`WHERE` clause), never in application memory after retrieval. Post-filtering vector results leads to top-$k$ starvation and confidentiality leaks.
4. **Single Source of Truth for Permissions**:
   The `permissions` module (`permissions.service.get_permitted_documents_q`) is the only authority on whether a user can access a document. Retrieval, document listing, citations, and the Access Explorer must invoke this single logic path.
5. **Defense-in-Depth with Postgres RLS**:
   PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`) must be enabled on all tenant models. Application-level filtering and database RLS must mutually reinforce tenant isolation.
6. **Query-Time Permissions Are Authoritative**:
   Never bake permission lists or ACL groups into vector index metadata where they can become desynchronized. Access permissions are evaluated dynamically at query execution time.
7. **Zero-Enumeration (Return 404, Not 403)**:
   When an object is requested by ID (e.g., `/api/v1/documents/<uuid>/`) that belongs to another tenant or is inaccessible to the current user, return **HTTP 404 (Not Found)** rather than HTTP 403 (Forbidden) to prevent object ID enumeration attacks.
8. **No Sensitive Document Text in Logs or Traces**:
   Never write document chunk text, raw prompt context, or user embeddings to standard application logs or external tracing providers (e.g., Sentry, LangSmith). Log only chunk UUIDs, execution latencies, and metadata.

---

### 2. Backend Architecture Rules (Django 5 & DRF)

#### 2.1 App Structure & Modularity
The backend is partitioned into single-responsibility Django apps:
- `accounts`: Custom user model, authentication endpoints, JWT tokens, `UserContext` resolution.
- `tenants`: Tenant entities, memberships, organizational groups, group memberships.
- `documents`: Document metadata, file upload handling, visibility tiers, ACL records.
- `ingestion`: Celery task definitions for file parsing, text chunking, and embedding generation.
- `permissions`: Authoritative permission queries and access evaluation engine.
- `retrieval`: Pre-filtered pgvector search pipelines and iterative index scan configuration.
- `chat`: Conversations, messages, prompt assembly, citation verification, and SSE streaming.
- `audit`: Append-only audit trail logging and admin query endpoints.

#### 2.2 Model Architecture & Tenant Scoping
- **Primary Keys**: All database models must use UUIDv4 primary keys (`id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`).
- **Tenant Scoping**: All tenant-bound models must include a non-nullable foreign key to `tenants.Tenant` with `on_delete=models.CASCADE` and a database index:
  ```python
  tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='%(class)ss', db_index=True)
  ```
- **Custom Managers**: Direct calls to `Model.objects.all()` without tenant filtering are strictly banned in API views. Models must implement a `TenantScopedManager`:
  ```python
  class TenantScopedQuerySet(models.QuerySet):
      def for_tenant(self, tenant_id: UUID):
          return self.filter(tenant_id=tenant_id)

  class TenantScopedManager(models.Manager):
      def get_queryset(self):
          return TenantScopedQuerySet(self.model, using=self._db)
      
      def for_tenant(self, tenant_id: UUID):
          return self.get_queryset().for_tenant(tenant_id)
  ```

#### 2.3 Row-Level Security (RLS) & Transaction Safety
- Database connections run under the unprivileged role `vaultrag_app`.
- Every request that touches tenant data must execute within a database transaction where the tenant context is set using `set_config`:
  ```python
  from django.db import connection

  def set_tenant_context(tenant_id: UUID):
      with connection.cursor() as cursor:
          cursor.execute("SELECT set_config('app.tenant_id', %s, true);", [str(tenant_id)])
  ```
- The third argument (`true`) is mandatory, ensuring the setting is local to the current transaction (`is_local = true`).

#### 2.4 Serializers & API Contracts
- Serializers must explicitly declare `fields`. Never use `fields = '__all__'`.
- Fields such as `tenant`, `owner`, `created_at`, and `updated_at` must always be marked `read_only=True`.
- Validate all incoming file types using file magic bytes (`python-magic` or `filetype`), not the user-supplied filename extension.

---

### 3. Frontend Architecture Rules (Next.js & TypeScript)

#### 3.1 Backend-for-Frontend (BFF) Pattern
- The browser must never directly communicate with third-party AI APIs or hold unencrypted JWT tokens in `localStorage`.
- All authentication tokens must be stored in secure, `HttpOnly`, `SameSite=Strict` cookies managed by Next.js Route Handlers (`/api/auth/*`).
- Next.js Route Handlers act as a reverse proxy, injecting `Authorization: Bearer <token>` into outbound Django API requests.

#### 3.2 TypeScript & Code Quality
- Strict TypeScript mode enabled (`"strict": true`). The use of `any` is forbidden; use `unknown` with type guards or explicit interfaces.
- Component props must be typed with explicit interfaces (e.g., `interface ChatPanelProps { ... }`).
- Handle all component states: `idle`, `loading`, `streaming`, `error`, and `empty`.

#### 3.3 UI Component Standards
- Build with **shadcn/ui** and **Tailwind CSS / Vanilla CSS** tokens.
- Use **TanStack Table** for all administrative data grids (Audit Logs, Document Lists, User Rosters) with server-side pagination, sorting, and filtering.
- Implement streaming using the native `EventSource` API or `fetch` with `ReadableStreamDefaultReader` for Server-Sent Events (SSE).

---

### 4. Celery & Asynchronous Task Rules

1. **Task Idempotency**:
   Ingestion tasks must be safe to retry multiple times without producing duplicate chunks or corrupted state. Tasks must use document `content_hash` and clean up previous incomplete chunk runs before inserting new ones.
2. **Exponential Backoff**:
   All external API calls (e.g., embedding generation) must be wrapped with Celery retry logic:
   ```python
   @shared_task(bind=True, max_retries=3, default_retry_delay=5)
   def ingest_document_task(self, document_id: str):
       try:
           ...
       except (ProviderAPIError, RateLimitError) as exc:
           raise self.retry(exc=exc, countdown=2 ** self.request.retries * 5)
   ```
3. **Transaction Integrity**:
   Chunks and document status updates must be committed in a single atomic database transaction (`with transaction.atomic():`). A failure at any point must roll back chunk insertions and set `status = 'failed'`.

---

### 5. Database & Migration Standards

1. **Raw SQL Migrations for RLS**:
   PostgreSQL RLS policies, custom roles, and pgvector HNSW indices must be managed through standard Django migrations using `migrations.RunSQL`:
   ```python
   migrations.RunSQL(
       sql="""
       ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
       ALTER TABLE documents FORCE ROW LEVEL SECURITY;
       CREATE POLICY doc_tenant_policy ON documents FOR ALL TO vaultrag_app
           USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
       """,
       reverse_sql="""
       DROP POLICY IF EXISTS doc_tenant_policy ON documents;
       ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
       """
   )
   ```
2. **Index Optimization**:
   Vector columns must have an HNSW index created using `vector_cosine_ops`:
   ```sql
   CREATE INDEX idx_chunks_embedding_hnsw ON chunks 
   USING hnsw (embedding vector_cosine_ops) 
   WITH (m = 16, ef_construction = 64);
   ```

---

### 6. Testing & Quality Assurance Rules

#### 6.1 Testing Pyramid
- **Unit Tests**: Test permission predicates, serialization, text splitting, and token generation in isolation.
- **Integration Tests**: Test API endpoints with real database transactions, RLS policy enforcement, and Celery tasks.
- **The Adversarial Leakage Suite**: Must run on every pull request and commit in CI. **Zero failures allowed.**

#### 6.2 Test Matrix Checklist
Every permission-relevant feature must have tests asserting all quadrants of the access matrix:
- [ ] Tenant A user asks about Tenant A document (Permitted)
- [ ] Tenant B user asks about Tenant A document (Denied - Zero chunks, zero citations)
- [ ] Tenant A user without group asks about Group document (Denied)
- [ ] Tenant A user in group asks about Group document (Permitted)
- [ ] User removed from group re-asks query (Immediately Denied)
- [ ] Document deleted by owner (Immediately Denied for all users)
- [ ] Document visibility switched from `tenant` to `private` (Immediately Denied for other users)
- [ ] Direct query to `chunks` table without `app.tenant_id` session setting (Returns 0 rows)

---

### 7. Code Formatting & Git Hygiene

- **Python**: Formatted with `black` (88 chars) and linted with `ruff`. Type checks with `mypy --strict`.
- **TypeScript**: Formatted with `prettier` and linted with `eslint`.
- **Git Commit Conventions**: Use Conventional Commits:
  - `feat(retrieval): implement iterative HNSW pre-filtered vector scan`
  - `fix(permissions): invalidate cached group permissions on membership change`
  - `sec(rls): add force row level security migration on chunks table`
  - `test(leakage): add cross-tenant prompt injection attack test`
