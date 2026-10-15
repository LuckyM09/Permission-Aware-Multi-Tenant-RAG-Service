import json
import logging
from collections.abc import Iterator
from typing import Any, Optional

from langchain_core.language_models.chat_models import BaseChatModel

from accounts.context import UserContext
from retrieval.retriever import VaultRAGRetriever
from retrieval.services import RetrievalService

from .assembler import AntiLeakShield, ContextAssembler
from .chain import (
    MockLangChainChatModel,
    create_vaultrag_lcel_chain,
    get_langchain_chat_model,
)
from .llm import LLMClient
from .models import Conversation, Message

logger = logging.getLogger(__name__)


class ChatService:
    """
    Orchestrates permission-filtered RAG chat generation using LangChain LCEL.
    Connects VaultRAGRetriever, ContextAssembler, LangChain ChatModel, and AntiLeakShield.
    """

    def __init__(
        self,
        retrieval_service: RetrievalService | None = None,
        llm_client: LLMClient | None = None,
        chat_model: Optional[BaseChatModel] = None,
        assembler: ContextAssembler | None = None,
    ):
        self.retrieval = retrieval_service or RetrievalService()
        self.assembler = assembler or ContextAssembler()
        self.llm_client = llm_client
        if chat_model is not None:
            self.chat_model = chat_model
        elif llm_client is not None and (
            llm_client.api_key == "mock" or not getattr(llm_client, "is_configured", True)
        ):
            self.chat_model = MockLangChainChatModel()
        else:
            self.chat_model = get_langchain_chat_model()

    def get_or_create_conversation(
        self,
        user_ctx: UserContext,
        conversation_id: str | None = None,
        initial_title: str = "New Conversation",
    ) -> Conversation:
        """Retrieves an existing conversation or creates a new tenant-scoped one."""
        if conversation_id:
            try:
                return Conversation.objects.get(
                    id=conversation_id,
                    tenant_id=user_ctx.tenant_id,
                    user_id=user_ctx.user_id,
                )
            except Conversation.DoesNotExist:
                logger.warning(
                    f"[ChatService] Conversation {conversation_id} not found for user {user_ctx.user_id}."
                )

        return Conversation.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            title=initial_title[:250],
        )

    def generate_chat_response(
        self,
        user_ctx: UserContext,
        query: str,
        conversation_id: str | None = None,
        top_k: int = 5,
        threshold: float = 0.25,
        mode: str = "hybrid",
        rerank: bool = True,
    ) -> dict[str, Any]:
        """
        Synchronous RAG generation turn powered by LangChain LCEL.
        Retrieves permitted context via VaultRAGRetriever, generates answer via LCEL chain,
        validates citations with Anti-Leak Shield, and persists dialogue turn.
        """
        conversation = self.get_or_create_conversation(
            user_ctx, conversation_id, initial_title=query[:50]
        )

        # 1. Save user query message
        user_msg = Message.objects.create(
            conversation=conversation,
            role=Message.Role.USER,
            content=query,
        )

        # 2. Execute authoritative permission-filtered retrieval via LangChain BaseRetriever
        retriever = VaultRAGRetriever(
            user_ctx=user_ctx,
            top_k=top_k,
            threshold=threshold,
            mode=mode,
            rerank=rerank,
            service=self.retrieval,
        )
        retrieved_docs = retriever.invoke(query)

        # 3. Assemble fenced context & verify citations
        context_str, permitted_citations = self.assembler.assemble(retrieved_docs)

        # 4. Generate answer via LangChain Expression Language (LCEL) chain
        chain = create_vaultrag_lcel_chain(chat_model=self.chat_model)
        raw_answer = chain.invoke({"context": context_str, "question": query})

        # 5. Anti-leak shield backstop: verify citations
        clean_answer, final_citations = AntiLeakShield.verify_citations(
            raw_answer, permitted_citations
        )

        # 6. Save assistant response message
        assistant_msg = Message.objects.create(
            conversation=conversation,
            role=Message.Role.ASSISTANT,
            content=clean_answer,
            citations=final_citations,
        )

        return {
            "conversation_id": str(conversation.id),
            "user_message_id": str(user_msg.id),
            "message_id": str(assistant_msg.id),
            "content": clean_answer,
            "citations": final_citations,
            "created_at": assistant_msg.created_at.isoformat(),
        }

    def stream_chat_response(
        self,
        user_ctx: UserContext,
        query: str,
        conversation_id: str | None = None,
        top_k: int = 5,
        threshold: float = 0.25,
        mode: str = "hybrid",
        rerank: bool = True,
    ) -> Iterator[str]:
        """
        SSE Streaming generator for real-time token delivery to the client via LangChain LCEL.
        Yields Server-Sent Event formatted chunks.
        """
        conversation = self.get_or_create_conversation(
            user_ctx, conversation_id, initial_title=query[:50]
        )

        # Save user message immediately
        Message.objects.create(
            conversation=conversation,
            role=Message.Role.USER,
            content=query,
        )

        # Execute permission-filtered retrieval via LangChain BaseRetriever
        retriever = VaultRAGRetriever(
            user_ctx=user_ctx,
            top_k=top_k,
            threshold=threshold,
            mode=mode,
            rerank=rerank,
            service=self.retrieval,
        )
        retrieved_docs = retriever.invoke(query)

        # Assemble context and extract permitted citations
        context_str, permitted_citations = self.assembler.assemble(retrieved_docs)

        # Emit initial 'context' event with citations and attached figures
        context_payload = {
            "conversation_id": str(conversation.id),
            "citations": permitted_citations,
        }
        yield f"event: context\ndata: {json.dumps(context_payload)}\n\n"

        # Stream via LangChain Expression Language (LCEL) runnable
        chain = create_vaultrag_lcel_chain(chat_model=self.chat_model)
        full_content_parts: list[str] = []
        try:
            for token in chain.stream({"context": context_str, "question": query}):
                full_content_parts.append(token)
                yield f"event: delta\ndata: {json.dumps({'content': token})}\n\n"
        except Exception as exc:
            logger.warning(
                f"[ChatService] Primary chain stream failed: {exc}. Falling back to mock generator."
            )
            if not full_content_parts:
                from langchain_core.output_parsers import StrOutputParser

                from .chain import create_vaultrag_prompt

                fallback_chain = (
                    create_vaultrag_prompt()
                    | MockLangChainChatModel()
                    | StrOutputParser()
                )
                for token in fallback_chain.stream(
                    {"context": context_str, "question": query}
                ):
                    full_content_parts.append(token)
                    yield f"event: delta\ndata: {json.dumps({'content': token})}\n\n"

        full_answer = "".join(full_content_parts)
        clean_answer, final_citations = AntiLeakShield.verify_citations(
            full_answer, permitted_citations
        )

        # Persist assistant turn with verified citations
        assistant_msg = Message.objects.create(
            conversation=conversation,
            role=Message.Role.ASSISTANT,
            content=clean_answer,
            citations=final_citations,
        )

        done_payload = {
            "conversation_id": str(conversation.id),
            "message_id": str(assistant_msg.id),
            "citations": final_citations,
        }
        yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"
