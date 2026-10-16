from dataclasses import dataclass

from langchain_core.documents import Document as LCDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass
class TextChunk:
    position: int
    text: str
    token_count_approx: int
    char_start: int
    char_end: int


class LangChainRecursiveChunker:
    """
    LangChain-powered recursive document text splitter.
    Leverages LangChain's RecursiveCharacterTextSplitter while maintaining
    precise character offsets, approximate token counts, and chunk positioning.
    """

    def __init__(self, chunk_size: int = 1200, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=[
                "\n[Page ",
                "\n## ",
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

    def split_text(self, text: str) -> list[TextChunk]:
        clean_text = text.strip()
        if not clean_text:
            return []

        raw_chunks = self.splitter.split_text(clean_text)
        chunks: list[TextChunk] = []
        search_idx = 0

        for pos, c_text in enumerate(raw_chunks):
            c_text_stripped = c_text.strip()
            if not c_text_stripped:
                continue

            # Locate character offset in original text
            found_idx = clean_text.find(c_text_stripped, search_idx)
            if found_idx != -1:
                char_start = found_idx
                char_end = char_start + len(c_text_stripped)
                search_idx = max(search_idx, char_start + 1)
            else:
                char_start = search_idx
                char_end = char_start + len(c_text_stripped)
                search_idx = char_end

            approx_tokens = max(1, len(c_text_stripped) // 4)
            chunks.append(
                TextChunk(
                    position=pos,
                    text=c_text_stripped,
                    token_count_approx=approx_tokens,
                    char_start=char_start,
                    char_end=char_end,
                )
            )

        return chunks

    def split_documents(self, documents: list[LCDocument]) -> list[LCDocument]:
        """LangChain native interface: splits LangChain Document objects."""
        return self.splitter.split_documents(documents)


# Backward-compatible alias for existing ingestion pipeline
RecursiveTextChunker = LangChainRecursiveChunker
