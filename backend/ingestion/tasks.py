import logging
import re

from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction

from documents.models import Chunk, Document

from .chunker import RecursiveTextChunker
from .embedder import EmbeddingAdapter
from .parsers import (
    describe_image_with_vlm,
    extract_images_from_pdf,
    extract_text_from_file,
)

logger = logging.getLogger(__name__)

VISUAL_KEYWORDS = re.compile(
    r"\b(figure|fig\.|diagram|chart|table|graph|plot|architecture|flowchart|workflow|schematic|heatmap)\b",
    re.IGNORECASE,
)


def find_chunk_page(full_text: str, char_start: int) -> int:
    """Detects the 1-indexed document page of a chunk using [Page X] markers."""
    preceding = full_text[: max(0, char_start)]
    matches = list(re.finditer(r"\[Page\s+(\d+)\]", preceding))
    return int(matches[-1].group(1)) if matches else 1


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def ingest_document_task(self, document_id: str):
    """
    Asynchronous Celery pipeline that parses, chunks, embeds,
    extracts embedded figures, and transactionally persists document chunks.
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

        # 2. Extract & persist embedded figures/images (if PDF)
        stored_images = []
        if document.file_type == "application/pdf":
            try:
                extracted_images = extract_images_from_pdf(file_bytes)

                # Prioritize VLM captions for up to 3 most prominent diagrams (by pixel area)
                # to guarantee fast ingestion (<5s) even on documents with dozens of figures
                MAX_VLM_CALLS = 3
                prominent_indices = set(
                    sorted(
                        range(len(extracted_images)),
                        key=lambda i: extracted_images[i]["width"] * extracted_images[i]["height"],
                        reverse=True,
                    )[:MAX_VLM_CALLS]
                )
                vlm_circuit_broken = False

                for img_idx, img in enumerate(extracted_images):
                    rel_path = f"documents/{document.tenant_id}/{document.id}/images/{img['filename']}"
                    if default_storage.exists(rel_path):
                        default_storage.delete(rel_path)
                    saved_path = default_storage.save(
                        rel_path, ContentFile(img["data"])
                    )
                    image_url = default_storage.url(saved_path)

                    # Generate semantic caption via Vision LLM or fast fallback
                    if img_idx in prominent_indices and not vlm_circuit_broken:
                        try:
                            caption = describe_image_with_vlm(
                                img["data"], img["filename"], img["page"]
                            )
                            # If VLM timed out or errored and returned fallback string, trip circuit breaker
                            if caption.startswith("Visual diagram and specifications on page"):
                                vlm_circuit_broken = True
                        except Exception as vlm_err:
                            logger.warning(
                                f"[Ingestion] VLM circuit broken on {img['filename']}: {vlm_err}"
                            )
                            vlm_circuit_broken = True
                            caption = f"Visual diagram and specifications on page {img['page']} ({img['filename']})"
                    else:
                        caption = f"Visual diagram and specifications on page {img['page']} ({img['filename']})"

                    stored_images.append(
                        {
                            "url": image_url,
                            "filename": img["filename"],
                            "page": img["page"],
                            "width": img["width"],
                            "height": img["height"],
                            "format": img["format"],
                            "caption": caption,
                        }
                    )
                if stored_images:
                    logger.info(
                        f"[Ingestion] Extracted & saved {len(stored_images)} figures for document {document.id}"
                    )
            except Exception as img_exc:
                logger.warning(
                    f"[Ingestion] Image extraction skipped due to error: {img_exc}"
                )

        # 3. Extract text
        text = extract_text_from_file(file_bytes, document.file_type)
        if not text or not text.strip():
            raise ValueError("Extracted text is empty or unreadable.")

        # Inject semantic figure captions into document text under corresponding [Page X]
        if stored_images:
            figures_by_page: dict[int, list[dict]] = {}
            for img in stored_images:
                figures_by_page.setdefault(img["page"], []).append(img)

            for p_num, imgs in figures_by_page.items():
                fig_blocks = "\n".join(
                    f"[Figure: {img['filename']} (Page {img['page']}) — {img['caption']}]"
                    for img in imgs
                )
                page_marker = f"[Page {p_num}]"
                if page_marker in text:
                    text = text.replace(
                        page_marker, f"{page_marker}\n\n{fig_blocks}\n", 1
                    )
                else:
                    text += f"\n\n{page_marker}\n\n{fig_blocks}\n"

        # 4. Chunk text with structural preservation
        chunker = RecursiveTextChunker(chunk_size=1200, chunk_overlap=200)
        text_chunks = chunker.split_text(text)
        if not text_chunks:
            raise ValueError("Text chunking produced zero segments.")

        logger.info(
            f"[Ingestion] Generated {len(text_chunks)} chunks for document {document.id}"
        )

        # 5. Generate embeddings
        adapter = EmbeddingAdapter()
        chunk_texts = [tc.text for tc in text_chunks]
        embeddings = adapter.get_embeddings_batch(chunk_texts)

        # 6. Transactionally insert chunks & update status
        with transaction.atomic():
            # Purge existing chunks for idempotency
            Chunk.objects.filter(document=document).delete()

            chunks_to_create = []
            for idx, tc in enumerate(text_chunks):
                chunk_page = find_chunk_page(text, tc.char_start)

                # Precision Chunk-to-Image Association
                page_images = [img for img in stored_images if img["page"] == chunk_page]
                chunk_images = []
                for img in page_images:
                    # Primary match: filename explicitly inside chunk text
                    if img["filename"] in tc.text:
                        chunk_images.append(img)
                    # Secondary match: same page AND chunk contains visual reference keywords
                    elif VISUAL_KEYWORDS.search(tc.text):
                        chunk_images.append(img)

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
                            "images": chunk_images,
                        },
                    )
                )

            Chunk.objects.bulk_create(chunks_to_create)

            document.status = Document.Status.READY
            document.error_message = ""
            document.metadata["chunk_count"] = len(chunks_to_create)
            document.metadata["char_count"] = len(text)
            document.metadata["images"] = stored_images
            document.metadata["image_count"] = len(stored_images)
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
