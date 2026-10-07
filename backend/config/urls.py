"""
VaultRAG URL Configuration.
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.tokens import VaultRAGTokenObtainPairView
from accounts.views import CurrentUserView
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
    # Health checks
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
        "api/v1/documents/<uuid:pk>/",
        DocumentDetailView.as_view(),
        name="document_detail",
    ),
]
