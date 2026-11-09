"""Owner-only API for reviewing self-service registration requests."""

import logging
import uuid

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.models import RegistrationRequest
from tenants.notifications import notify_applicant_decision

logger = logging.getLogger(__name__)

LIST_LIMIT = 200
VALID_FILTERS = {s.value for s in RegistrationRequest.Status} | {"all"}


class IsPlatformOwner(BasePermission):
    """Only the platform owner (a Django superuser) may review registrations.

    Read from the database on every request, so removing the flag takes effect
    immediately even for tokens that are still unexpired.
    """

    message = "Platform owner access required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.is_superuser
        )


def _serialize(reg: RegistrationRequest) -> dict:
    return {
        "id": str(reg.id),
        "company_name": reg.company_name,
        "admin_name": reg.admin_name,
        "admin_email": reg.admin_email,
        "departments": reg.departments or [],
        "status": reg.status,
        "source_ip": reg.source_ip,
        "decision_note": reg.decision_note,
        "tenant_id": str(reg.tenant_id) if reg.tenant_id else None,
        "created_at": reg.created_at.isoformat(),
        "decided_at": reg.decided_at.isoformat() if reg.decided_at else None,
    }


class PlatformRegistrationListView(APIView):
    """GET /api/v1/tenants/platform/registrations/?status=pending|approved|rejected|all"""

    permission_classes = [IsAuthenticated, IsPlatformOwner]

    def get(self, request: Request) -> Response:
        wanted = request.query_params.get("status", "pending").lower()
        if wanted not in VALID_FILTERS:
            return Response(
                {"detail": f"Invalid status. Choose one of: {sorted(VALID_FILTERS)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = RegistrationRequest.objects.all()
        if wanted != "all":
            qs = qs.filter(status=wanted)

        counts = {s.value: 0 for s in RegistrationRequest.Status}
        for row in RegistrationRequest.objects.values_list("status", flat=True):
            counts[row] = counts.get(row, 0) + 1

        return Response(
            {
                "counts": counts,
                "results": [_serialize(r) for r in qs.order_by("-created_at")[:LIST_LIMIT]],
            }
        )


class PlatformRegistrationDecisionView(APIView):
    """POST /api/v1/tenants/platform/registrations/<uuid>/<approve|reject>/"""

    permission_classes = [IsAuthenticated, IsPlatformOwner]

    def post(self, request: Request, pk: uuid.UUID, action: str) -> Response:
        if action not in ("approve", "reject"):
            return Response(
                {"detail": "Unknown action."}, status=status.HTTP_404_NOT_FOUND
            )

        note = str(request.data.get("note") or "").strip()[:1000]

        try:
            with transaction.atomic():
                # Lock the row so two clicks (or two owners) cannot decide it twice.
                reg = RegistrationRequest.objects.select_for_update().get(pk=pk)
                if action == "approve":
                    reg.approve(note=note)
                else:
                    reg.reject(note=note)
        except RegistrationRequest.DoesNotExist:
            return Response(
                {"detail": "Registration request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)

        notify_applicant_decision(reg)
        logger.info(
            "Registration request %s %sd by %s",
            reg.id,
            action,
            request.user.email,
        )
        return Response(_serialize(reg), status=status.HTTP_200_OK)
