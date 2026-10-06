# VaultRAG — Permission-Aware Multi-Tenant RAG Service

[![CI](https://github.com/LuckyM09/Permission-Aware-Multi-Tenant-RAG-Service/actions/workflows/ci.yml/badge.svg)](https://github.com/LuckyM09/Permission-Aware-Multi-Tenant-RAG-Service/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![Django: 5.x](https://img.shields.io/badge/Django-5.x-green.svg)](https://djangoproject.com)
[![Next.js: 14/15](https://img.shields.io/badge/Next.js-App%20Router-black.svg)](https://nextjs.org)
[![PostgreSQL: 16+ pgvector](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-blue.svg)](https://github.com/pgvector/pgvector)

> **Enterprise-grade document Q&A service engineered with Access Control by Design.** Features SQL-level vector pre-filtering, PostgreSQL Row-Level Security (`FORCE RLS`), append-only audit trails, and zero cross-tenant / cross-user information leakage proven by an automated adversarial test suite.

---

## 🏛️ System Architecture

```text
Browser ──► Next.js App Router (BFF, httpOnly Cookies)
              │
              ▼
          Django 5 + DRF API ──► PostgreSQL 16 (+pgvector, FORCE RLS)
              │                     ▲
              ├─► Redis ◄─► Celery Workers (Ingestion Pipeline)
              ├─► MinIO / S3 (Private Document Storage)
              └─► Provider-Agnostic LLM & Embedding Adapter
```

---

## 🚀 Quickstart (Local Development with Docker)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running with WSL 2 on Windows or native on macOS/Linux)
- [Git](https://git-scm.com/)

### 1. Clone & Configure
```bash
git clone https://github.com/LuckyM09/Permission-Aware-Multi-Tenant-RAG-Service.git
cd Permission-Aware-Multi-Tenant-RAG-Service
cp .env.example .env
```

### 2. Boot All Services
```bash
docker compose -f infra/docker-compose.yml up --build
```

### 3. Access Services
- **Web App (Frontend)**: [http://localhost:3000](http://localhost:3000)
- **Django API Root**: [http://localhost:8000/api/](http://localhost:8000/api/)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (User: `minioadmin` / Pass: `minioadmin`)

---

## 📁 Repository Structure

```text
├── .github/workflows/    # Automated CI/CD (linting, tests, leakage suite)
├── backend/              # Django 5 + DRF REST API
│   ├── config/           # Modular settings (base, dev, prod) & routing
│   ├── accounts/         # Custom User model & JWT authentication
│   ├── tenants/          # Multi-tenant isolation & organization groups
│   ├── documents/        # File registry, metadata, & visibility policies
│   ├── ingestion/        # Celery asynchronous chunking & embedding tasks
│   ├── permissions/      # Single source of truth for access validation
│   ├── retrieval/        # Pre-filtered pgvector search engine
│   ├── chat/             # LLM prompt framing, SSE streaming, & citations
│   └── audit/            # Append-only compliance & query logging
├── frontend/             # Next.js 14+ App Router (TypeScript, Tailwind, shadcn/ui)
├── infra/                # Docker Compose, Dockerfiles, & local services
└── docs/                 # Product specs, architecture diagrams, coding rules
```

---

## 📚 Documentation
- [Product Requirements Document (PRD)](docs/prd.md)
- [System Architecture](docs/architecture.md)
- [Engineering Standards & Coding Rules](docs/rules.md)
- [UI/UX Direction & Design System](docs/design.md)
- [Project Memory & Context](docs/memory.md)
- [Master Plan & Roadmap](docs/plan.md)

---

## 🛡️ License
Distributed under the MIT License.
