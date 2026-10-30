import hashlib

from django.db import transaction
from rest_framework import serializers

from accounts.context import get_user_context
from ingestion.parsers import detect_file_type
from tenants.models import Group

from .models import Chunk, Document, DocumentPermission


class DocumentSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    chunk_count = serializers.IntegerField(read_only=True)
    assigned_groups = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "file_type",
            "file_size",
            "visibility",
            "status",
            "chunk_count",
            "content_hash",
            "owner_email",
            "assigned_groups",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "file_type",
            "file_size",
            "status",
            "chunk_count",
            "content_hash",
            "owner_email",
            "error_message",
            "created_at",
            "updated_at",
        ]

    def get_assigned_groups(self, obj) -> list[dict]:
        return [
            {"id": str(p.group.id), "name": p.group.name}
            for p in obj.permissions.select_related("group").all()
        ]


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)
    title = serializers.CharField(max_length=255, required=False)
    visibility = serializers.ChoiceField(
        choices=Document.Visibility.choices,
        default=Document.Visibility.PRIVATE,
    )
    group_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )

    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
    MAX_PDF_PAGES = 150

    def validate_file(self, value):
        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f"File size exceeds maximum permitted limit ({self.MAX_FILE_SIZE // (1024 * 1024)}MB)."
            )

        # Read first 2KB to inspect magic bytes
        file_bytes = value.read(2048)
        value.seek(0)

        detected_type, is_valid = detect_file_type(file_bytes, value.name)
        if not is_valid:
            raise serializers.ValidationError(
                f"Unsupported or malformed file type detected: {detected_type}. Only PDF, DOCX, TXT, and Markdown are allowed."
            )

        # Upload hardening: inspect PDF page count to prevent resource exhaustion / decompression bombs
        if detected_type == "application/pdf":
            try:
                import pymupdf

                full_bytes = value.read()
                value.seek(0)
                doc = pymupdf.open(stream=full_bytes, filetype="pdf")
                page_count = len(doc)
                doc.close()
                if page_count > self.MAX_PDF_PAGES:
                    raise serializers.ValidationError(
                        f"PDF page count exceeds maximum allowable limit ({page_count} pages > {self.MAX_PDF_PAGES} max)."
                    )
            except serializers.ValidationError:
                raise
            except Exception:
                pass

        return value

    def create(self, validated_data):
        request = self.context["request"]
        user_ctx = get_user_context(request)
        user = request.user

        uploaded_file = validated_data["file"]
        title = validated_data.get("title") or uploaded_file.name
        visibility = validated_data.get("visibility", Document.Visibility.PRIVATE)
        group_ids = validated_data.get("group_ids", [])

        # Read all bytes to compute SHA-256 content hash and detect full MIME type
        file_bytes = uploaded_file.read()
        uploaded_file.seek(0)

        content_hash = hashlib.sha256(file_bytes).hexdigest()
        detected_type, _ = detect_file_type(file_bytes[:2048], uploaded_file.name)

        # Check for deduplication within this tenant
        existing_doc = Document.objects.filter(
            tenant_id=user_ctx.tenant_id,
            content_hash=content_hash,
            status=Document.Status.READY,
        ).first()

        with transaction.atomic():
            document = Document.objects.create(
                tenant_id=user_ctx.tenant_id,
                owner=user,
                title=title,
                file=uploaded_file,
                file_type=detected_type,
                file_size=uploaded_file.size,
                content_hash=content_hash,
                visibility=visibility,
                status=Document.Status.READY if existing_doc else Document.Status.UPLOADED,
                metadata=dict(existing_doc.metadata) if existing_doc else {},
            )

            # Assign group permissions if visibility is group
            if visibility == Document.Visibility.GROUP and group_ids:
                valid_groups = Group.objects.filter(
                    tenant_id=user_ctx.tenant_id, id__in=group_ids
                )
                permissions_to_create = [
                    DocumentPermission(document=document, group=grp) for grp in valid_groups
                ]
                DocumentPermission.objects.bulk_create(permissions_to_create)

            # If deduplicated, clone existing chunks into new document to prevent 0-chunk ghost documents
            if existing_doc:
                existing_chunks = Chunk.objects.filter(document=existing_doc).order_by("position")
                chunks_to_clone = [
                    Chunk(
                        tenant_id=user_ctx.tenant_id,
                        document=document,
                        position=chunk.position,
                        text=chunk.text,
                        embedding=chunk.embedding,
                        metadata=dict(chunk.metadata),
                    )
                    for chunk in existing_chunks
                ]
                if chunks_to_clone:
                    Chunk.objects.bulk_create(chunks_to_clone)

        return document, existing_doc is not None
