from django.contrib import admin

from .models import ContactInquiry, Group, GroupMember, Membership, Tenant


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
