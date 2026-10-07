from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError
from django.test import TestCase

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
