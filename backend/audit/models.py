import uuid

from django.db import models


class AuditAction(models.TextChoices):
    QUERY = "query", "RAG Query"
    INGEST = "ingest", "Document Ingested"
    DELETE_DOCUMENT = "delete_document", "Document Deleted"
    GRANT_PERMISSION = "grant_permission", "Permission Granted"
    REVOKE_PERMISSION = "revoke_permission", "Permission Revoked"
    LOGIN = "login", "User Login"
    SWITCH_USER = "switch_user", "Switched Persona"


class AuditLog(models.Model):
    """
    Append-only compliance audit ledger.
    Every RAG retrieval, document mutation, and permission change is recorded immutably.
    Row updates and deletions are prevented at both the application level and the database level.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique UUID for this audit entry",
    )
    tenant_id = models.UUIDField(
        db_index=True,
        help_text="Tenant context for strict data isolation",
    )
    user_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="User UUID who triggered the action",
    )
    user_email = models.CharField(
        max_length=255,
        blank=True,
        help_text="Email of the actor",
    )
    action = models.CharField(
        max_length=64,
        choices=AuditAction.choices,
        db_index=True,
        help_text="Standardized action type",
    )
    query_text_sanitized = models.TextField(
        blank=True,
        help_text="Sanitized query text (PII/secrets removed)",
    )
    retrieved_chunk_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Array of chunk UUIDs retrieved and provided to LLM",
    )
    denied_chunk_count = models.IntegerField(
        default=0,
        help_text="Number of candidate chunks filtered out by ACL",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Client IP address",
    )
    user_agent = models.TextField(
        blank=True,
        help_text="Client browser / SDK User-Agent string",
    )
    latency_ms = models.FloatField(
        null=True,
        blank=True,
        help_text="Operation duration in milliseconds",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extensible structured payload (e.g., document titles, group names)",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="Immutable timestamp when the event occurred",
    )

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant_id", "-created_at"], name="audit_tenant_time_idx"),
            models.Index(fields=["tenant_id", "action"], name="audit_tenant_action_idx"),
        ]

    def save(self, *args, **kwargs):
        """Enforces application-level append-only immutability."""
        if self.pk is not None and not self._state.adding:
            # Check if record already exists in database
            if AuditLog.objects.filter(pk=self.pk).exists():
                raise PermissionError("AuditLog records are append-only and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Enforces application-level append-only immutability."""
        raise PermissionError("AuditLog records are append-only and cannot be deleted.")

    def __str__(self) -> str:
        return f"[{self.created_at.isoformat()}] [{self.action}] Tenant:{self.tenant_id} User:{self.user_email}"
