
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.utils import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from documents.models import Chunk, Document, DocumentPermission

from .models import Group, GroupMember, Membership, Role, Tenant

User = get_user_model()


class TenantModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="alice@acme.com",
            password="SecurePassword123!",
        )
        self.tenant = Tenant.objects.create(
            name="Acme Corp",
            slug="acme-corp",
        )

    def test_tenant_creation(self):
        """Test tenant fields and string representation."""
        self.assertEqual(str(self.tenant), "Acme Corp")
        self.assertTrue(self.tenant.is_active)
        self.assertIsNotNone(self.tenant.id)

    def test_membership_creation_and_roles(self):
        """Test user membership in a tenant with roles."""
        membership = Membership.objects.create(
            tenant=self.tenant,
            user=self.user,
            role=Role.ADMIN,
            is_default=True,
        )

        self.assertEqual(membership.role, Role.ADMIN)
        self.assertTrue(membership.is_default)
        self.assertIn("alice@acme.com -> Acme Corp (admin)", str(membership))

    def test_duplicate_membership_raises_error(self):
        """Test that a user cannot have duplicate memberships in the same tenant."""
        Membership.objects.create(
            tenant=self.tenant,
            user=self.user,
            role=Role.MEMBER,
        )

        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Membership.objects.create(
                    tenant=self.tenant,
                    user=self.user,
                    role=Role.VIEWER,
                )

    def test_group_creation_and_uniqueness(self):
        """Test group scoping within a tenant and unique name constraint."""
        group = Group.objects.create(
            tenant=self.tenant,
            name="Engineering",
            description="Engineering team",
        )
        self.assertEqual(str(group), "Engineering (Acme Corp)")

        # Duplicate group name within same tenant should fail
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Group.objects.create(
                    tenant=self.tenant,
                    name="Engineering",
                )

        # Same group name in a different tenant should succeed
        other_tenant = Tenant.objects.create(
            name="Beta Corp",
            slug="beta-corp",
        )
        other_group = Group.objects.create(
            tenant=other_tenant,
            name="Engineering",
        )
        self.assertEqual(other_group.name, "Engineering")

    def test_group_member_assignment(self):
        """Test assigning users to tenant groups."""
        group = Group.objects.create(
            tenant=self.tenant,
            name="Security",
        )
        member = GroupMember.objects.create(
            group=group,
            user=self.user,
        )

        self.assertEqual(member.user, self.user)
        self.assertEqual(member.group, group)
        self.assertIn("alice@acme.com in Security", str(member))


