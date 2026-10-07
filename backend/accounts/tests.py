from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.context import UserContext
from tenants.models import Group, GroupMember, Membership, Role, Tenant

User = get_user_model()


class UserModelTests(TestCase):
    def test_create_user_with_email_successful(self):
        """Test creating a new user with an email is successful."""
        email = "alice@tenant-a.com"
        password = "SecurePassword123!"
        user = User.objects.create_user(email=email, password=password)

        self.assertEqual(user.email, email)
        self.assertTrue(user.check_password(password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_new_user_without_email_raises_error(self):
        """Test creating a user with no email raises a ValueError."""
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="SecurePassword123!")

    def test_create_superuser(self):
        """Test creating a new superuser."""
        user = User.objects.create_superuser(
            email="admin@vaultrag.internal",
            password="AdminPassword123!",
        )

        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)


class AuthTokenAndTenancyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = "StrongPassword123!"
        self.user = User.objects.create_user(
            email="alice@acme.com",
            password=self.password,
            first_name="Alice",
            last_name="Smith",
        )

        self.tenant_a = Tenant.objects.create(name="Acme Corp", slug="acme-corp")
        self.tenant_b = Tenant.objects.create(name="Beta Labs", slug="beta-labs")

        self.membership_a = Membership.objects.create(
            tenant=self.tenant_a,
            user=self.user,
            role=Role.ADMIN,
            is_default=True,
        )
        self.membership_b = Membership.objects.create(
            tenant=self.tenant_b,
            user=self.user,
            role=Role.MEMBER,
            is_default=False,
        )

        self.group_hr = Group.objects.create(tenant=self.tenant_a, name="HR")
        self.group_eng = Group.objects.create(tenant=self.tenant_a, name="Engineering")

        GroupMember.objects.create(group=self.group_hr, user=self.user)
        GroupMember.objects.create(group=self.group_eng, user=self.user)

    def test_login_encodes_tenant_claims_in_jwt(self):
        """Test JWT token contains verified tenant, role, and group claims."""
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url,
            {"email": "alice@acme.com", "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        # Decode token and verify claims
        access_token = AccessToken(response.data["access"])
        self.assertEqual(access_token["user_id"], str(self.user.id))
        self.assertEqual(access_token["tenant_id"], str(self.tenant_a.id))
        self.assertEqual(access_token["role"], Role.ADMIN)
        self.assertIn(str(self.group_hr.id), access_token["groups"])
        self.assertIn(str(self.group_eng.id), access_token["groups"])

        # Check returned context summary
        self.assertEqual(response.data["tenant"]["slug"], "acme-corp")
        self.assertEqual(response.data["tenant"]["role"], Role.ADMIN)
        self.assertIn("HR", response.data["groups"])
        self.assertIn("Engineering", response.data["groups"])

    def test_login_allows_explicit_tenant_switch(self):
        """Test user can select a non-default tenant during authentication."""
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url,
            {
                "email": "alice@acme.com",
                "password": self.password,
                "tenant_slug": "beta-labs",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access_token = AccessToken(response.data["access"])
        self.assertEqual(access_token["tenant_id"], str(self.tenant_b.id))
        self.assertEqual(access_token["role"], Role.MEMBER)
        self.assertEqual(len(access_token["groups"]), 0)

    def test_login_fails_for_user_without_tenant(self):
        """Test login is rejected if user is not a member of any active tenant."""
        orphan_user = User.objects.create_user(
            email="orphan@nowhere.com",
            password=self.password,
        )

        url = reverse("token_obtain_pair")
        response = self.client.post(
            url,
            {"email": orphan_user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("User is not a member of any active organization", response.data["detail"])

    def test_current_user_me_endpoint(self):
        """Test GET /api/auth/me/ returns authenticated user context and available tenants."""
        login_url = reverse("token_obtain_pair")
        login_resp = self.client.post(
            login_url,
            {"email": "alice@acme.com", "password": self.password},
            format="json",
        )
        token = login_resp.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me_url = reverse("auth_me")
        response = self.client.get(me_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["email"], "alice@acme.com")
        self.assertEqual(response.data["context"]["tenant_id"], str(self.tenant_a.id))
        self.assertTrue(response.data["context"]["is_admin"])
        self.assertEqual(len(response.data["tenants"]), 2)


class UserContextDataclassTests(TestCase):
    def test_user_context_methods(self):
        """Test UserContext helper methods."""
        user = User.objects.create_user(email="test@test.com", password="password")
        tenant = Tenant.objects.create(name="T", slug="t")

        admin_ctx = UserContext(
            tenant_id=tenant.id,
            user_id=user.id,
            email=user.email,
            role="admin",
            group_ids=(),
        )
        self.assertTrue(admin_ctx.is_admin())
        self.assertTrue(admin_ctx.is_member_or_admin())

        viewer_ctx = UserContext(
            tenant_id=tenant.id,
            user_id=user.id,
            email=user.email,
            role="viewer",
            group_ids=(),
        )
        self.assertFalse(viewer_ctx.is_admin())
        self.assertFalse(viewer_ctx.is_member_or_admin())
