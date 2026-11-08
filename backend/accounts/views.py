from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from tenants.models import Group

from .context import get_user_context


class LogoutView(APIView):
    """
    Invalidates the user's refresh token by adding it to the SimpleJWT blacklist.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"detail": "Refresh token successfully blacklisted."},
                status=status.HTTP_200_OK,
            )
        except TokenError as exc:
            return Response(
                {"error": f"Invalid or expired token: {str(exc)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class CurrentUserView(APIView):
    """
    Returns the authenticated user's current UserContext, profile,
    and all organization memberships available for switching.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_ctx = get_user_context(request)
        user = request.user

        # Fetch all active tenant memberships for this user
        memberships = (
            user.tenant_memberships.select_related("tenant")
            .filter(tenant__is_active=True)
            .order_by("tenant__name")
        )

        tenants_data = [
            {
                "id": str(m.tenant.id),
                "name": m.tenant.name,
                "slug": m.tenant.slug,
                "role": m.role,
                "is_current": m.tenant.id == user_ctx.tenant_id,
            }
            for m in memberships
        ]

        # Fetch groups for the current tenant
        current_groups = list(
            user.group_memberships.filter(group__tenant_id=user_ctx.tenant_id)
            .select_related("group")
            .values("group__id", "group__name")
        )

        # For tenant admins without explicit group assignments, surface all tenant groups
        if user_ctx.is_admin() and not current_groups:
            tenant_all_groups = Group.objects.filter(tenant_id=user_ctx.tenant_id).values("id", "name")
            current_groups = [
                {"group__id": g["id"], "group__name": g["name"]}
                for g in tenant_all_groups
            ]

        resolved_group_ids = [str(gid) for gid in user_ctx.group_ids]
        if not resolved_group_ids and user_ctx.is_admin():
            resolved_group_ids = [str(g["group__id"]) for g in current_groups]

        return Response(
            {
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                },
                "context": {
                    "tenant_id": str(user_ctx.tenant_id),
                    "role": user_ctx.role,
                    "is_admin": user_ctx.is_admin(),
                    "group_ids": resolved_group_ids,
                    "groups": [g["group__name"] for g in current_groups],
                },
                "tenants": tenants_data,
            },
            status=status.HTTP_200_OK,
        )
