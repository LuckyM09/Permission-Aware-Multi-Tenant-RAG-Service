import logging
from uuid import UUID

from django.db import transaction
from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.context import UserContext, get_user_context
from accounts.models import User
from audit.models import AuditAction, AuditLog
from documents.models import Document
from documents.permissions import get_permitted_documents_q
from tenants.models import Group, GroupMember, Membership, Role, Tenant
from tenants.serializers import (
    AccessExplorerRequestSerializer,
    GroupMemberActionSerializer,
    GroupSerializer,
    TenantMemberRoleUpdateSerializer,
    TenantMemberSerializer,
)

logger = logging.getLogger(__name__)


def _require_admin(user_ctx: UserContext) -> Response | None:
    """Enforces tenant admin role. Returns 403 response if unauthorized."""
    if not user_ctx.is_admin():
        return Response(
            {"detail": "Administrator access required for this action."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


class TenantMemberListCreateView(APIView):
    """
    List tenant members and roles, or add an existing user to the tenant.
    Admin only.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        memberships = (
            Membership.objects.filter(tenant_id=user_ctx.tenant_id)
            .select_related("user", "tenant")
            .order_by("user__email")
        )
        serializer = TenantMemberSerializer(memberships, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        """Add an existing user into this tenant."""
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        email = request.data.get("email", "").strip().lower()
        role = request.data.get("role", Role.MEMBER)

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in Role.values:
            return Response(
                {"detail": f"Invalid role '{role}'. Choices: {Role.values}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"detail": f"No registered user found with email '{email}'."},
                status=status.HTTP_404_NOT_FOUND,
            )

        tenant = Tenant.objects.get(id=user_ctx.tenant_id)
        membership, created = Membership.objects.get_or_create(
            tenant=tenant,
            user=target_user,
            defaults={"role": role},
        )
        if not created:
            return Response(
                {"detail": "User is already a member of this tenant."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        AuditLog.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.GRANT_PERMISSION,
            query_text_sanitized=f"Added member {email} with role {role}",
        )

        return Response(
            TenantMemberSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class TenantMemberDetailView(APIView):
    """
    Update member role or remove member from tenant.
    Admin only.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, pk: UUID) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        try:
            membership = Membership.objects.select_related("user").get(
                id=pk, tenant_id=user_ctx.tenant_id
            )
        except Membership.DoesNotExist:
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TenantMemberRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data["role"]

        # Prevent demoting the last remaining admin
        if (
            membership.role == Role.ADMIN
            and new_role != Role.ADMIN
            and Membership.objects.filter(
                tenant_id=user_ctx.tenant_id, role=Role.ADMIN
            ).count()
            <= 1
        ):
            return Response(
                {"detail": "Cannot demote the last administrator of the tenant."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_role = membership.role
        membership.role = new_role
        membership.save(update_fields=["role", "updated_at"])

        AuditLog.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.GRANT_PERMISSION,
            query_text_sanitized=f"Changed {membership.user.email} role from {old_role} to {new_role}",
        )

        return Response(TenantMemberSerializer(membership).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, pk: UUID) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        try:
            membership = Membership.objects.select_related("user").get(
                id=pk, tenant_id=user_ctx.tenant_id
            )
        except Membership.DoesNotExist:
            return Response(
                {"detail": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent deleting the last admin
        if (
            membership.role == Role.ADMIN
            and Membership.objects.filter(
                tenant_id=user_ctx.tenant_id, role=Role.ADMIN
            ).count()
            <= 1
        ):
            return Response(
                {"detail": "Cannot remove the last administrator of the tenant."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_email = membership.user.email
        with transaction.atomic():
            # Remove group memberships within this tenant
            GroupMember.objects.filter(
                group__tenant_id=user_ctx.tenant_id,
                user=membership.user,
            ).delete()
            membership.delete()

        AuditLog.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.REVOKE_PERMISSION,
            query_text_sanitized=f"Removed member {user_email} from tenant",
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class TenantGroupListCreateView(APIView):
    """
    List access groups or create a new group.
    Admin only for POST; viewable by all tenant members for GET.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user_ctx = get_user_context(request)
        groups = (
            Group.objects.filter(tenant_id=user_ctx.tenant_id)
            .annotate(annotated_member_count=Count("memberships"))
            .order_by("name")
        )
        return Response(GroupSerializer(groups, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        serializer = GroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data["name"]
        if Group.objects.filter(tenant_id=user_ctx.tenant_id, name=name).exists():
            return Response(
                {"detail": f"A group named '{name}' already exists in this tenant."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tenant = Tenant.objects.get(id=user_ctx.tenant_id)
        group = Group.objects.create(
            tenant=tenant,
            name=name,
            description=serializer.validated_data.get("description", ""),
        )

        AuditLog.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.GRANT_PERMISSION,
            query_text_sanitized=f"Created group '{name}'",
        )

        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


class TenantGroupDetailView(APIView):
    """
    Retrieve, update, or delete a specific access group.
    Admin only for PATCH and DELETE.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: UUID) -> Response:
        user_ctx = get_user_context(request)
        try:
            group = Group.objects.get(id=pk, tenant_id=user_ctx.tenant_id)
        except Group.DoesNotExist:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(GroupSerializer(group).data, status=status.HTTP_200_OK)

    def patch(self, request: Request, pk: UUID) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        try:
            group = Group.objects.get(id=pk, tenant_id=user_ctx.tenant_id)
        except Group.DoesNotExist:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get("name", group.name).strip()
        description = request.data.get("description", group.description)

        if not name:
            return Response({"detail": "Group name cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        if (
            name != group.name
            and Group.objects.filter(tenant_id=user_ctx.tenant_id, name=name).exclude(id=pk).exists()
        ):
            return Response(
                {"detail": f"Another group named '{name}' already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        group.name = name
        group.description = description
        group.save(update_fields=["name", "description", "updated_at"])

        return Response(GroupSerializer(group).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, pk: UUID) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        try:
            group = Group.objects.get(id=pk, tenant_id=user_ctx.tenant_id)
        except Group.DoesNotExist:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        group_name = group.name
        group.delete()

        AuditLog.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.REVOKE_PERMISSION,
            query_text_sanitized=f"Deleted group '{group_name}'",
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class TenantGroupMemberManageView(APIView):
    """
    Add or remove a member from an access group.
    Admin only.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, pk: UUID) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        try:
            group = Group.objects.get(id=pk, tenant_id=user_ctx.tenant_id)
        except Group.DoesNotExist:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = GroupMemberActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_user_id = serializer.validated_data["user_id"]

        # Ensure target user belongs to this tenant
        try:
            membership = Membership.objects.select_related("user").get(
                tenant_id=user_ctx.tenant_id, user_id=target_user_id
            )
        except Membership.DoesNotExist:
            return Response(
                {"detail": "User is not a member of this tenant."},
                status=status.HTTP_404_NOT_FOUND,
            )

        gm, created = GroupMember.objects.get_or_create(group=group, user=membership.user)
        if not created:
            return Response(
                {"detail": "User is already a member of this group."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        AuditLog.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.GRANT_PERMISSION,
            query_text_sanitized=f"Added {membership.user.email} to group '{group.name}'",
        )

        return Response(GroupSerializer(group).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, pk: UUID) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        try:
            group = Group.objects.get(id=pk, tenant_id=user_ctx.tenant_id)
        except Group.DoesNotExist:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = GroupMemberActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_user_id = serializer.validated_data["user_id"]

        try:
            gm = GroupMember.objects.select_related("user").get(group=group, user_id=target_user_id)
        except GroupMember.DoesNotExist:
            return Response(
                {"detail": "User is not in this group."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_email = gm.user.email
        gm.delete()

        AuditLog.objects.create(
            tenant_id=user_ctx.tenant_id,
            user_id=user_ctx.user_id,
            user_email=user_ctx.email,
            action=AuditAction.REVOKE_PERMISSION,
            query_text_sanitized=f"Removed {user_email} from group '{group.name}'",
        )

        return Response(GroupSerializer(group).data, status=status.HTTP_200_OK)


class AccessExplorerView(APIView):
    """
    Authoritative Access Explorer Simulation.
    Evaluates every document in the tenant against a selected user's permissions,
    explaining exactly why access is ALLOWED or DENIED using documents.permissions (Rule 4 SSOT).
    Admin only.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        serializer = AccessExplorerRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_user_id = serializer.validated_data["user_id"]

        # Ensure target user belongs to this tenant
        try:
            target_membership = Membership.objects.select_related("user").get(
                tenant_id=user_ctx.tenant_id, user_id=target_user_id
            )
        except Membership.DoesNotExist:
            return Response(
                {"detail": "Target user is not a member of this tenant."},
                status=status.HTTP_404_NOT_FOUND,
            )

        target_user = target_membership.user
        target_group_memberships = (
            GroupMember.objects.filter(group__tenant_id=user_ctx.tenant_id, user=target_user)
            .select_related("group")
            .order_by("group__name")
        )
        target_group_ids = tuple(gm.group.id for gm in target_group_memberships)
        target_group_names = {gm.group.id: gm.group.name for gm in target_group_memberships}

        # Build authoritative synthetic UserContext for target user
        target_ctx = UserContext(
            tenant_id=user_ctx.tenant_id,
            user_id=target_user.id,
            email=target_user.email,
            role=target_membership.role,
            group_ids=target_group_ids,
        )

        # Retrieve set of permitted document IDs via Single Source of Truth
        permitted_doc_ids = set(
            Document.objects.filter(get_permitted_documents_q(target_ctx)).values_list("id", flat=True)
        )

        # Evaluate all tenant documents with detailed policy reasoning
        all_tenant_docs = (
            Document.objects.filter(tenant_id=user_ctx.tenant_id)
            .select_related("owner")
            .prefetch_related("permissions__group", "chunks")
            .order_by("-created_at")
        )

        results = []
        accessible_count = 0
        denied_count = 0

        for doc in all_tenant_docs:
            is_permitted = doc.id in permitted_doc_ids
            matched_rules = []

            if is_permitted:
                accessible_count += 1
                if target_ctx.is_admin():
                    matched_rules.append("ADMIN_OVERRIDE (Full Tenant Access)")
                else:
                    if doc.owner_id == target_ctx.user_id:
                        matched_rules.append("OWNER")
                    if doc.visibility == Document.Visibility.TENANT:
                        matched_rules.append("TENANT_PUBLIC")
                    if doc.visibility == Document.Visibility.GROUP:
                        doc_group_ids = {p.group_id for p in doc.permissions.all()}
                        shared_groups = set(target_group_ids) & doc_group_ids
                        for gid in shared_groups:
                            matched_rules.append(f"GROUP_MEMBER ({target_group_names.get(gid, 'Group')})")
                access_status = "ALLOWED"
            else:
                denied_count += 1
                access_status = "DENIED"
                if doc.visibility == Document.Visibility.PRIVATE:
                    matched_rules.append(f"PRIVATE_DOCUMENT (Owned by {doc.owner.email})")
                elif doc.visibility == Document.Visibility.GROUP:
                    doc_group_names = [p.group.name for p in doc.permissions.all()]
                    group_str = ", ".join(doc_group_names) if doc_group_names else "unspecified"
                    matched_rules.append(f"GROUP_RESTRICTED (Requires: {group_str})")
                else:
                    matched_rules.append(f"RESTRICTED (Status: {doc.status})")

            results.append(
                {
                    "document_id": doc.id,
                    "title": doc.title,
                    "visibility": doc.visibility,
                    "owner_email": doc.owner.email,
                    "status": doc.status,
                    "access_status": access_status,
                    "matched_rules": matched_rules,
                    "chunk_count": len(doc.chunks.all()),
                }
            )

        response_data = {
            "target_user": {
                "user_id": str(target_user.id),
                "email": target_user.email,
                "role": target_membership.role,
                "groups": [
                    {"id": str(gid), "name": name}
                    for gid, name in target_group_names.items()
                ],
            },
            "total_documents": len(results),
            "accessible_documents": accessible_count,
            "denied_documents": denied_count,
            "documents": results,
        }

        return Response(response_data, status=status.HTTP_200_OK)
