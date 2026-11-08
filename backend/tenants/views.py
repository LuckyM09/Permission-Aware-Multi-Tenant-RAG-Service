import logging
import secrets
import uuid
from uuid import UUID

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.utils.text import slugify
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.context import UserContext, get_user_context
from accounts.models import User
from audit.models import AuditAction, AuditLog
from documents.models import Document
from documents.permissions import get_permitted_documents_q
from tenants.models import Group, GroupMember, Membership, Role, Tenant
from tenants.serializers import (
    AccessExplorerRequestSerializer,
    ContactInquirySerializer,
    GroupMemberActionSerializer,
    GroupSerializer,
    TenantMemberRoleUpdateSerializer,
    TenantMemberSerializer,
    TenantRegistrationSerializer,
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


class TenantRegistrationView(APIView):
    """
    Public self-service endpoint for registering a new tenant organization.
    Creates the Tenant, initial Admin User, Membership, and default Groups.
    Returns JWT access & refresh tokens with tenant-scoped claims.
    """

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        from django.conf import settings

        allow_public = getattr(settings, "ALLOW_PUBLIC_TENANT_REGISTRATION", True)
        invite_code = (request.data.get("invite_code") or "").strip()
        required_code = getattr(settings, "TENANT_REGISTRATION_INVITE_CODE", "")

        if not allow_public and (not required_code or invite_code != required_code):
            return Response(
                {"detail": "Public tenant registration is disabled. An enterprise invitation code is required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TenantRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        company_name = data["company_name"].strip()
        raw_slug = (data.get("company_slug") or "").strip()
        base_slug = slugify(raw_slug or company_name)
        if not base_slug:
            base_slug = f"tenant-{uuid.uuid4().hex[:6]}"

        slug = base_slug
        counter = 1
        while Tenant.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        admin_email = data["admin_email"].strip().lower()
        admin_password = data["admin_password"]
        admin_name = (data.get("admin_name") or "").strip()
        departments = data.get("departments") or ["Engineering", "Finance", "Human Resources"]

        if admin_name:
            name_parts = admin_name.split(maxsplit=1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
        else:
            first_name = admin_email.split("@")[0].capitalize()
            last_name = "Admin"

        with transaction.atomic():
            user = User.objects.filter(email=admin_email).first()
            if user:
                return Response(
                    {
                        "detail": "Registration could not be completed. If you already have an account, sign in and create the organization from your workspace."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            else:
                user = User.objects.create_user(
                    email=admin_email,
                    password=admin_password,
                    first_name=first_name,
                    last_name=last_name,
                )

            tenant = Tenant.objects.create(
                name=company_name,
                slug=slug,
                is_active=True,
            )

            membership = Membership.objects.create(
                tenant=tenant,
                user=user,
                role=Role.ADMIN,
                is_default=True,
            )

            created_groups = []
            created_group_ids = []
            for dept in departments:
                dept_clean = dept.strip()
                if dept_clean:
                    grp, _ = Group.objects.get_or_create(
                        tenant=tenant,
                        name=dept_clean,
                        defaults={"description": f"{dept_clean} department"},
                    )
                    # Automatically enroll initial administrator in created departmental groups
                    GroupMember.objects.get_or_create(group=grp, user=user)
                    created_groups.append(grp.name)
                    created_group_ids.append(str(grp.id))

            AuditLog.objects.create(
                tenant_id=tenant.id,
                user_id=user.id,
                user_email=user.email,
                action=AuditAction.GRANT_PERMISSION,
                query_text_sanitized=f"Registered tenant '{company_name}' with admin {admin_email}",
            )

        # Issue JWT tokens
        refresh = RefreshToken.for_user(user)
        refresh["tenant_id"] = str(tenant.id)
        refresh["tenant_name"] = tenant.name
        refresh["role"] = Role.ADMIN
        refresh["groups"] = created_group_ids

        access = refresh.access_token
        access["tenant_id"] = str(tenant.id)
        access["tenant_name"] = tenant.name
        access["role"] = Role.ADMIN
        access["groups"] = created_group_ids

        return Response(
            {
                "success": True,
                "access": str(access),
                "refresh": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                },
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "slug": tenant.slug,
                    "role": Role.ADMIN,
                },
                "groups": created_groups,
            },
            status=status.HTTP_201_CREATED,
        )


class TenantMemberListCreateView(APIView):
    """
    List tenant members and roles, or add an existing or newly provisioned user to the tenant.
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
        """Add or invite a member into this tenant (auto-provisioning if user does not exist yet)."""
        user_ctx = get_user_context(request)
        if error_resp := _require_admin(user_ctx):
            return error_resp

        email = request.data.get("email", "").strip().lower()
        role = request.data.get("role", Role.MEMBER)
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        raw_password = (request.data.get("password") or "").strip()

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

        generated_password = False
        if raw_password:
            try:
                validate_password(raw_password)
                password = raw_password
            except ValidationError as err:
                return Response(
                    {"detail": err.messages},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            password = secrets.token_urlsafe(16)
            generated_password = True

        user_created = False
        with transaction.atomic():
            target_user = User.objects.filter(email=email).first()
            if not target_user:
                # Auto-provision user account for the invited colleague
                name_parts = first_name.split(maxsplit=1) if first_name else email.split("@")[0].split(".")
                f_name = first_name or (name_parts[0].capitalize() if name_parts else "Team")
                l_name = last_name or (name_parts[1].capitalize() if len(name_parts) > 1 else "Member")
                target_user = User.objects.create_user(
                    email=email,
                    password=password,
                    first_name=f_name,
                    last_name=l_name,
                )
                user_created = True

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

        resp_data = TenantMemberSerializer(membership).data
        if generated_password and user_created:
            resp_data["temporary_password"] = password

        return Response(
            resp_data,
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

        serializer = GroupSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data.get("name", group.name).strip()
        description = serializer.validated_data.get("description", group.description)

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
            .prefetch_related("permissions__group")
            .annotate(num_chunks=Count("chunks", distinct=True))
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
                    "chunk_count": doc.num_chunks,
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


class ContactInquiryView(APIView):
    """
    Public API endpoint to record enterprise pilot inquiries.
    Persists inquiries in PostgreSQL and validates input.
    """

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = ContactInquirySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Extract client IP
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")

        inquiry = serializer.save(source_ip=ip)
        logger.info(
            f"[ContactInquiry] New inquiry from {inquiry.full_name} ({inquiry.company_name}) <{inquiry.work_email}>"
        )

        # Send email notification if mail backend is configured
        try:
            from django.conf import settings
            from django.core.mail import send_mail

            notify_emails = [a[1] for a in getattr(settings, "ADMINS", [])]
            default_from = getattr(
                settings, "DEFAULT_FROM_EMAIL", "leads@vaultrag.com"
            )
            recipients = notify_emails or [default_from]
            send_mail(
                subject=f"[VaultRAG Inquiry] New Lead: {inquiry.full_name} ({inquiry.company_name})",
                message=(
                    f"New Pilot Inquiry Received:\n\n"
                    f"Name: {inquiry.full_name}\n"
                    f"Work Email: {inquiry.work_email}\n"
                    f"Company: {inquiry.company_name}\n"
                    f"Inquiry Type: {inquiry.inquiry_type or 'General'}\n"
                    f"Team Size: {inquiry.team_size or 'N/A'}\n"
                    f"Source IP: {ip}\n\n"
                    f"Use Case Details:\n{inquiry.use_case}\n"
                ),
                from_email=default_from,
                recipient_list=recipients,
                fail_silently=True,
            )
        except Exception:
            pass

        return Response(
            {
                "success": True,
                "message": "Inquiry successfully recorded in VaultRAG ledger.",
                "id": str(inquiry.id),
            },
            status=status.HTTP_201_CREATED,
        )
