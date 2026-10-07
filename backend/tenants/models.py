import uuid

from django.conf import settings
from django.db import models


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
    name = models.CharField(max_length=255, help_text="Human-readable organization name")
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
