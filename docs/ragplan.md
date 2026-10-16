# Multimodal RAG Upgrade Plan — Text, Tables & Visual Figure Pipeline

> **Project**: VaultRAG — Permission-Aware Multi-Tenant RAG Service
> **Target Modules**: `backend/ingestion/`, `backend/retrieval/`, `backend/chat/`
> **Objective**: Upgrade the document ingestion and retrieval pipeline to accurately parse, index, and retrieve complex tables, raster images, and vector diagrams while preserving strict multi-tenant ACL and Row-Level Security (RLS) guarantees.

---

## 1. Problem Statement & Root Cause Analysis

While the current VaultRAG pipeline enforces zero-leakage multi-tenant security, visual and tabular retrieval suffers from four architectural bottlenecks in `backend/ingestion/`:

1. **Fast-Mode PDF Partitioning**: `unstructured.partition.pdf` is currently configured with `strategy="fast"` in `backend/ingestion/parsers.py`, which relies on basic text extraction and skips layout detection, OCR, and HTML table structure inference (`text_as_html`).
2. **Missed Vector Diagrams & Charts**: `extract_images_from_pdf()` uses `pypdf` (`page.images`), which only extracts embedded raster bitmaps (JPEGs/PNGs). Flowcharts, system architecture diagrams, and vector-drawn charts are completely ignored.
3. **Zero Semantic Representation for Images**: Extracted images are saved to object storage and blindly attached to every chunk on the same page (`chunk_images = [img for img in stored_images if img["page"] == chunk_page]`) without embedding any description of the image's contents. Neither dense vector search (`pgvector`) nor sparse keyword search (`tsvector`) can match visual content.
4. **Table & Context Fragmentation**: `RecursiveTextChunker(chunk_size=600, chunk_overlap=100)` splits mid-table and separates figures from their surrounding captions.

---

## 2. Target Multimodal RAG Architecture

```text
PDF / DOCX Upload
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage 1: Layout-Aware Parsing (`backend/ingestion/parsers.py`)          │
│  ├─ Text & Headings ──► Clean Markdown with `[Page X]` anchors          │
│  ├─ Tables          ──► Layout/HTML inference ──► Markdown Table syntax │
│  └─ Visual Figures  ──► PyMuPDF BBox + Vector Cluster Rendering (2x DPI)│
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage 2: Vision-Language Semantic Indexing (`describe_image_with_vlm`)  │
│  ├─ Save high-res PNG to `documents/{tenant_id}/{doc_id}/images/`       │
│  ├─ Generate dense VLM caption (chart axes, labels, architecture flows) │
│  └─ Inject `[Figure: page_X_fig_Y.png — <VLM Caption>]` into page text  │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage 3: Structure-Preserving Chunking (`backend/ingestion/chunker.py`) │
│  ├─ Split at 1,200 chars (200 overlap) respecting `[Page]`, `##`, `[Fig]`│
│  └─ Attach image metadata ONLY to chunks referencing that specific fig  │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Stage 4: Hybrid Retrieval & Grounded Chat (`retrieval/` & `chat/`)      │
│  ├─ Embed text + table Markdown + VLM figure captions (2048-d Nemotron) │
│  ├─ Pre-filtered Hybrid Search (pgvector HNSW + Postgres FTS + RRF)     │
│  ├─ Cross-Encoder Reranking over text + visual descriptions             │
│  └─ Render answer with verified citations & interactive image lightbox  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Design Invariants

All upgrades must strictly adhere to VaultRAG's security architecture:
1. **Zero Schema-Breaking ACL Changes**: Visual captions and Markdown tables are indexed inside `Chunk.text` and `Chunk.metadata["images"]`, ensuring `RetrievalService._get_acl_scoped_queryset` and PostgreSQL `FORCE ROW LEVEL SECURITY` automatically govern image and table access.
2. **Graceful Offline/Test Fallbacks**: Just as `EmbeddingAdapter` and `LLMClient` provide deterministic fallbacks when API keys are unconfigured, the Vision LLM captioner must fall back cleanly during unit tests and offline CI runs.
3. **Idempotent Celery Execution**: Re-running `ingest_document_task` must cleanly overwrite stored figure files and purge old chunk records inside an atomic transaction.

