import uuid

from django.conf import settings
from django.db import models
from pgvector.django import HnswIndex as PgVectorHnswIndex
from pgvector.django import VectorField

from tenants.models import Group, Tenant


class CompatibleHnswIndex(PgVectorHnswIndex):
    """
    Subclasses HnswIndex to safely bypass index generation on non-PostgreSQL
    backends (e.g. SQLite test runners). On PostgreSQL, creates the full HNSW index.
    """

    def create_sql(self, model, schema_editor, using="", **kwargs):
        if schema_editor.connection.vendor != "postgresql":
            return ""
        return super().create_sql(model, schema_editor, using=using, **kwargs)

    def remove_sql(self, model, schema_editor, **kwargs):
        if schema_editor.connection.vendor != "postgresql":
            return ""
        return super().remove_sql(model, schema_editor, **kwargs)


class Document(models.Model):
    """
    Represents an ingested file owned by a Tenant.
    Carries access visibility rules (private, group, tenant-wide).
    """

    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private (Owner Only)"
        GROUP = "group", "Group Restricted"
        TENANT = "tenant", "Tenant-Wide"

    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the document",
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="documents",
        help_text="Tenant that owns this document",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_documents",
        help_text="User who uploaded this document",
    )
    title = models.CharField(
        max_length=255, help_text="Document title / original filename"
    )
    file = models.FileField(
        upload_to="documents/%Y/%m/",
        blank=True,
        null=True,
        help_text="Uploaded source file",
    )
    file_type = models.CharField(
        max_length=50,
        default="application/octet-stream",
        help_text="Detected MIME type (via magic bytes)",
    )
    file_size = models.PositiveIntegerField(
        default=0,
        help_text="File size in bytes",
    )
    storage_key = models.CharField(
        max_length=500,
        blank=True,
        help_text="Storage identifier / S3 object key",
    )
    content_hash = models.CharField(
        max_length=64,
        db_index=True,
        help_text="SHA-256 hash of file content for deduplication",
    )
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PRIVATE,
        help_text="Access control visibility scope",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPLOADED,
        help_text="Current ingestion state",
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error details if ingestion failed",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Arbitrary document metadata (page count, headers, etc.)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Document"
        verbose_name_plural = "Documents"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "content_hash"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.tenant.name} - {self.status})"

    @property
    def chunk_count(self) -> int:
        return self.chunks.count()


class DocumentPermission(models.Model):
    """
    ACL mapping table: Grants explicit read access on a group-scoped document
    to members of the specified Group.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="permissions",
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="document_permissions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Document Permission"
        verbose_name_plural = "Document Permissions"
        unique_together = ("document", "group")

    def __str__(self) -> str:
        return f"Access to '{self.document.title}' for group '{self.group.name}'"


class Chunk(models.Model):
    """
    A segmented text passage with its corresponding 1,536-dimensional vector embedding.
    Carries foreign keys to Document and Tenant for instant SQL pre-filtering.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="chunks",
        db_index=True,
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    position = models.PositiveIntegerField(
        help_text="Sequence index of the chunk within the parent document (0-indexed)",
    )
    text = models.TextField(help_text="Extracted chunk text passage")
    embedding = VectorField(
        dimensions=1536,
        help_text="1,536-dimensional dense vector embedding",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Chunk-level metadata (token count, character offset, etc.)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Chunk"
        verbose_name_plural = "Chunks"
        ordering = ["document", "position"]
        indexes = [
            models.Index(fields=["tenant", "document"]),
            CompatibleHnswIndex(
                name="chunk_vec_hnsw_idx",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]

    def __str__(self) -> str:
        return f"Chunk #{self.position} of '{self.document.title}'"
