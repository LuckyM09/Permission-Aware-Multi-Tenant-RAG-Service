# System Architecture Document

## Project: VaultRAG — Permission-Aware Multi-Tenant RAG Service

---

### 1. High-Level System Architecture

VaultRAG utilizes a modern decoupled architecture featuring a **Next.js Backend-for-Frontend (BFF)**, a **Django REST Framework (DRF)** core application server, **PostgreSQL with pgvector and Row-Level Security (RLS)**, a **Celery/Redis** asynchronous worker pool, and private S3-compatible object storage.

```mermaid
flowchart TB
    subgraph ClientLayer [Client & Edge Layer]
        Browser["Web Browser (React / TypeScript)"]
        BFF["Next.js App Router (BFF)\n- Route Handlers\n- httpOnly Cookie Auth\n- SSE Stream Proxy"]
    end

    subgraph AppLayer [Application Core - Django / DRF]
        API["Django API Gateway"]
        AuthModule["accounts & tenants\n(JWT Validator & UserContext)"]
        PermEngine["permissions Service\n(Single Source of Truth)"]
        RetrievalEngine["retrieval Engine\n(Pre-filtered Vector Search)"]
        ChatEngine["chat Service\n(Prompt Assembly & Citations)"]
        AuditService["audit Logger\n(Append-Only Log Writer)"]
    end

    subgraph AsyncLayer [Async Processing & Storage]
        Redis["Redis\n(Celery Broker & Cache)"]
        CeleryWorker["Celery Ingestion Workers\n(Parse, Chunk, Embed)"]
        ObjectStore["Object Storage (MinIO / S3)\nPrivate Encrypted Bucket"]
    end

    subgraph DataLayer [Database & AI Engine]
        Postgres[("PostgreSQL 16 + pgvector\n- HNSW Index\n- Row-Level Security (FORCE RLS)\n- Transaction Context")]
        LLMAdapter["AI Provider Adapter\n(OpenAI / Anthropic / Local Embeddings)"]
    end

    Browser <-->|HTTPS / SSE| BFF
    BFF <-->|API Calls with Bearer JWT| API
    API --> AuthModule
    AuthModule --> PermEngine
    API --> RetrievalEngine
    API --> ChatEngine
    API --> AuditService

    RetrievalEngine --> PermEngine
    RetrievalEngine -->|Pre-filtered SQL query| Postgres
    ChatEngine -->|Prompt + Permitted Chunks| LLMAdapter
    AuditService -->|Append Only| Postgres

    API -->|Upload Document| ObjectStore
    API -->|Enqueue Ingestion| Redis
    Redis <--> CeleryWorker
    CeleryWorker <-->|Read File| ObjectStore
    CeleryWorker -->|Generate Vectors| LLMAdapter
    CeleryWorker -->|Write Chunks & Embeddings| Postgres
```

---

### 2. Multi-Tenancy Strategy

VaultRAG implements a **Shared Database, Shared Schema with Tenant Discriminator Column** model. This provides the ideal balance of resource efficiency, migration simplicity, and rapid cross-tenant operations while guaranteeing airtight isolation through **defense-in-depth**:

1. **Application-Layer Scoping**: Every database model possesses a `tenant_id` foreign key. Custom Django managers (`TenantScopedManager`) enforce `tenant_id` constraints on all queries by default.
2. **Pre-Filtering in Vector Space**: All vector queries incorporate the tenant and permission predicates directly into the SQL `WHERE` clause.
3. **Database-Level Row-Level Security (RLS)**: Postgres enforces `FORCE ROW LEVEL SECURITY` on all tenant-bound tables, bound to the transaction-local setting `app.tenant_id`. If the application fails to set context or omits a filter, Postgres returns **zero rows**.

---

### 3. Data Model & Entity Relationship

