import uuid

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from django.utils.text import slugify


class Tenant(models.Model):
    """
    Represents an isolated customer or organization tenant.
    All documents, permissions, and chunks belong to a Tenant.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the tenant",
    )
    name = models.CharField(
        max_length=255, help_text="Human-readable organization name"
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        help_text="URL-friendly identifier for the tenant",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Designates whether the tenant is currently active",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tenant"
        verbose_name_plural = "Tenants"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Role(models.TextChoices):
    ADMIN = "admin", "Tenant Admin"
    MEMBER = "member", "Member"
    VIEWER = "viewer", "Viewer"


class Membership(models.Model):
    """
    Connects a User to a Tenant with a specific authorization role.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tenant_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER,
        help_text="Tenant-scoped authorization role",
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Designates this tenant as the user's primary/active tenant",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tenant Membership"
        verbose_name_plural = "Tenant Memberships"
        unique_together = ("tenant", "user")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} -> {self.tenant.name} ({self.role})"


class Group(models.Model):
    """
    Represents an access control group within a tenant (e.g. 'Human Resources', 'Engineering').
    Group names are unique within a given tenant.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="groups",
    )
    name = models.CharField(
        max_length=150,
        help_text="Group name (e.g. 'Engineering', 'HR')",
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Group"
        verbose_name_plural = "Groups"
        unique_together = ("tenant", "name")
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.tenant.name})"


class GroupMember(models.Model):
    """
    Maps a User into an access group within a tenant.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Group Member"
        verbose_name_plural = "Group Members"
        unique_together = ("group", "user")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.email} in {self.group.name}"


class ContactInquiry(models.Model):
    """
    Stores inbound enterprise contact and pilot inquiries submitted via the public landing page.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    full_name = models.CharField(max_length=255)
    work_email = models.EmailField()
    company_name = models.CharField(max_length=255)
    inquiry_type = models.CharField(max_length=255, blank=True)
    team_size = models.CharField(max_length=100, blank=True)
    use_case = models.TextField(blank=True)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Contact Inquiry"
        verbose_name_plural = "Contact Inquiries"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.company_name}) - {self.work_email}"


class RegistrationRequest(models.Model):
    """
    A self-service registration request that waits for the platform owner's decision.

    No Tenant or User exists until the request is approved, so strangers never get an
    account, a token or an API identity, and cannot squat on an email address.
    The password is stored only as a Django password hash.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    company_slug = models.SlugField(max_length=255, blank=True)
    admin_name = models.CharField(max_length=150, blank=True)
    admin_email = models.EmailField()
    password_hash = models.CharField(max_length=255, editable=False)
    departments = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    decision_note = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    tenant = models.ForeignKey(
        Tenant,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="registration_requests",
    )
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registration Request"
        verbose_name_plural = "Registration Requests"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.company_name} <{self.admin_email}> [{self.status}]"

    @transaction.atomic
    def approve(self, note: str = "") -> "Tenant":
        """Create the Tenant, admin User, Membership and default Groups."""
        from accounts.models import User
        from audit.models import AuditAction, AuditLog

        if self.status != self.Status.PENDING:
            raise ValueError("Only pending requests can be approved.")

        email = self.admin_email.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValueError(f"A user with email {email} already exists.")

        if self.admin_name.strip():
            parts = self.admin_name.split(maxsplit=1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""
        else:
            first_name = email.split("@")[0].capitalize()
            last_name = "Admin"

        user = User.objects.create_user(
            email=email, first_name=first_name, last_name=last_name
        )
        user.password = self.password_hash  # already hashed at request time
        user.save(update_fields=["password"])

        base_slug = slugify(self.company_slug or self.company_name) or (
            f"tenant-{uuid.uuid4().hex[:6]}"
        )
        slug, counter = base_slug, 1
        while Tenant.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        tenant = Tenant.objects.create(name=self.company_name, slug=slug, is_active=True)
        Membership.objects.create(
            tenant=tenant, user=user, role=Role.ADMIN, is_default=True
        )

        for dept in self.departments or ["Engineering", "Finance", "Human Resources"]:
            dept_clean = str(dept).strip()
            if dept_clean:
                group, _ = Group.objects.get_or_create(
                    tenant=tenant,
                    name=dept_clean,
                    defaults={"description": f"{dept_clean} department"},
                )
                GroupMember.objects.get_or_create(group=group, user=user)

        AuditLog.objects.create(
            tenant_id=tenant.id,
            user_id=user.id,
            user_email=user.email,
            action=AuditAction.GRANT_PERMISSION,
            query_text_sanitized=(
                f"Registration request approved: tenant '{tenant.name}' "
                f"with admin {user.email}"
            ),
        )

        self.status = self.Status.APPROVED
        self.tenant = tenant
        self.decision_note = note
        self.decided_at = timezone.now()
        self.save(update_fields=["status", "tenant", "decision_note", "decided_at"])
        return tenant

    def reject(self, note: str = "") -> None:
        if self.status != self.Status.PENDING:
            raise ValueError("Only pending requests can be rejected.")
        self.status = self.Status.REJECTED
        self.decision_note = note
        self.decided_at = timezone.now()
        self.save(update_fields=["status", "decision_note", "decided_at"])
