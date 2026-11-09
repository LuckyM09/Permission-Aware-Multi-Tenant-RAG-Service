from django.contrib import admin, messages

from .models import (
    ContactInquiry,
    Group,
    GroupMember,
    Membership,
    RegistrationRequest,
    Tenant,
)
from .notifications import notify_applicant_decision


@admin.register(ContactInquiry)
class ContactInquiryAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "company_name",
        "work_email",
        "inquiry_type",
        "team_size",
        "created_at",
    )
    search_fields = ("full_name", "company_name", "work_email", "use_case")
    list_filter = ("inquiry_type", "team_size", "created_at")
    readonly_fields = ("created_at", "source_ip")


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    search_fields = ("name", "slug")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "tenant", "role", "is_default", "created_at")
    list_filter = ("role", "is_default", "tenant")
    search_fields = ("user__email", "tenant__name")


class GroupMemberInline(admin.TabularInline):
    model = GroupMember
    extra = 1


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "created_at")
    list_filter = ("tenant",)
    search_fields = ("name", "tenant__name")
    inlines = [GroupMemberInline]


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "group", "created_at")
    list_filter = ("group__tenant", "group")
    search_fields = ("user__email", "group__name")


@admin.register(RegistrationRequest)
class RegistrationRequestAdmin(admin.ModelAdmin):
    """Owner review queue: approve or reject self-service registrations."""

    list_display = ("company_name", "admin_email", "status", "created_at", "source_ip")
    list_filter = ("status", "created_at")
    search_fields = ("company_name", "admin_email")
    exclude = ("password_hash",)
    readonly_fields = (
        "company_name",
        "company_slug",
        "admin_name",
        "admin_email",
        "departments",
        "status",
        "tenant",
        "source_ip",
        "created_at",
        "decided_at",
    )
    actions = ["approve_selected", "reject_selected"]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Approve selected requests (creates workspace and admin account)")
    def approve_selected(self, request, queryset):
        approved = 0
        for reg in queryset.filter(status=RegistrationRequest.Status.PENDING):
            try:
                reg.approve(note=reg.decision_note)
            except Exception as exc:
                self.message_user(
                    request, f"{reg.admin_email}: {exc}", level=messages.ERROR
                )
                continue
            notify_applicant_decision(reg)
            approved += 1
        self.message_user(request, f"Approved {approved} request(s).", messages.SUCCESS)

    @admin.action(description="Reject selected requests")
    def reject_selected(self, request, queryset):
        rejected = 0
        for reg in queryset.filter(status=RegistrationRequest.Status.PENDING):
            reg.reject(note=reg.decision_note)
            notify_applicant_decision(reg)
            rejected += 1
        self.message_user(request, f"Rejected {rejected} request(s).", messages.SUCCESS)
