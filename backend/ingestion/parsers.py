import io
from pathlib import Path


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


def extract_text_from_file(file_bytes: bytes, file_type: str) -> str:
    """
    Extracts raw text content from supported file formats.
    """
    if file_type in ("text/plain", "text/markdown"):
        return file_bytes.decode("utf-8", errors="replace")

    if file_type == "application/pdf":
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text_parts = []
            for page in doc:
                text_parts.append(page.get_text())
            doc.close()
            return "\n\n".join(text_parts).strip()
        except ImportError:
            # Fallback text extractor for PDF if PyMuPDF is not installed
            try:
                from pypdf import PdfReader

                reader = PdfReader(io.BytesIO(file_bytes))
                return "\n\n".join(
                    page.extract_text() or "" for page in reader.pages
                ).strip()
            except ImportError:
                # Basic string extraction fallback
                return file_bytes.decode("latin-1", errors="ignore")

    # Default fallback
    return file_bytes.decode("utf-8", errors="replace").strip()
