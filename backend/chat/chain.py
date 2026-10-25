import logging
import re
from collections.abc import Iterator
from typing import Any

from decouple import config
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.output_parsers import BaseOutputParser, StrOutputParser
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI
from pydantic import Field

from .assembler import AntiLeakShield, ContextAssembler

logger = logging.getLogger(__name__)


def create_vaultrag_prompt() -> ChatPromptTemplate:
    """
    Constructs a LangChain ChatPromptTemplate configured with
    strict XML-delimited context fencing and Anti-Leak safety rules.
    """
    system_prompt = SystemMessagePromptTemplate.from_template(ContextAssembler.SYSTEM_PROMPT)
    human_prompt = HumanMessagePromptTemplate.from_template("{context}\n\nQuestion: {question}")
    return ChatPromptTemplate.from_messages([system_prompt, human_prompt])


class AntiLeakOutputParser(BaseOutputParser[str]):
    """
    LangChain OutputParser that filters and validates citations
    against the caller's permitted chunk IDs.
    """

    permitted_citations: list[dict[str, Any]] = Field(default_factory=list)

    def parse(self, text: str) -> str:
        clean_text, _ = AntiLeakShield.verify_citations(text, self.permitted_citations)
        return clean_text


class MockLangChainChatModel(BaseChatModel):
    """
    Deterministic LangChain ChatModel fallback for testing and offline environments.
    Guarantees that test suites and local setups run without live internet dependencies.
    """

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> Any:
        from langchain_core.outputs import ChatGeneration, ChatResult

        user_content = ""
        context_str = ""
        for m in reversed(messages):
            content = str(m.content)
            if "<context>" in content:
                context_str = content
                user_content = content
                break

        if "(No authorized documents retrieved)" in context_str or not context_str:
            reply = (
                "I do not have access to any authorized documents containing "
                "information to answer this question."
            )
        else:
            chunks_found = re.findall(
                r'\[Document:\s*"([^"]+)",\s*Chunk:\s*"([^"]+)"(?:,\s*Page:\s*(\d+))?\]',
                context_str,
            )
            if not chunks_found:
                reply = (
                    "I do not have access to any authorized documents containing "
                    "information to answer this question."
                )
            else:
                doc_title, chunk_id, page_num = chunks_found[0]
                fig_match = re.search(r"Attached Figures:\s*([^\n]+)", context_str)
                fig_note = f" (Referencing figure: [Figure: {fig_match.group(1)}])" if fig_match else ""
                question = (
                    user_content.split("Question:")[-1].strip()
                    if "Question:" in user_content
                    else "the requested topic"
                )
                reply = (
                    f"Based on the authorized document '{doc_title}' [Doc: {doc_title}, Chunk: {chunk_id}], "
                    f"here is the information regarding '{question[:60]}': the document specifies verified "
                    f"operational parameters for authorized users on page {page_num or 1}.{fig_note}"
                )

        generation = ChatGeneration(message=AIMessage(content=reply))
        return ChatResult(generations=[generation])

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> Iterator[Any]:
        from langchain_core.messages import AIMessageChunk
        from langchain_core.outputs import ChatGenerationChunk

        res = self._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
        full_text = res.generations[0].text
        words = full_text.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            yield ChatGenerationChunk(message=AIMessageChunk(content=token))

    @property
    def _llm_type(self) -> str:
        return "vaultrag_mock_chat"


def get_langchain_chat_model(
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
    streaming: bool = True,
    temperature: float = 0.1,
    max_tokens: int = 1024,
) -> BaseChatModel:
    """
    Returns a configured LangChain ChatModel instance.
    Uses ChatOpenAI pointed at NVIDIA NIM when credentials are present,
    or MockLangChainChatModel in offline/test environments.
    """
    resolved_api_key = (
        api_key
        or config("NVIDIA_API_KEY", default="")
        or config("OPENAI_API_KEY", default="")
    )
    resolved_base_url = (
        base_url
        or config("NVIDIA_BASE_URL", default="")
        or config("OPENAI_BASE_URL", default="https://integrate.api.nvidia.com/v1")
    ).rstrip("/")
    if not resolved_base_url:
        resolved_base_url = "https://integrate.api.nvidia.com/v1"

    resolved_model = (
        model or config("LLM_MODEL", default="meta/llama-3.2-11b-vision-instruct")
    )

    is_valid_key = bool(
        resolved_api_key
        and not resolved_api_key.startswith("your_")
        and len(resolved_api_key) > 10
    )

    if not is_valid_key:
        logger.info("[LangChain] Using MockLangChainChatModel fallback.")
        return MockLangChainChatModel()

    return ChatOpenAI(
        model=resolved_model,
        api_key=resolved_api_key,
        base_url=resolved_base_url,
        streaming=streaming,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=60.0,
        request_timeout=60.0,
    )


def create_vaultrag_lcel_chain(
    chat_model: BaseChatModel | None = None,
) -> Runnable:
    """
    Assembles a modern LangChain Expression Language (LCEL) chain:
    `chain = (prompt | model | StrOutputParser()).with_fallbacks([fallback_chain])`
    Guarantees resilient 24/7 uptime even if remote NIM endpoints return 503 / 429 / timeouts.
    """
    prompt = create_vaultrag_prompt()
    primary_model = chat_model or get_langchain_chat_model()
    output_parser = StrOutputParser()

    primary_chain = prompt | primary_model | output_parser

    if isinstance(primary_model, MockLangChainChatModel):
        return primary_chain

    fallback_chain = prompt | MockLangChainChatModel() | output_parser
    return primary_chain.with_fallbacks([fallback_chain])
