from django.urls import path

from tenants.views import (
    AccessExplorerView,
    TenantGroupDetailView,
    TenantGroupListCreateView,
    TenantGroupMemberManageView,
    TenantMemberDetailView,
    TenantMemberListCreateView,
)

urlpatterns = [
    # Tenant Members
    path("members/", TenantMemberListCreateView.as_view(), name="tenant_member_list_create"),
    path("members/<uuid:pk>/", TenantMemberDetailView.as_view(), name="tenant_member_detail"),
    # Access Groups
    path("groups/", TenantGroupListCreateView.as_view(), name="tenant_group_list_create"),
    path("groups/<uuid:pk>/", TenantGroupDetailView.as_view(), name="tenant_group_detail"),
    path("groups/<uuid:pk>/members/", TenantGroupMemberManageView.as_view(), name="tenant_group_members"),
    # Access Explorer Simulation
    path("access-explorer/", AccessExplorerView.as_view(), name="tenant_access_explorer"),
]