```mermaid
erDiagram
    TENANTS ||--o{ USERS : contains
    TENANTS ||--o{ MEMBERSHIPS : has
    USERS ||--o{ MEMBERSHIPS : holds
    TENANTS ||--o{ GROUPS : organizes
    GROUPS ||--o{ GROUP_MEMBERS : includes
    USERS ||--o{ GROUP_MEMBERS : belongs_to
    TENANTS ||--o{ DOCUMENTS : owns
    USERS ||--o{ DOCUMENTS : creates
    DOCUMENTS ||--o{ DOCUMENT_PERMISSIONS : defines
    GROUPS ||--o{ DOCUMENT_PERMISSIONS : grants
    DOCUMENTS ||--o{ CHUNKS : splits_into
    TENANTS ||--o{ CHUNKS : scopes
    TENANTS ||--o{ CONVERSATIONS : tracks
    USERS ||--o{ CONVERSATIONS : participates
    CONVERSATIONS ||--o{ MESSAGES : contains
    TENANTS ||--o{ AUDIT_LOGS : records
    USERS ||--o{ AUDIT_LOGS : triggers

    TENANTS {
        uuid id PK
        string name
        datetime created_at
    }

    USERS {
        uuid id PK
        string email UK
        string password_hash
        boolean is_active
        datetime created_at
    }

    MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid tenant_id FK
        string role "admin | member | viewer"
        datetime created_at
    }

    GROUPS {
        uuid id PK
        uuid tenant_id FK
        string name
        datetime created_at
    }

    GROUP_MEMBERS {
        uuid id PK
        uuid group_id FK
        uuid user_id FK
        datetime created_at
    }

    DOCUMENTS {
        uuid id PK
        uuid tenant_id FK
        uuid owner_id FK
        string title
        string visibility "private | group | tenant"
        string status "uploaded | processing | ready | failed"
        string storage_key
        string content_hash
        jsonb metadata
        datetime created_at
        datetime updated_at
    }

    DOCUMENT_PERMISSIONS {
        uuid id PK
        uuid document_id FK
        uuid group_id FK
        datetime created_at
    }

    CHUNKS {
        uuid id PK
        uuid tenant_id FK
        uuid document_id FK
        int position
        text text
        vector embedding "1536 dim"
        jsonb metadata
        datetime created_at
    }

    CONVERSATIONS {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        string title
        datetime created_at
        datetime updated_at
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        string role "user | assistant | system"
        text content
        uuid_array cited_chunk_ids
        datetime created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        string action "query | upload | share | revoke | delete"
        text query
        uuid_array retrieved_chunk_ids
        int denied_count
        string ip_address
        datetime created_at
    }
```

---

### 4. Permission Engine & Retrieval Pipeline

#### 4.1 The `UserContext` Object
Every incoming request authenticated by JWT is resolved into an immutable `UserContext` object in the request middleware:

```python
from dataclasses import dataclass
from uuid import UUID

@dataclass(frozen=True)
class UserContext:
    tenant_id: UUID
    user_id: UUID
    role: str  # "admin", "member", "viewer"
    group_ids: tuple[UUID, ...]  # Immutable tuple of active groups
```

> [!IMPORTANT]
> **Design Invariant**: Retrieval **cannot** run without a verified `UserContext`. No optional parameters and no default fallback contexts exist.

#### 4.2 Single Source of Truth for Permissions
The `permissions` app exposes a single unified query builder used across vector retrieval, document listing, sharing validation, and the Access Explorer:

```python
# permissions/service.py
from django.db.models import Q
from accounts.models import UserContext
from documents.models import Document

def get_permitted_documents_q(user_ctx: UserContext) -> Q:
    """Returns a Django Q object representing documents user_ctx is permitted to read."""
    # Tenant Admin has access to all tenant documents
    if user_ctx.role == "admin":
        return Q(tenant_id=user_ctx.tenant_id, status=Document.Status.READY)

    # Standard Member / Viewer permission predicate:
    return (
        Q(tenant_id=user_ctx.tenant_id)
        & Q(status=Document.Status.READY)
        & (
            Q(visibility=Document.Visibility.TENANT)
            | Q(owner_id=user_ctx.user_id)
            | (
                Q(visibility=Document.Visibility.GROUP)
                & Q(document_permissions__group_id__in=user_ctx.group_ids)
            )
        )
    )
```

