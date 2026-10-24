# VaultRAG — Project Definition

> **VaultRAG**: Permission-Aware Multi-Tenant RAG Service with Access Control by Design.

## Core Problem
Standard RAG pipelines retrieve documents regardless of who asks, turning the LLM into a data-leak machine. VaultRAG solves this by enforcing authorization at every layer:
1. **Pre-Filtering:** Vector search joins to document ACLs at query time so the index never returns unauthorized chunks.
2. **PostgreSQL RLS:** `FORCE ROW LEVEL SECURITY` acts as a defense-in-depth database backstop.
3. **Anti-Leak Citation Shield:** The LLM's output is verified against authorized chunk IDs before display.
4. **Append-Only Audit Log:** Every query, retrieval, and permission change is recorded in an immutable ledger.

## Tech Stack
- **Backend:** Django 5 + Django REST Framework + Celery
- **Database:** PostgreSQL 16 + `pgvector` (HNSW halfvec index, RLS)
- **Broker & Cache:** Redis 7
- **AI Models:** Meta Llama 3.2 11B Vision (NVIDIA NIM) + NVIDIA Nemotron-3 1B Embeddings
- **Frontend:** Next.js 14 (App Router) + TailwindCSS
- **Storage:** S3-compatible / MinIO