class TenantAdminAPITests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Acme Corp", slug="acme-corp")
        self.other_tenant = Tenant.objects.create(name="Cyberdyne", slug="cyberdyne")

        # Admin user
        self.admin_user = User.objects.create_user(
            email="admin@acme.com", password="Password123!"
        )
        self.admin_membership = Membership.objects.create(
            tenant=self.tenant, user=self.admin_user, role=Role.ADMIN, is_default=True
        )

        # Member user
        self.member_user = User.objects.create_user(
            email="bob@acme.com", password="Password123!"
        )
        self.member_membership = Membership.objects.create(
            tenant=self.tenant, user=self.member_user, role=Role.MEMBER, is_default=True
        )

        # Viewer user
        self.viewer_user = User.objects.create_user(
            email="carol@acme.com", password="Password123!"
        )
        self.viewer_membership = Membership.objects.create(
            tenant=self.tenant, user=self.viewer_user, role=Role.VIEWER, is_default=True
        )

        self.admin_client = APIClient()
        token = str(RefreshToken.for_user(self.admin_user).access_token)
        self.admin_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        self.member_client = APIClient()
        member_token = str(RefreshToken.for_user(self.member_user).access_token)
        self.member_client.credentials(HTTP_AUTHORIZATION=f"Bearer {member_token}")

    def test_non_admin_cannot_list_members_returns_403(self):
        """Non-admin members receive 403 Forbidden on tenant member list."""
        url = reverse("tenant_member_list_create")
        response = self.member_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_members(self):
        """Tenant admin can list all members in their tenant."""
        url = reverse("tenant_member_list_create")
        response = self.admin_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

        emails = [m["email"] for m in response.data]
        self.assertIn("admin@acme.com", emails)
        self.assertIn("bob@acme.com", emails)
        self.assertIn("carol@acme.com", emails)

    def test_admin_can_update_member_role(self):
        """Admin can promote or demote a tenant member."""
        url = reverse("tenant_member_detail", kwargs={"pk": self.member_membership.id})
        response = self.admin_client.patch(url, {"role": Role.VIEWER}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], Role.VIEWER)

        self.member_membership.refresh_from_db()
        self.assertEqual(self.member_membership.role, Role.VIEWER)

    def test_cannot_demote_or_delete_last_admin(self):
        """Cannot demote or remove the sole administrator of a tenant."""
        url = reverse("tenant_member_detail", kwargs={"pk": self.admin_membership.id})

        # Try demote
        demote_resp = self.admin_client.patch(url, {"role": Role.MEMBER}, format="json")
        self.assertEqual(demote_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("last administrator", demote_resp.data["detail"])

        # Try delete
        delete_resp = self.admin_client.delete(url)
        self.assertEqual(delete_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("last administrator", delete_resp.data["detail"])

    def test_admin_group_lifecycle(self):
        """Admin can create, list, assign members, and delete permission groups."""
        list_create_url = reverse("tenant_group_list_create")

        # 1. Create group
        create_resp = self.admin_client.post(
            list_create_url,
            {"name": "Finance", "description": "Financial planning group"},
            format="json",
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        group_id = create_resp.data["id"]

        # 2. Add user to group
        member_manage_url = reverse("tenant_group_members", kwargs={"pk": group_id})
        add_resp = self.admin_client.post(
            member_manage_url,
            {"user_id": str(self.member_user.id)},
            format="json",
        )
        self.assertEqual(add_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(add_resp.data["member_count"], 1)

        # 3. Remove user from group
        remove_resp = self.admin_client.delete(
            member_manage_url,
            {"user_id": str(self.member_user.id)},
            format="json",
        )
        self.assertEqual(remove_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(remove_resp.data["member_count"], 0)

        # 4. Delete group
        detail_url = reverse("tenant_group_detail", kwargs={"pk": group_id})
        del_resp = self.admin_client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Group.objects.filter(id=group_id).exists())

    def test_access_explorer_simulation(self):
        """Access Explorer calculates exact document access and policy reasoning."""
        # Create group and assign bob
        group = Group.objects.create(tenant=self.tenant, name="Legal")
        GroupMember.objects.create(group=group, user=self.member_user)

        # Document 1: Public Tenant
        dummy_embedding = [0.0] * 2048
        doc_public = Document.objects.create(
            tenant=self.tenant,
            owner=self.admin_user,
            title="Employee Handbook",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )
        Chunk.objects.create(
            tenant=self.tenant,
            document=doc_public,
            position=0,
            text="Handbook chunk",
            embedding=dummy_embedding,
        )

        # Document 2: Shared with Legal
        doc_group = Document.objects.create(
            tenant=self.tenant,
            owner=self.admin_user,
            title="Vendor Contracts",
            visibility=Document.Visibility.GROUP,
            status=Document.Status.READY,
        )
        DocumentPermission.objects.create(document=doc_group, group=group)
        Chunk.objects.create(
            tenant=self.tenant,
            document=doc_group,
            position=0,
            text="Contract chunk",
            embedding=dummy_embedding,
        )

        # Document 3: Private to Admin
        doc_private = Document.objects.create(
            tenant=self.tenant,
            owner=self.admin_user,
            title="Executive Compensation",
            visibility=Document.Visibility.PRIVATE,
            status=Document.Status.READY,
        )
        Chunk.objects.create(
            tenant=self.tenant,
            document=doc_private,
            position=0,
            text="Private chunk",
            embedding=dummy_embedding,
        )

        explorer_url = reverse("tenant_access_explorer")

        # Query for Bob (in Legal)
        resp_bob = self.admin_client.post(
            explorer_url,
            {"user_id": str(self.member_user.id)},
            format="json",
        )
        self.assertEqual(resp_bob.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_bob.data["total_documents"], 3)
        self.assertEqual(resp_bob.data["accessible_documents"], 2)
        self.assertEqual(resp_bob.data["denied_documents"], 1)

        doc_results = {d["title"]: d for d in resp_bob.data["documents"]}
        self.assertEqual(doc_results["Employee Handbook"]["access_status"], "ALLOWED")
        self.assertIn("TENANT_PUBLIC", doc_results["Employee Handbook"]["matched_rules"])

        self.assertEqual(doc_results["Vendor Contracts"]["access_status"], "ALLOWED")
        self.assertIn("GROUP_MEMBER (Legal)", doc_results["Vendor Contracts"]["matched_rules"])

        self.assertEqual(doc_results["Executive Compensation"]["access_status"], "DENIED")

        # Query for Carol (Viewer, not in Legal)
        resp_carol = self.admin_client.post(
            explorer_url,
            {"user_id": str(self.viewer_user.id)},
            format="json",
        )
        self.assertEqual(resp_carol.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_carol.data["accessible_documents"], 1)
        self.assertEqual(resp_carol.data["denied_documents"], 2)

        carol_results = {d["title"]: d for d in resp_carol.data["documents"]}
        self.assertEqual(carol_results["Employee Handbook"]["access_status"], "ALLOWED")
        self.assertEqual(carol_results["Vendor Contracts"]["access_status"], "DENIED")
        self.assertEqual(carol_results["Executive Compensation"]["access_status"], "DENIED")
