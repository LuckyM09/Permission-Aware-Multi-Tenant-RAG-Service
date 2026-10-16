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


def format_rows_as_markdown_table(rows: list[list[str]]) -> Optional[str]:
    """
    Formats a 2D list of cell strings into a standard Markdown table.
    Pads rows to uniform column count and strips cell-internal linebreaks.
    """
    if not rows:
        return None
    cleaned_rows = [
        [str(cell or "").strip().replace("\n", " ") for cell in r]
        for r in rows
    ]
    cleaned_rows = [r for r in cleaned_rows if any(cell for cell in r)]
    if not cleaned_rows:
        return None
    max_cols = max(len(r) for r in cleaned_rows)
    if max_cols == 0:
        return None
    padded = [r + [""] * (max_cols - len(r)) for r in cleaned_rows]
    lines = []
    header = padded[0]
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join(["---"] * max_cols) + " |")
    for r in padded[1:]:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)


def describe_image_with_vlm(
    image_bytes: bytes, filename: str, page_num: int
) -> str:
    """
    Generates a dense semantic caption for an extracted figure or diagram
    using an OpenAI-compatible Vision Language Model (VLM), e.g. Llama 3.2 11B Vision.
    Provides a reliable deterministic fallback for offline/test environments.
    """
    import base64

    from decouple import config

    api_key = (
        config("NVIDIA_API_KEY", default="")
        or config("OPENAI_API_KEY", default="")
    )
    base_url = (
        config("NVIDIA_BASE_URL", default="")
        or config("OPENAI_BASE_URL", default="https://integrate.api.nvidia.com/v1")
    ).rstrip("/")
    vlm_model = config("VLM_MODEL", default="meta/llama-3.2-11b-vision-instruct")

    is_valid_key = bool(
        api_key and not api_key.startswith("your_") and len(api_key) > 10
    )
    if not is_valid_key:
        return f"Visual diagram and specifications on page {page_num} ({filename})"

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=base_url)
        b64_img = base64.b64encode(image_bytes).decode("utf-8")
        prompt_text = (
            "Describe this diagram, chart, table, or visual figure concisely in 1-2 factual sentences. "
            "State the title, all visible node names, labels, axes, and directional flows."
        )
        res = client.chat.completions.create(
            model=vlm_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_img}"},
                        },
                    ],
                }
            ],
            max_tokens=150,
            timeout=15.0,
        )
        content = res.choices[0].message.content
        if content and content.strip():
            return content.strip().replace("\n", " ")
    except Exception as exc:
        logger.warning(
            f"[describe_image_with_vlm] VLM captioning failed for {filename}: {exc}"
        )

    return f"Visual diagram and specifications on page {page_num} ({filename})"


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

        return format_rows_as_markdown_table(rows)
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
    min_width: int = 120,
    min_height: int = 120,
    min_size_bytes: int = 1500,
) -> list[dict]:
    """
    Extracts both embedded raster images and clustered vector diagrams (flowcharts,
    plots, architectures) from PDF pages using PyMuPDF.
    Renders bounding boxes at 2x resolution (high-DPI) into PNG payloads.
    Filters out decorative icons, spacers, and small bullets.
    """
    extracted_images: list[dict] = []
    try:
        import pymupdf

        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        for page_idx, page in enumerate(doc, start=1):
            candidate_rects: list[pymupdf.Rect] = []

            # 1. Clustered vector drawings (charts, flowcharts, architecture diagrams)
            try:
                clusters = page.cluster_drawings()
                for c in clusters:
                    r = pymupdf.Rect(c)
                    if r.width >= min_width and r.height >= min_height:
                        candidate_rects.append(r)
            except Exception as c_exc:
                logger.debug(f"[cluster_drawings] Page {page_idx} error: {c_exc}")

            # 2. Raster images on the page
            try:
                img_infos = page.get_image_info(xrefs=True)
                for info in img_infos:
                    bbox = info.get("bbox")
                    if bbox:
                        r = pymupdf.Rect(bbox)
                        if r.width >= min_width and r.height >= min_height:
                            candidate_rects.append(r)
            except Exception as r_exc:
                logger.debug(f"[get_image_info] Page {page_idx} error: {r_exc}")

            # Deduplicate overlapping bounding boxes (merge intersecting rects)
            merged_rects: list[pymupdf.Rect] = []
            for r in candidate_rects:
                merged = False
                for i, existing in enumerate(merged_rects):
                    intersect = r & existing
                    if not intersect.is_empty:
                        smaller_area = min(r.get_area(), existing.get_area())
                        if smaller_area > 0 and (intersect.get_area() / smaller_area) > 0.4:
                            merged_rects[i] = existing | r
                            merged = True
                            break
                if not merged:
                    merged_rects.append(r)

            # Render deduplicated bounding boxes into crisp PNGs at 2x scale
            img_idx = 0
            for rect in merged_rects:
                clipped_rect = rect & page.rect
                if (
                    clipped_rect.is_empty
                    or clipped_rect.width < min_width
                    or clipped_rect.height < min_height
                ):
                    continue
                try:
                    pix = page.get_pixmap(clip=clipped_rect, matrix=pymupdf.Matrix(2, 2))
                    png_bytes = pix.tobytes("png")
                    if len(png_bytes) < min_size_bytes:
                        continue
                    extracted_images.append(
                        {
                            "page": page_idx,
                            "index": img_idx,
                            "filename": f"page_{page_idx}_fig_{img_idx}.png",
                            "data": png_bytes,
                            "width": pix.width,
                            "height": pix.height,
                            "format": "PNG",
                        }
                    )
                    img_idx += 1
                except Exception as pix_exc:
                    logger.debug(f"[get_pixmap] Page {page_idx} error: {pix_exc}")
        doc.close()
        if extracted_images:
            return extracted_images
    except Exception as exc:
        logger.warning(
            f"[extract_images_from_pdf] PyMuPDF extraction failed: {exc}. Trying fallback."
        )

    # Secondary fallback using pypdf
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
        logger.warning(f"[extract_images_from_pdf] pypdf fallback failed: {exc}")

    return extracted_images


