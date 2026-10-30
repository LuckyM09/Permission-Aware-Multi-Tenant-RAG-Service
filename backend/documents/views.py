import logging

from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.context import get_user_context
from ingestion.tasks import ingest_document_task

from .models import Document
from .permissions import (
    can_delete_document,
    can_view_document,
    get_permitted_documents_q,
)
from .serializers import DocumentSerializer, DocumentUploadSerializer

logger = logging.getLogger(__name__)


class DocumentListCreateView(APIView):
    """
    List tenant-accessible documents or upload a new document for ingestion.
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        user_ctx = get_user_context(request)

        # Scoped queryset using Single Source of Truth for Permissions (Rule 4)
        queryset = Document.objects.filter(
            get_permitted_documents_q(user_ctx)
        ).distinct()

        serializer = DocumentSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        user_ctx = get_user_context(request)

        # Role enforcement: Viewers cannot upload documents
        if not user_ctx.is_member_or_admin():
            return Response(
                {"detail": "Viewers are not permitted to upload documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DocumentUploadSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        document, was_deduplicated = serializer.save()

        # Enqueue ingestion task if not deduplicated
        if not was_deduplicated:
            try:
                ingest_document_task.delay(str(document.id))
            except Exception as exc:
                # If Celery worker/Redis is not running (e.g. lightweight local dev), run synchronously
                logger.warning(
                    f"Celery dispatch failed ({exc}), falling back to synchronous ingestion."
                )
                try:
                    ingest_document_task(str(document.id))
                except Exception as sync_exc:
                    logger.error(f"Synchronous ingestion failed: {sync_exc}")

        # Record audit log
        if user_ctx.tenant_id:
            from audit.models import AuditAction
            from audit.services import AuditService

            AuditService.log_event(
                tenant_id=user_ctx.tenant_id,
                action=AuditAction.INGEST,
                user_id=user_ctx.user_id,
                user_email=user_ctx.email,
                query_text_sanitized=f"Uploaded '{document.title}' ({document.file_type})",
                ip_address=request.META.get("REMOTE_ADDR"),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                metadata={
                    "document_id": str(document.id),
                    "file_size": document.file_size,
                    "visibility": document.visibility,
                    "deduplicated": was_deduplicated,
                },
            )

        return Response(
            {
                "message": "Document uploaded successfully.",
                "deduplicated": was_deduplicated,
                "document": DocumentSerializer(document).data,
            },
            status=status.HTTP_201_CREATED,
        )


class DocumentDetailView(APIView):
    """
    Retrieve document status or delete a document.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_document_or_404(self, request, pk):
        user_ctx = get_user_context(request)

        try:
            document = Document.objects.get(id=pk, tenant_id=user_ctx.tenant_id)
        except Document.DoesNotExist:
            return None, Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Single source of truth check
        if not can_view_document(user_ctx, document):
            return None, Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return document, None

    def get(self, request, pk):
        document, error_response = self._get_document_or_404(request, pk)
        if error_response:
            return error_response

        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        user_ctx = get_user_context(request)
        document, error_response = self._get_document_or_404(request, pk)
        if error_response:
            return error_response

        # Golden Rule 7: Zero-Enumeration - return 404 rather than 403 to prevent enumeration
        if not can_delete_document(user_ctx, document):
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Record audit log before deletion
        from audit.models import AuditAction
        from audit.services import AuditService

        doc_title = document.title
        doc_id = str(document.id)

        # Delete document (cascades to chunks and embeddings)
        if document.file:
            document.file.delete(save=False)
        document.delete()

        AuditService.log_event(
            tenant_id=user_ctx.tenant_id,
            action=AuditAction.DELETE_DOCUMENT,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            query_text_sanitized=f"Deleted '{doc_title}' ({doc_id})",
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            metadata={"document_id": doc_id, "title": doc_title},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
