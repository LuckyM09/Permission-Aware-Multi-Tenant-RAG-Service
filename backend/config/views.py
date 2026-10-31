import datetime
import logging

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from rest_framework import status
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class LivenessCheckView(APIView):
    """
    Kubernetes / Docker liveness probe (/healthz).
    Returns 200 OK if the application process is running and accepting HTTP requests.
    """

    permission_classes = []
    authentication_classes = []

    def get(self, request):
        return JsonResponse(
            {
                "status": "alive",
                "service": "vaultrag-backend",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class ReadinessCheckView(APIView):
    """
    Kubernetes / Docker readiness probe (/readyz).
    Verifies that all downstream dependencies (PostgreSQL database, pgvector, Redis)
    are healthy before routing traffic.
    """

    permission_classes = []
    authentication_classes = []

    def get(self, request):
        checks = {}
        all_healthy = True

        # 1. Database Connection & pgvector
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                checks["database"] = "healthy"
                if connection.vendor == "postgresql":
                    cursor.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
                    row = cursor.fetchone()
                    checks["pgvector"] = f"installed (v{row[0]})" if row else "missing"
                    if not row:
                        all_healthy = False
        except Exception as exc:
            logger.error("Readiness check database failure: %s", exc)
            checks["database"] = f"unhealthy: {exc}"
            all_healthy = False

        # 2. Redis Cache & Broker Connectivity
        try:
            cache.set("__readiness_ping__", "pong", 5)
            val = cache.get("__readiness_ping__")
            if val == "pong":
                checks["cache_broker"] = "healthy"
            else:
                checks["cache_broker"] = "unresponsive"
                all_healthy = False
        except Exception as exc:
            # Cache failure is a warning in non-critical dev environments but tracked
            logger.warning("Readiness check cache warning: %s", exc)
            checks["cache_broker"] = f"degraded: {exc}"

        resp_status = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        return JsonResponse(
            {
                "status": "ready" if all_healthy else "unready",
                "checks": checks,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            },
            status=resp_status,
        )
