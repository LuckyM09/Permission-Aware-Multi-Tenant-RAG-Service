from dataclasses import dataclass


@dataclass
class TextChunk:
    position: int
    text: str
    token_count_approx: int
    char_start: int
    char_end: int


class RecursiveTextChunker:
    """
    Recursively splits raw document text into overlapping chunks,
    respecting paragraph and sentence boundaries.
    """

    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> list[TextChunk]:
        clean_text = text.strip()
        if not clean_text:
            return []

        chunks: list[TextChunk] = []
        start = 0
        text_len = len(clean_text)
        position = 0

        while start < text_len:
            end = min(start + self.chunk_size, text_len)

            # If not at the very end of the text, look for a natural break point
            if end < text_len:
                # 1. Try paragraph break
                para_break = clean_text.rfind("\n\n", start, end)
                if para_break != -1 and para_break > start + (self.chunk_size // 2):
                    end = para_break + 2
                else:
                    # 2. Try sentence break
                    sent_break = clean_text.rfind(". ", start, end)
                    if sent_break != -1 and sent_break > start + (self.chunk_size // 2):
                        end = sent_break + 2
                    else:
                        # 3. Try space break
                        space_break = clean_text.rfind(" ", start, end)
                        if space_break != -1 and space_break > start + (
                            self.chunk_size // 2
                        ):
                            end = space_break + 1

            chunk_text = clean_text[start:end].strip()
            if chunk_text:
                # Approximate 4 characters per token
                approx_tokens = max(1, len(chunk_text) // 4)
                chunks.append(
                    TextChunk(
                        position=position,
                        text=chunk_text,
                        token_count_approx=approx_tokens,
                        char_start=start,
                        char_end=end,
                    )
                )
                position += 1

            # Advance start pointer by (end - overlap)
            if end >= text_len:
                break
            start = max(start + 1, end - self.chunk_overlap)

        return chunks