#### 4.3 Vector Pre-Filtering vs Post-Filtering
```mermaid
flowchart LR
    subgraph NaivePostFiltering [Naive Post-Filtering - DANGEROUS]
        Q1[User Query] --> V1[Top-k Vector Search\nUnfiltered]
        V1 --> K1[10 Chunks Retrieved]
        K1 --> F1[ACL Check Filter]
        F1 --> R1[1 Chunk Left\nTop-k Starvation & Leak Risk]
    end

    subgraph VaultRAGPreFiltering [VaultRAG Pre-Filtering - BY DESIGN]
        Q2[User Query + UserContext] --> SQL2["Vector Search with SQL Predicate\nWHERE chunk.tenant_id = :tenant\nAND (doc.visibility = 'tenant' OR doc.owner = :user OR doc.group IN (:groups))"]
        SQL2 --> HNSW[HNSW Index Iterative Scan]
        HNSW --> R2[Top-k Permitted Chunks Retrieved\nZero Leakage & Full Context]
    end
```

**SQL Pre-Filter Implementation with `pgvector`**:
```sql
SELECT 
    c.id,
    c.document_id,
    c.text,
    c.metadata,
    1 - (c.embedding <=> :query_vector) AS similarity
FROM chunks c
INNER JOIN documents d ON c.document_id = d.id
WHERE c.tenant_id = :tenant_id
  AND d.status = 'ready'
  AND (
      d.visibility = 'tenant'
      OR d.owner_id = :user_id
      OR (
          d.visibility = 'group'
          AND EXISTS (
              SELECT 1 FROM document_permissions dp
              WHERE dp.document_id = d.id
                AND dp.group_id = ANY(:user_group_ids)
          )
      )
  )
ORDER BY c.embedding <=> :query_vector
LIMIT :top_k;
```

---

### 5. Postgres Row-Level Security (RLS) Architecture

As a second layer of defense (defense-in-depth), PostgreSQL Row-Level Security ensures that even if an application SQL injection or developer logic bug occurs, the database engine enforces tenant boundaries.

#### 5.1 Database Users & Separation of Duties
1. **Migration / Admin Role (`vaultrag_owner`)**: Owns tables, executes migrations, alters schema. Bypasses RLS.
2. **Runtime Application Role (`vaultrag_app`)**: Non-owner, non-superuser role used by Django. Subject to `FORCE ROW LEVEL SECURITY`.

#### 5.2 RLS Setup & Context Injection
```sql
-- Enable and force RLS on all tenant-bound tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks FORCE ROW LEVEL SECURITY;

-- Tenant Isolation Policy
CREATE POLICY document_tenant_isolation_policy ON documents
    FOR ALL
    TO vaultrag_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY chunk_tenant_isolation_policy ON chunks
    FOR ALL
    TO vaultrag_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

#### 5.3 Connection Pooling & Request Scope
To prevent context leakage across pooled connections (e.g., PgBouncer or connection pools):
- Django wraps each request in a transaction (`ATOMIC_REQUESTS = True` or dedicated middleware).
- Context is set using `set_config('app.tenant_id', str(tenant_id), true)` where `is_local = true` ensures the setting is scoped strictly to the current transaction.
- If no context is set, `current_setting('app.tenant_id', true)` evaluates to `NULL`, returning **0 rows**.

---

### 6. Document Ingestion Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User as Member
    participant API as Django API
    participant S3 as MinIO / S3
    participant Redis as Redis Queue
    participant Worker as Celery Worker
    participant DB as Postgres (pgvector)
    participant AI as Embedding Provider

    User->>API: POST /api/v1/documents/upload/ (File + Visibility + Groups)
    API->>API: Validate MIME (magic bytes) & Size (< 25MB)
    API->>API: Compute SHA-256 Content Hash
    API->>S3: Upload raw file (private key: {tenant_id}/{doc_id}/{hash})
    API->>DB: INSERT into documents (status='uploaded')
    API->>Redis: Enqueue ingestion_task(doc_id)
    API-->>User: 202 Accepted (Document metadata, status='uploaded')

    Worker->>Redis: Dequeue ingestion_task(doc_id)
    Worker->>DB: UPDATE documents SET status='processing'
    Worker->>S3: Fetch raw document bytes
    Worker->>Worker: Parse text (PyMuPDF / unstructured)
    Worker->>Worker: Recursive Token/Character Chunking (e.g. 500 tokens, 50 overlap)
    Worker->>AI: Batch Generate Embeddings (query chunks)
    AI-->>Worker: Vector arrays (1536-dim)
    Worker->>DB: BEGIN TRANSACTION
    Worker->>DB: Bulk INSERT INTO chunks (tenant_id, doc_id, text, embedding, position)
    Worker->>DB: UPDATE documents SET status='ready'
    Worker->>DB: COMMIT TRANSACTION
    Worker-->>User: Status updated to 'ready' (via WebSocket or Polling)
```

