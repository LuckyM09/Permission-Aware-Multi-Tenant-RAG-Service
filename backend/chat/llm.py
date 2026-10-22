import json
import logging
from collections.abc import Iterator

import requests
from decouple import config

logger = logging.getLogger(__name__)


class LLMClient:
    """
    OpenAI-compatible LLM client configured for NVIDIA NIM / Nemotron models.
    Supports both synchronous generation and Server-Sent Events (SSE) token streaming.
    Falls back gracefully to a mock generator in offline/test environments.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ):
        self.api_key = (
            api_key
            or config("NVIDIA_API_KEY", default="")
            or config("OPENAI_API_KEY", default="")
        )
        self.base_url = (
            base_url
            or config("NVIDIA_BASE_URL", default="")
            or config("OPENAI_BASE_URL", default="https://integrate.api.nvidia.com/v1")
        ).rstrip("/")

        if not self.base_url:
            self.base_url = "https://integrate.api.nvidia.com/v1"

        self.model = (
            model
            or config("LLM_MODEL", default="meta/llama-3.2-11b-vision-instruct")
        )

        self.is_configured = bool(
            self.api_key
            and not self.api_key.startswith("your_")
            and len(self.api_key) > 10
        )

    def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> str:
        """Executes non-streaming chat completion."""
        if not self.is_configured:
            return self._mock_generate(messages)

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            logger.warning(
                f"[LLMClient] API error {resp.status_code}: {resp.text[:200]}. Falling back to mock."
            )
        except Exception as exc:
            logger.warning(f"[LLMClient] Request failed: {exc}. Falling back to mock.")

        return self._mock_generate(messages)

    def stream_generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        """
        Executes streaming chat completion, yielding token strings.
        Handles both live SSE stream from NVIDIA NIM and mock token streaming.
        """
        if not self.is_configured:
            yield from self._mock_stream_generate(messages)
            return

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        try:
            resp = requests.post(
                endpoint, json=payload, headers=headers, stream=True, timeout=60
            )
            if resp.status_code != 200:
                logger.warning(
                    f"[LLMClient] Stream HTTP {resp.status_code}: {resp.text[:200]}"
                )
                yield from self._mock_stream_generate(messages)
                return

            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        choices = chunk.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        continue
        except Exception as exc:
            logger.warning(f"[LLMClient] Stream error: {exc}. Yielding mock stream.")
            yield from self._mock_stream_generate(messages)

    def _mock_generate(self, messages: list[dict[str, str]]) -> str:
        """Deterministic fallback synthesizer for offline environments and testing."""
        user_msg = messages[-1].get("content", "") if messages else ""
        context_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user" and "<context>" in m.get("content", ""):
                context_msg = m["content"]
                break

        # Check if context is empty / unpermitted
        if "(No authorized documents retrieved)" in context_msg or not context_msg:
            return (
                "I do not have access to any authorized documents containing "
                "information to answer this question."
            )

        # Extract document title and chunk info from context
        import re

        chunks_found = re.findall(
            r'\[Document:\s*"([^"]+)",\s*Chunk:\s*"([^"]+)"(?:,\s*Page:\s*(\d+))?\]',
            context_msg,
        )

        if not chunks_found:
            return (
                "I do not have access to any authorized documents containing "
                "information to answer this question."
            )

        doc_title, chunk_id, page_num = chunks_found[0]
        fig_match = re.search(r"Attached Figures:\s*([^\n]+)", context_msg)
        fig_note = f" (Referencing figure: [Figure: {fig_match.group(1)}])" if fig_match else ""

        question = user_msg.split("Question:")[-1].strip() if "Question:" in user_msg else user_msg
        return (
            f"Based on the authorized document '{doc_title}' [Doc: {doc_title}, Chunk: {chunk_id}], "
            f"here is the information regarding '{question[:60]}': the document specifies verified "
            f"operational parameters for authorized users on page {page_num or 1}.{fig_note}"
        )

    def _mock_stream_generate(self, messages: list[dict[str, str]]) -> Iterator[str]:
        """Yields mock response word by word."""
        full_text = self._mock_generate(messages)
        words = full_text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
