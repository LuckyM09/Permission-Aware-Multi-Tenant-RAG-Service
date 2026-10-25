import logging
from typing import Any, Optional
from uuid import UUID

from accounts.context import UserContext

from .models import AuditAction, AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    """
    Centralized service for writing immutable audit logs.
    Captures tenant, user context, query payloads, retrieval candidates, and timing.
    Fails safely so audit log writing never breaks business operations.
    """

    @classmethod
    def log_event(
        cls,
        tenant_id: UUID | str,
        action: str,
        user_id: Optional[UUID | str] = None,
        user_email: str = "",
        query_text_sanitized: str = "",
        retrieved_chunk_ids: list[str] | None = None,
        denied_chunk_count: int = 0,
        ip_address: str | None = None,
        user_agent: str = "",
        latency_ms: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Optional[AuditLog]:
        try:
            return AuditLog.objects.create(
                tenant_id=tenant_id,
                user_id=user_id,
                user_email=user_email,
                action=action,
                query_text_sanitized=query_text_sanitized[:2000],
                retrieved_chunk_ids=retrieved_chunk_ids or [],
                denied_chunk_count=denied_chunk_count,
                ip_address=ip_address,
                user_agent=user_agent[:500],
                latency_ms=latency_ms,
                metadata=metadata or {},
            )
        except Exception as exc:
            logger.error(f"[AuditService] Failed to record audit log: {exc}", exc_info=True)
            return None

    @classmethod
    def log_query(
        cls,
        user_ctx: UserContext,
        query: str,
        retrieved_chunk_ids: list[str],
        latency_ms: float | None = None,
        ip_address: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Optional[AuditLog]:
        """Convenience method for logging RAG queries."""
        return cls.log_event(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.QUERY,
            query_text_sanitized=query,
            retrieved_chunk_ids=retrieved_chunk_ids,
            latency_ms=latency_ms,
            ip_address=ip_address,
            metadata=metadata,
        )
