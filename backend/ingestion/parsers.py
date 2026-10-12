import io
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def detect_file_type(file_bytes: bytes, filename: str) -> tuple[str, bool]:
    """
    Detects and validates MIME type using magic byte signatures.
    Returns (detected_mime, is_valid).
    """
    header = file_bytes[:16]

    # PDF Magic Bytes: %PDF- (Hex: 25 50 44 46)
    if header.startswith(b"%PDF-"):
        return "application/pdf", True

    # DOCX / ZIP Magic Bytes: PK\x03\x04
    if header.startswith(b"PK\x03\x04"):
        ext = Path(filename).suffix.lower()
        if ext in (".docx", ".doc"):
            return (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                True,
            )
        return "application/zip", False

    # Plain text / Markdown (valid UTF-8 without control characters)
    try:
        sample = file_bytes[:1024].decode("utf-8")
        # Check for binary null bytes
        if "\x00" not in sample:
            ext = Path(filename).suffix.lower()
            if ext == ".md":
                return "text/markdown", True
            return "text/plain", True
    except UnicodeDecodeError:
        pass

    return "application/octet-stream", False


def sanitize_and_clean_text(text: str) -> str:
    """
    Cleans raw extracted text for security and embedding quality:
    - Strips binary null bytes (\x00) and dangerous control characters
    - Strips zero-width unicode characters (\u200b, \u200c, \u200d, \ufeff)
    - Normalizes excessive whitespace and repeated newlines
    - Strips leading and trailing whitespace
    """
    if not text:
        return ""

    # Remove null bytes and non-printable control characters (except \n, \r, \t)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Remove zero-width spaces, joiners, and BOM
    cleaned = re.sub(r"[\u200b\u200c\u200d\u200e\u200f\ufeff]", "", cleaned)

    # Normalize carriage returns
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse 3+ newlines to 2
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # Collapse excessive horizontal spaces / tabs on non-empty lines
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in cleaned.split("\n")]
    cleaned = "\n".join(lines)

    # Final newline cleanup
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def html_table_to_markdown(html_str: str) -> Optional[str]:
    """
    Converts an HTML table string into a clean Markdown table format.
    Preserves rows and column alignment for downstream LLM reasoning.
    """
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html_str, "html.parser")
        rows = []
        for tr in soup.find_all("tr"):
            cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
            if cells:
                rows.append(cells)

        if not rows:
            return None

        max_cols = max(len(r) for r in rows)
        if max_cols == 0:
            return None

        padded = [r + [""] * (max_cols - len(r)) for r in rows]
        md_lines = []

        # Header row
        header = padded[0]
        md_lines.append("| " + " | ".join(header) + " |")
        md_lines.append("| " + " | ".join(["---"] * max_cols) + " |")

        # Body rows
        for r in padded[1:]:
            md_lines.append("| " + " | ".join(r) + " |")

        return "\n".join(md_lines)
    except Exception as exc:
        logger.debug(f"[html_table_to_markdown] Fallback due to parsing error: {exc}")
        return None


def _extract_with_unstructured(file_bytes: bytes, file_type: str) -> Optional[str]:
    """
    Extracts structured content (tables, titles, narrative text, lists)
    using the unstructured library.
    Filters out noisy repetitive headers and footers (e.g. page numbers).
    """
    try:
        elements = []
        is_pdf = file_type == "application/pdf"
        is_docx = file_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        )

        if is_pdf:
            from unstructured.partition.pdf import partition_pdf

            elements = partition_pdf(
                file=io.BytesIO(file_bytes),
                strategy="fast",
                include_page_breaks=False,
            )
        elif is_docx:
            from unstructured.partition.docx import partition_docx

            elements = partition_docx(file=io.BytesIO(file_bytes))
        elif file_type in ("text/plain", "text/markdown"):
            from unstructured.partition.text import partition_text

            raw_txt = file_bytes.decode("utf-8", errors="replace")
            elements = partition_text(text=raw_txt)

        if not elements:
            return None

        extracted_sections: list[str] = []
        current_page = None
        for el in elements:
            el_type = type(el).__name__

            # Skip noisy page headers and footers (e.g., page numbers, repeating headers)
            if el_type in ("Header", "Footer"):
                continue

            # Track page transitions
            el_page = getattr(getattr(el, "metadata", None), "page_number", None)
            if el_page and el_page != current_page:
                current_page = el_page
                extracted_sections.append(f"\n[Page {current_page}]\n")

            # Handle structured tables
            if el_type == "Table":
                html_table = getattr(el.metadata, "text_as_html", None)
                if html_table:
                    md_table = html_table_to_markdown(html_table)
                    if md_table:
                        extracted_sections.append(f"\n{md_table}\n")
                        continue
                if el.text and el.text.strip():
                    extracted_sections.append(f"\n[Table]\n{el.text.strip()}\n")
                continue

            # Handle image captions
            if el_type == "Image":
                if el.text and el.text.strip():
                    extracted_sections.append(f"[Image: {el.text.strip()}]")
                continue

            # Handle headings and titles
            if el_type == "Title":
                extracted_sections.append(f"\n## {el.text.strip()}\n")
                continue

            # Standard narrative text, list items, etc.
            if el.text and el.text.strip():
                extracted_sections.append(el.text.strip())

        text_result = "\n\n".join(extracted_sections).strip()
        return text_result if text_result else None

    except Exception as exc:
        logger.warning(
            f"[unstructured] Failed to parse document with unstructured: {exc}. Falling back to standard parser."
        )
        return None


