import logging

from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.context import get_user_context
from ingestion.tasks import ingest_document_task

from .models import Document
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

        # Scoped queryset based on user role and permissions
        if user_ctx.is_admin():
            queryset = Document.objects.filter(tenant_id=user_ctx.tenant_id)
        else:
            # Members and Viewers see: tenant-wide OR owned OR their permitted groups
            queryset = Document.objects.filter(
                Q(tenant_id=user_ctx.tenant_id)
                & (
                    Q(visibility=Document.Visibility.TENANT)
                    | Q(owner_id=user_ctx.user_id)
                    | (
                        Q(visibility=Document.Visibility.GROUP)
                        & Q(permissions__group_id__in=user_ctx.group_ids)
                    )
                )
            ).distinct()

        serializer = DocumentSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DocumentUploadSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        document, was_deduplicated = serializer.save()

        # Enqueue ingestion task
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

        # Non-admins can only view if permitted
        if not user_ctx.is_admin():
            is_permitted = (
                document.visibility == Document.Visibility.TENANT
                or document.owner_id == user_ctx.user_id
                or (
                    document.visibility == Document.Visibility.GROUP
                    and document.permissions.filter(
                        group_id__in=user_ctx.group_ids
                    ).exists()
                )
            )
            if not is_permitted:
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

        # Only owner or Tenant Admin can delete
        if not user_ctx.is_admin() and document.owner_id != user_ctx.user_id:
            return Response(
                {"detail": "You do not have permission to delete this document."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Delete document (cascades to chunks and embeddings)
        if document.file:
            document.file.delete(save=False)
        document.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
