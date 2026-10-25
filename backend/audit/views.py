from rest_framework import permissions, status
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.context import get_user_context

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogPagination(LimitOffsetPagination):
    default_limit = 25
    max_limit = 100


class AuditLogListView(APIView):
    """
    List tenant-scoped compliance audit log entries.
    Only accessible by authenticated members of the tenant.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_ctx = get_user_context(request)
        if not user_ctx.tenant_id:
            return Response(
                {"detail": "No active tenant context."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = AuditLog.objects.filter(tenant_id=user_ctx.tenant_id)

        # Filtering
        action = request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        user_email = request.query_params.get("user_email")
        if user_email:
            queryset = queryset.filter(user_email__icontains=user_email)

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(query_text_sanitized__icontains=search)

        paginator = AuditLogPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AuditLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
