import logging
from uuid import UUID

from django.db import connection
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


def set_tenant_db_context(tenant_id: UUID | str | None):
    """
    Sets or clears the PostgreSQL session variable `app.tenant_id`.
    Uses is_local=false so the variable persists through the request lifecycle,
    including through the transaction boundary started by Django's ATOMIC_REQUESTS.
    Guaranteed to be reset in TenantContextMiddleware's finally block to prevent
    connection-pool leakage.
    """
    if connection.vendor != "postgresql":
        return

    tenant_str = str(tenant_id) if tenant_id else ""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.tenant_id', %s, false);", [tenant_str])
    except Exception as exc:
        logger.warning(f"[TenantContextMiddleware] Failed to set app.tenant_id: {exc}")


class TenantContextMiddleware:
    """
    Extracts tenant_id from incoming JWT tokens (Authorization header or cookie)
    and configures PostgreSQL `app.tenant_id` for row-level security.
    Guarantees cleanup on connection release via a try/finally block.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant_id = None
        token_str = None

        # 1. Check Authorization header
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1].strip()

        # 2. Check httpOnly cookie
        if not token_str:
            token_str = request.COOKIES.get("vaultrag_access")

        if token_str:
            try:
                token = AccessToken(token_str)
                tid = token.get("tenant_id")
                if tid:
                    tenant_id = str(UUID(str(tid)))
            except Exception:
                # Invalid or expired token; leave tenant_id as None
                pass

        try:
            # Apply PostgreSQL RLS session setting
            set_tenant_db_context(tenant_id)
            response = self.get_response(request)
            return response
        finally:
            # Guarantee reset on connection to prevent context leakage across pooled requests
            set_tenant_db_context(None)