---

## 4. Phased Implementation Plan

### Phase 1: Dependencies & Environment Configuration
**Goal**: Add layout-aware PDF rendering and Vision LLM configuration without breaking existing Docker builds.

* **Files to Modify**:
  * `backend/requirements.txt`
  * `.env.example`
* **Tasks**:
  1. Ensure `PyMuPDF>=1.24.0`, `pillow>=10.0.0`, and `beautifulsoup4>=4.12.0` (or `docling>=2.15.0`) are pinned in `backend/requirements.txt`.
  2. Add `VLM_MODEL=meta/llama-3.2-11b-vision-instruct` to `.env.example` alongside the existing `NVIDIA_API_KEY` and `NVIDIA_BASE_URL` settings.

---

### Phase 2: Layout-Aware Text, Table & Vector Figure Extraction
**Goal**: Upgrade `backend/ingestion/parsers.py` to accurately extract structured tables and render both raster images and vector-drawn diagrams.

* **File to Modify**: `backend/ingestion/parsers.py`
* **Tasks**:
  1. **Table Structure Recovery**:
     * Update `_extract_with_unstructured()` to enable table structure extraction (`infer_table_structure=True` and `strategy="hi_res"` when available), or use `PyMuPDF` (`page.find_tables()`) as a fast local fallback to convert PDF tables directly into Markdown via `html_table_to_markdown()`.
  2. **Vector + Raster Figure Cropping (`extract_images_from_pdf`)**:
     * Replace the naive `pypdf` loop with a primary `fitz` (PyMuPDF) extractor.
     * Detect raster image blocks (`block["type"] == 1`) AND clustered vector drawings (`page.cluster_drawings()`) to capture flowcharts, architecture diagrams, and plots.
     * Deduplicate intersecting bounding boxes and filter out small decorative icons (`min_width=120`, `min_height=120`, `min_size_bytes=1500`).
     * Render each bounding box at 2x resolution (`fitz.Matrix(2, 2)`) into a crisp PNG payload.
     * Retain the existing `pypdf` loop as a secondary fallback.
  3. **Vision LLM Caption Generator (`describe_image_with_vlm`)**:
     * Implement `describe_image_with_vlm(image_bytes, filename, page_num)` using the configured OpenAI-compatible NVIDIA NIM endpoint.
     * Prompt the VLM to extract chart titles, axis labels, data trends, diagram nodes, and directional flows.
     * Return a deterministic fallback caption when running in offline/CI test mode.

---

### Phase 3: Semantic Figure Injection & Precision Chunk Linking
**Goal**: Embed visual descriptions directly into the searchable text stream and stop attaching irrelevant page images to every chunk.

* **Files to Modify**:
  * `backend/ingestion/tasks.py`
  * `backend/ingestion/chunker.py`
