import logging
import re

from celery import shared_task
from django.db import transaction

from documents.models import Chunk, Document

from .chunker import RecursiveTextChunker
from .embedder import EmbeddingAdapter
from .parsers import extract_text_from_file

logger = logging.getLogger(__name__)


def find_chunk_page(full_text: str, char_start: int) -> int:
    """Detects the 1-indexed document page of a chunk using [Page X] markers."""
    preceding = full_text[: max(0, char_start)]
    matches = list(re.finditer(r"\[Page\s+(\d+)\]", preceding))
    return int(matches[-1].group(1)) if matches else 1


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def ingest_document_task(self, document_id: str):
    """
    Asynchronous Celery pipeline that extracts text and tabular data using
    PyMuPDF and unstructured, generates dense vector embeddings, and transactionally
    persists document chunks without VLM/image-extraction overhead.
    """
    try:
        document = Document.objects.select_related("tenant").get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"[Ingestion] Document {document_id} not found.")
        return

    logger.info(
        f"[Ingestion] Starting processing for Document {document.id} ('{document.title}')"
    )
    document.status = Document.Status.PROCESSING
    document.save(update_fields=["status", "updated_at"])

    try:
        # 1. Read file bytes
        if not document.file:
            raise ValueError("Document record has no associated file payload.")

        with document.file.open("rb") as f:
            file_bytes = f.read()

        # 2. Extract text and structured tables via PyMuPDF and Unstructured
        text = extract_text_from_file(file_bytes, document.file_type)
        if not text or not text.strip():
            raise ValueError("Extracted text is empty or unreadable.")

        # 3. Chunk text with structural preservation
        chunker = RecursiveTextChunker(chunk_size=1200, chunk_overlap=200)
        text_chunks = chunker.split_text(text)
        if not text_chunks:
            raise ValueError("Text chunking produced zero segments.")

        logger.info(
            f"[Ingestion] Generated {len(text_chunks)} chunks for document {document.id}"
        )

        # 4. Generate embeddings (Nemotron-3-Embed-1b / deterministic fallback)
        adapter = EmbeddingAdapter()
        chunk_texts = [tc.text for tc in text_chunks]
        embeddings = adapter.get_embeddings_batch(chunk_texts)

        # 5. Transactionally insert chunks & update document status to READY
        with transaction.atomic():
            from accounts.middleware import set_tenant_db_context

            set_tenant_db_context(document.tenant_id)

            # Purge existing chunks for idempotency
            Chunk.objects.filter(document=document).delete()

            chunks_to_create = []
            for idx, tc in enumerate(text_chunks):
                chunk_page = find_chunk_page(text, tc.char_start)

                chunks_to_create.append(
                    Chunk(
                        tenant=document.tenant,
                        document=document,
                        position=tc.position,
                        text=tc.text,
                        embedding=embeddings[idx],
                        metadata={
                            "token_count": tc.token_count_approx,
                            "char_start": tc.char_start,
                            "char_end": tc.char_end,
                            "page": chunk_page,
                            **(getattr(tc, "metadata", {}) or {}),
                        },
                    )
                )

            Chunk.objects.bulk_create(chunks_to_create)

            document.status = Document.Status.READY
            document.error_message = ""
            document.metadata["chunk_count"] = len(chunks_to_create)
            document.metadata["char_count"] = len(text)
            document.save(
                update_fields=["status", "error_message", "metadata", "updated_at"]
            )

        logger.info(
            f"[Ingestion] Successfully ingested Document {document.id}: {len(chunks_to_create)} chunks ready."
        )

    except Exception as exc:
        logger.exception(f"[Ingestion] Failed to ingest Document {document.id}: {exc}")
        document.status = Document.Status.FAILED
        document.error_message = str(exc)
        document.save(update_fields=["status", "error_message", "updated_at"])
        raise self.retry(exc=exc) if self.request.retries < self.max_retries else exc