def extract_text_from_file(file_bytes: bytes, file_type: str) -> str:
    """
    Extracts and sanitizes text content from supported file formats.
    Extracts structured tables into clean Markdown tables and maintains [Page X] anchors.
    Falls back gracefully across PyMuPDF, python-docx, and pypdf.
    """
    # 1. For PDF: prioritize PyMuPDF with native table and layout extraction
    if file_type == "application/pdf":
        try:
            import pymupdf

            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            text_parts = []
            for page_idx, page in enumerate(doc, start=1):
                page_sections = [f"[Page {page_idx}]"]

                # Extract native Markdown tables from PDF
                table_mds = []
                try:
                    tabs = page.find_tables()
                    for t in tabs.tables:
                        t_md = t.to_markdown()
                        if t_md and t_md.strip():
                            table_mds.append(t_md.strip())
                except Exception as tab_exc:
                    logger.debug(f"[find_tables] Page {page_idx} error: {tab_exc}")

                page_text = page.get_text()
                if page_text and page_text.strip():
                    page_sections.append(page_text.strip())

                if table_mds:
                    page_sections.append("\n\n" + "\n\n".join(table_mds))

                text_parts.append("\n".join(page_sections))

            doc.close()
            parsed = "\n\n".join(text_parts).strip()
            if parsed:
                return sanitize_and_clean_text(parsed)
        except Exception as exc:
            logger.warning(f"[extract_text_from_file] PyMuPDF extraction failed: {exc}")

        # Fallback to unstructured or pypdf
        parsed_text = _extract_with_unstructured(file_bytes, file_type)
        if parsed_text:
            return sanitize_and_clean_text(parsed_text)

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

    # 2. For Word DOCX: extract paragraphs and tables in sequence
    if file_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        try:
            import docx

            doc = docx.Document(io.BytesIO(file_bytes))
            parts = []
            for p in doc.paragraphs:
                txt = p.text.strip()
                if txt:
                    parts.append(txt)

            for table in doc.tables:
                rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
                md_tab = format_rows_as_markdown_table(rows)
                if md_tab:
                    parts.append(f"\n{md_tab}\n")

            if parts:
                return sanitize_and_clean_text("\n\n".join(parts))
        except Exception as exc:
            logger.warning(f"[extract_text_from_file] python-docx extraction failed: {exc}")

        # Fallback to unstructured
        parsed_text = _extract_with_unstructured(file_bytes, file_type)
        if parsed_text:
            return sanitize_and_clean_text(parsed_text)

        raise ValueError("Could not extract legible text from Word document.")

    # 3. Plain text / Markdown fallback
    if file_type in ("text/plain", "text/markdown"):
        raw_text = file_bytes.decode("utf-8", errors="replace")
        return sanitize_and_clean_text(raw_text)

    # Generic unstructured fallback
    parsed_text = _extract_with_unstructured(file_bytes, file_type)
    if parsed_text:
        return sanitize_and_clean_text(parsed_text)

    return sanitize_and_clean_text(file_bytes.decode("utf-8", errors="replace"))