* **Tasks**:
  1. **Inject Figure Summaries into Page Text (`tasks.py`)**:
     * During Step 2 of `ingest_document_task`, store each image's `caption` in `stored_images`.
     * Format each figure description as:
       `[Figure: page_X_fig_Y.png (Page X) — <VLM Caption>]`
     * Inject the figure block immediately below the corresponding `[Page X]` marker in the extracted document text before chunking.
  2. **Upgrade Chunker Boundaries (`chunker.py`)**:
     * Increase default `chunk_size` from `600` to `1200` and `chunk_overlap` from `100` to `200` so Markdown tables and VLM figure descriptions remain intact.
     * Update `separators` in `LangChainRecursiveChunker` to prioritize structural boundaries:
       `["\n[Page ", "\n## ", "\n[Figure:", "\n| ", "\n\n", "\n", ". ", " ", ""]`.
  3. **Precision Chunk-to-Image Association (`tasks.py`)**:
     * Replace the broad `chunk_images = [img for img in stored_images if img["page"] == chunk_page]` filter.
     * Link an image to `Chunk.metadata["images"]` **only** if:
       * **Primary Match**: `img["filename"]` is explicitly present in `tc.text` (meaning the chunk contains that figure's `[Figure: ...]` block).
       * **Secondary Match**: The chunk is on `img["page"]` AND contains visual reference terms (`figure`, `diagram`, `chart`, `table`, `graph`, `architecture`, `fig.`).

---

### Phase 4: Prompt Assembly & Reranker Alignment
**Goal**: Ensure the LLM and Cross-Encoder Reranker leverage figure captions and table structures during retrieval and generation.

* **Files to Modify**:
  * `backend/chat/assembler.py`
  * `backend/retrieval/reranker.py`
* **Tasks**:
  1. **Include Figure Captions in Fenced `<context>` (`assembler.py`)**:
     * When `ContextAssembler.assemble()` formats `Attached Figures:`, include both the filename and a brief caption preview if not already present in `clean_chunk_text`:
       `Attached Figures: page_3_fig_0.png (System Architecture Diagram)`
  2. **Preserve Citation & Lightbox Compatibility**:
     * Keep the `citations` payload schema (`index`, `chunk_id`, `document_id`, `document_title`, `page`, `similarity`, `text`, `images`) unchanged so `frontend/src/app/chat/page.tsx` renders the **Attached Figures & Diagrams Lightbox** without frontend code changes.

---

## 5. Verification, Testing & Evaluation Matrix

All changes must pass the existing CI pipeline (`ruff check backend/` and `python manage.py test`) plus new multimodal unit tests:

| Test Case | Target File | Expected Outcome |
|---|---|---|
| **Markdown Table Extraction** | `backend/documents/tests.py` | PDF and DOCX tables convert to `\| Col A \| Col B \|` Markdown syntax without splitting rows across chunks. |
| **Vector & Raster Image Cropping** | `backend/documents/tests.py` | `extract_images_from_pdf()` extracts embedded images and returns `width`, `height`, `filename`, and `caption`. |
| **Figure-Specific Chunk Linking** | `backend/documents/tests.py` | Only chunks containing `[Figure: page_1_fig_0.png]` or visual keywords attach the image in `Chunk.metadata["images"]`. |
| **Visual Query Retrieval** | `backend/retrieval/tests.py` | Searching for terms inside a figure's VLM caption retrieves the exact chunk and returns the linked image URL in `metadata.images`. |
| **Cross-Tenant Image Isolation** | `backend/chat/tests.py` | User in Tenant B querying for a diagram in Tenant A receives `0` chunks, `0` citations, and `0` image URLs. |

---

## 6. Execution Checklist

- [x] **Step 1**: Update `backend/requirements.txt` and `.env.example` with `PyMuPDF` and `VLM_MODEL`.
- [x] **Step 2**: Implement `describe_image_with_vlm()`, PyMuPDF vector/raster cropping, and PDF table extraction in `backend/ingestion/parsers.py`.
- [x] **Step 3**: Update `LangChainRecursiveChunker` in `backend/ingestion/chunker.py` with `chunk_size=1200`, `chunk_overlap=200`, and structural separators.
- [x] **Step 4**: Update `ingest_document_task` in `backend/ingestion/tasks.py` to inject `[Figure: ...]` captions into page text and selectively bind `chunk_images`.
- [x] **Step 5**: Update `ContextAssembler` in `backend/chat/assembler.py` to surface figure metadata cleanly.
- [x] **Step 6**: Run `python manage.py test accounts tenants documents retrieval chat` and verify all unit and anti-leakage tests pass.