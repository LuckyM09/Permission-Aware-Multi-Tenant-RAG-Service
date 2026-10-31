import re
from dataclasses import dataclass, field

from langchain_core.documents import Document as LCDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass
class TextChunk:
    position: int
    text: str
    token_count_approx: int
    char_start: int
    char_end: int
    section_header: str = ""
    metadata: dict = field(default_factory=dict)


class LangChainRecursiveChunker:
    """
    LangChain-powered structure-aware recursive document text splitter.
    Preserves document structure (sections, tables, paragraphs) and tracks
    hierarchical section breadcrumbs to prevent contextual embedding dilution.
    """

    HEADING_REGEX = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)

    def __init__(self, chunk_size: int = 1200, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=[
                "\n[Page ",
                "\n## ",
                "\n### ",
                "\n# ",
                "\n[Figure:",
                "\n| ",
                "\n\n",
                "\n",
                ". ",
                " ",
                "",
            ],
            keep_separator=True,
        )

    def _extract_heading_map(self, text: str) -> list[tuple[int, int, str]]:
        """Scans the text to map character offsets to active section headings."""
        headings = []
        for match in self.HEADING_REGEX.finditer(text):
            level = len(match.group(1))
            title = match.group(2).strip()
            headings.append((match.start(), level, title))
        return headings

    def _get_active_breadcrumb(
        self, headings: list[tuple[int, int, str]], char_offset: int
    ) -> str:
        """Computes the active hierarchical breadcrumb for a given character offset."""
        if not headings:
            return ""

        active_stack: list[tuple[int, str]] = []
        for pos, level, title in headings:
            if pos > char_offset:
                break
            while active_stack and active_stack[-1][0] >= level:
                active_stack.pop()
            active_stack.append((level, title))

        if not active_stack:
            return ""
        return " > ".join(title for _, title in active_stack)

    def split_text(self, text: str) -> list[TextChunk]:
        clean_text = text.strip()
        if not clean_text:
            return []

        headings = self._extract_heading_map(clean_text)
        raw_chunks = self.splitter.split_text(clean_text)
        chunks: list[TextChunk] = []
        search_idx = 0

        for pos, c_text in enumerate(raw_chunks):
            c_text_stripped = c_text.strip()
            if not c_text_stripped:
                continue

            found_idx = clean_text.find(c_text_stripped, search_idx)
            if found_idx != -1:
                char_start = found_idx
                char_end = char_start + len(c_text_stripped)
                search_idx = max(search_idx, char_start + 1)
            else:
                char_start = search_idx
                char_end = char_start + len(c_text_stripped)
                search_idx = char_end

            breadcrumb = self._get_active_breadcrumb(headings, char_start)

            final_text = c_text_stripped
            if breadcrumb and not final_text.startswith(breadcrumb) and not final_text.startswith("#"):
                header_prefix = f"[Section: {breadcrumb}]\n"
                if len(final_text) + len(header_prefix) <= self.chunk_size * 1.25:
                    final_text = header_prefix + final_text

            approx_tokens = max(1, len(final_text) // 4)
            has_table = "| " in c_text_stripped and "\n|" in c_text_stripped

            chunks.append(
                TextChunk(
                    position=pos,
                    text=final_text,
                    token_count_approx=approx_tokens,
                    char_start=char_start,
                    char_end=char_end,
                    section_header=breadcrumb,
                    metadata={
                        "section_header": breadcrumb,
                        "has_table": has_table,
                        "raw_char_len": len(c_text_stripped),
                    },
                )
            )

        return chunks

    def split_documents(self, documents: list[LCDocument]) -> list[LCDocument]:
        """LangChain native interface: splits LangChain Document objects."""
        return self.splitter.split_documents(documents)


# Backward-compatible alias for existing ingestion pipeline
RecursiveTextChunker = LangChainRecursiveChunker
