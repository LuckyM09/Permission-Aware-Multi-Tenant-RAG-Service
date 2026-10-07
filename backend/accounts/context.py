from dataclasses import dataclass
from uuid import UUID

from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request


@dataclass(frozen=True)
class UserContext:
    """
    Immutable representation of an authenticated user's tenant-scoped authorization context.
    Every retrieval query, citation verification, and ACL evaluation requires a UserContext.
    """

    tenant_id: UUID
    user_id: UUID
    email: str
    role: str  # "admin", "member", "viewer"
    group_ids: tuple[UUID, ...]  # Immutable tuple of group UUIDs

    def is_admin(self) -> bool:
        return self.role == "admin"

    def is_member_or_admin(self) -> bool:
        return self.role in ("admin", "member")


def get_user_context(request: Request) -> UserContext:
    """
    Extracts and validates the UserContext from the authenticated request's JWT payload.
    Raises AuthenticationFailed if required claims are missing or malformed.
    """
    if not request.user or not request.user.is_authenticated:
        raise AuthenticationFailed("Authentication credentials were not provided.")

    token = getattr(request, "auth", None)

    # 1. Primary path: Resolve claims from the verified JWT payload
    if token and isinstance(token, dict):
        try:
            tenant_id_str = token.get("tenant_id")
            if not tenant_id_str:
                raise AuthenticationFailed("Token is missing tenant_id claim.")

            tenant_id = UUID(str(tenant_id_str))
            user_id = UUID(str(token.get("user_id", request.user.id)))
            role = str(token.get("role", "member"))
            group_id_strs = token.get("groups", [])
            group_ids = tuple(UUID(str(gid)) for gid in group_id_strs)

            return UserContext(
                tenant_id=tenant_id,
                user_id=user_id,
                email=str(token.get("email", request.user.email)),
                role=role,
                group_ids=group_ids,
            )
        except (ValueError, TypeError) as exc:
            raise AuthenticationFailed(
                f"Malformed claims in authentication token: {exc}"
            ) from exc

    # 2. Fallback path (e.g. SessionAuth, testing, or token without claims): Resolve from database
    membership = (
        request.user.tenant_memberships.select_related("tenant")
        .filter(tenant__is_active=True)
        .order_by("-is_default", "-created_at")
        .first()
    )

    if not membership:
        raise AuthenticationFailed("User is not associated with any active tenant.")

    group_ids = tuple(
        request.user.group_memberships.filter(
            group__tenant=membership.tenant
        ).values_list("group_id", flat=True)
    )

    return UserContext(
        tenant_id=membership.tenant.id,
        user_id=request.user.id,
        email=request.user.email,
        role=membership.role,
        group_ids=group_ids,
    )