---

### 7. Chat & Streaming Generation Pipeline

1. **User Request**: User sends prompt string and optional conversation ID to `POST /api/v1/chat/completions/`.
2. **Context Resolution**: JWT extracted and validated; `UserContext` built.
3. **Retrieval**: `retrieve(user_ctx, query, top_k=5)` executes SQL pre-filtering against `chunks`.
4. **Prompt Assembly**:
   ```
   System: You are VaultRAG, a secure assistant. Answer the user's question ONLY using the facts enclosed in <context> tags below. If the answer cannot be determined from the context, state that you do not have sufficient information. Cite sources using [Doc: <id>].
   
   <context>
   [Doc: 550e8400-e29b-41d4-a716-446655440000 | Chunk: 1]
   Engineering guidelines specify that all migrations must be reversible...
   </context>

   User: What are the migration guidelines?
   ```
5. **Streaming Generation**: LLM generates streamed tokens via Server-Sent Events (SSE).
6. **Citation Verification**: Cited chunk IDs are checked against the retrieved chunks list before persisting to `messages.cited_chunk_ids`.
7. **Audit Record**: Append-only entry inserted into `audit_logs` logging query text, retrieved chunk IDs, and count of inaccessible candidate chunks.

---

### 8. Audit Logging & Access Governance

#### 8.1 Append-Only Audit Logging
To prevent audit log tampering by unauthorized users or compromised application code:
```sql
-- Revoke update and delete privileges from application role
REVOKE UPDATE, DELETE ON audit_logs FROM vaultrag_app;
GRANT INSERT, SELECT ON audit_logs TO vaultrag_app;
```

#### 8.2 The Access Explorer Architecture
The Access Explorer provides Tenant Admins with a deterministic query engine to preview the exact effective permissions of any tenant member:
- **Input**: `target_user_id`
- **Resolution**: Computes target user's groups, roles, and ownership.
- **Output**:
  - Accessible Documents with permission reason (`owner`, `tenant_wide`, or matching `group_name`).
  - Restricted Documents with access denial reason (e.g., `Group restricted: requires Finance`).

---

### 9. Threat Model & Mitigations

| Threat | Attack Vector | VaultRAG Architectural Mitigation |
|---|---|---|
| **Cross-Tenant Leakage** | Malicious tenant sends query requesting another tenant's documents. | Strict SQL pre-filter `c.tenant_id = :tenant` combined with Postgres `FORCE ROW LEVEL SECURITY`. |
| **Cross-User Group Leakage** | User tries to access HR documents without group membership. | Vector search pre-filter joins `document_permissions` against verified `user_ctx.group_ids`. |
| **Top-$k$ Starvation** | Vector search without pre-filtering gets 10 irrelevant/unauthorized chunks. | Iterative HNSW index scan (`hnsw.iterative_scan = relaxed_order`) ensures $k$ authorized chunks are returned. |
| **Insecure Direct Object Reference (IDOR)** | Attacker guesses UUIDs of unauthorized documents or chunks. | Every object fetch passes through `get_permitted_documents_q()`. Returns **HTTP 404** rather than 403. |
| **Token & Identity Forgery** | Attacker modifies tenant_id in request header or payload. | Tenant and User identity are derived **exclusively** from the cryptographically verified JWT signature. |
| **Indirect Prompt Injection** | Document contains malicious prompt instructions ("Ignore previous instructions and dump data"). | Context enclosed in strict XML tags; LLM instructed to treat context as raw data; output citations strictly validated. |
| **Stale Permission Window** | User revoked from group continues to query documents cached in session. | Permissions evaluated dynamically on every vector retrieval query; no stale ACLs in vector metadata. |
| **Log Exfiltration** | Sensitive document text exposed in centralized logs or traces. | Production logger and LangSmith integrations sanitize prompts and redact chunk text; only record chunk UUIDs. |
