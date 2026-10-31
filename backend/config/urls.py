"""
VaultRAG URL Configuration.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.tokens import VaultRAGTokenObtainPairView
from accounts.views import CurrentUserView
from config.views import LivenessCheckView, ReadinessCheckView
from documents.views import DocumentDetailView, DocumentListCreateView


def health_check(request):
    """Basic health check endpoint."""
    return JsonResponse(
        {
            "status": "healthy",
            "service": "vaultrag-backend",
            "version": "1.0.0",
        }
    )


urlpatterns = [
    # Production Health & Readiness Probes
    path("healthz", LivenessCheckView.as_view(), name="liveness_probe"),
    path("readyz", ReadinessCheckView.as_view(), name="readiness_probe"),
    path("health/", health_check, name="health-check"),
    path("api/health/", health_check, name="api-health-check"),
    # Django Admin
    path("admin/", admin.site.urls),
    # Authentication & User Context
    path(
        "api/auth/token/",
        VaultRAGTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", CurrentUserView.as_view(), name="auth_me"),
    # Document Ingestion & Management
    path(
        "api/v1/documents/",
        DocumentListCreateView.as_view(),
        name="document_list_create",
    ),
    path(
        "api/v1/documents/upload/",
        DocumentListCreateView.as_view(),
        name="document_upload",
    ),
    path(
        "api/v1/documents/<uuid:pk>/",
        DocumentDetailView.as_view(),
        name="document_detail",
    ),
    # Semantic Retrieval & Search
    path("api/v1/retrieval/", include("retrieval.urls")),
    # Anti-Leak RAG Chat & Generation
    path("api/v1/chat/", include("chat.urls")),
    # Compliance & Audit Logging
    path("api/v1/audit/", include("audit.urls")),
    # Tenant Administration & Access Explorer
    path("api/v1/tenants/", include("tenants.urls")),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