def extract_images_from_pdf(
    file_bytes: bytes,
    min_width: int = 100,
    min_height: int = 100,
    min_size_bytes: int = 500,
) -> list[dict]:
    """
    Extracts embedded raster images from PDF pages.
    Filters out small icons, bullets, or decorative spacers below min dimensions.
    Returns:
        [
            {
                "page": int, # 1-indexed
                "index": int,
                "filename": str,
                "data": bytes,
                "width": int,
                "height": int,
                "format": str,
            }
        ]
    """
    extracted_images: list[dict] = []
    try:
        from PIL import Image
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        for page_idx, page in enumerate(reader.pages, start=1):
            for img_idx, img in enumerate(page.images):
                raw_bytes = img.data
                if len(raw_bytes) < min_size_bytes:
                    continue
                try:
                    pil_img = Image.open(io.BytesIO(raw_bytes))
                    width, height = pil_img.size
                    if width < min_width or height < min_height:
                        continue
                    fmt = (pil_img.format or "PNG").upper()
                    ext = "jpg" if fmt == "JPEG" else fmt.lower()
                    extracted_images.append(
                        {
                            "page": page_idx,
                            "index": img_idx,
                            "filename": f"page_{page_idx}_fig_{img_idx}.{ext}",
                            "data": raw_bytes,
                            "width": width,
                            "height": height,
                            "format": fmt,
                        }
                    )
                except Exception:
                    continue
    except Exception as exc:
        logger.warning(f"[extract_images_from_pdf] Failed to extract images: {exc}")

    return extracted_images


def extract_text_from_file(file_bytes: bytes, file_type: str) -> str:
    """
    Extracts and sanitizes text content from supported file formats.
    Attempts extraction via `unstructured` for rich table and document layout parsing,
    falling back to standard format-specific libraries if needed.
    """
    # 1. Try unstructured parsing first
    parsed_text = _extract_with_unstructured(file_bytes, file_type)
    if parsed_text:
        return sanitize_and_clean_text(parsed_text)

    # 2. Fallbacks by file type
    if file_type in ("text/plain", "text/markdown"):
        raw_text = file_bytes.decode("utf-8", errors="replace")
        return sanitize_and_clean_text(raw_text)

    if file_type == "application/pdf":
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text_parts = []
            for page_idx, page in enumerate(doc, start=1):
                page_text = page.get_text()
                if page_text and page_text.strip():
                    text_parts.append(f"[Page {page_idx}]\n{page_text.strip()}")
            doc.close()
            parsed = "\n\n".join(text_parts).strip()
            if parsed:
                return sanitize_and_clean_text(parsed)
        except Exception as exc:
            logger.warning(f"[extract_text_from_file] PyMuPDF extraction failed: {exc}")

        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page_idx, page in enumerate(reader.pages, start=1):
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text_parts.append(f"[Page {page_idx}]\n{page_text.strip()}")
            parsed = "\n\n".join(text_parts).strip()
            if parsed:
                return sanitize_and_clean_text(parsed)
        except Exception as exc:
            logger.warning(f"[extract_text_from_file] pypdf extraction failed: {exc}")

        raise ValueError("Could not extract legible text from PDF document.")

    if file_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        try:
            import docx

            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
            if paragraphs:
                return sanitize_and_clean_text("\n\n".join(paragraphs))
        except Exception as exc:
            logger.warning(f"[extract_text_from_file] python-docx extraction failed: {exc}")

        raise ValueError("Could not extract legible text from Word document.")

    # Plain text / Markdown fallback
    return sanitize_and_clean_text(file_bytes.decode("utf-8", errors="replace"))
