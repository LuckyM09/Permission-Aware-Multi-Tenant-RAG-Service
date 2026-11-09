from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from tenants.models import Membership, RegistrationRequest, Role, Tenant

REGISTER_URL = "/api/v1/tenants/register/"
LOGIN_URL = "/api/auth/token/"

PAYLOAD = {
    "company_name": "Acme Legal",
    "admin_name": "Asha Rao",
    "admin_email": "asha@acme.test",
    "admin_password": "Str0ng-Passw0rd!",
    "departments": ["Litigation", "Finance"],
}


@override_settings(
    ALLOW_PUBLIC_TENANT_REGISTRATION=True,
    TENANT_REGISTRATION_REQUIRES_APPROVAL=True,
    TENANT_REGISTRATION_INVITE_CODE="",
    TENANT_REGISTRATION_MAX_PENDING=50,
    ADMINS=[("Owner", "owner@example.test")],
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class RegistrationApprovalTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _register(self, **overrides):
        return self.client.post(REGISTER_URL, {**PAYLOAD, **overrides}, format="json")

    def _login(self, email="asha@acme.test", password=PAYLOAD["admin_password"]):
        return self.client.post(
            LOGIN_URL, {"email": email, "password": password}, format="json"
        )

    def test_request_is_queued_and_creates_no_account_or_token(self):
        res = self._register()
        self.assertEqual(res.status_code, 202)
        self.assertTrue(res.data["pending"])
        self.assertNotIn("access", res.data)
        self.assertNotIn("refresh", res.data)
        self.assertEqual(RegistrationRequest.objects.count(), 1)
        self.assertFalse(User.objects.filter(email="asha@acme.test").exists())
        self.assertFalse(Tenant.objects.filter(name="Acme Legal").exists())
        self.assertEqual(self._login().status_code, 401)

    def test_password_is_stored_hashed(self):
        self._register()
        reg = RegistrationRequest.objects.get()
        self.assertNotEqual(reg.password_hash, PAYLOAD["admin_password"])
        self.assertTrue(reg.password_hash.startswith(("pbkdf2_", "argon2", "bcrypt", "scrypt")))

    def test_owner_is_emailed_about_new_request(self):
        self._register()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["owner@example.test"])

    def test_approve_creates_workspace_and_user_can_sign_in(self):
        self._register()
        reg = RegistrationRequest.objects.get()
        tenant = reg.approve()

        self.assertEqual(reg.status, RegistrationRequest.Status.APPROVED)
        self.assertEqual(tenant.name, "Acme Legal")
        membership = Membership.objects.get(tenant=tenant, user__email="asha@acme.test")
        self.assertEqual(membership.role, Role.ADMIN)
        self.assertEqual(
            set(tenant.groups.values_list("name", flat=True)), {"Litigation", "Finance"}
        )

        res = self._login()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["tenant"]["id"], str(tenant.id))

    def test_rejected_request_never_gets_access(self):
        self._register()
        reg = RegistrationRequest.objects.get()
        reg.reject(note="Not a fit")
        self.assertEqual(reg.status, RegistrationRequest.Status.REJECTED)
        self.assertEqual(self._login().status_code, 401)
        with self.assertRaises(ValueError):
            reg.approve()

    def test_cannot_approve_twice(self):
        self._register()
        reg = RegistrationRequest.objects.get()
        reg.approve()
        with self.assertRaises(ValueError):
            reg.approve()
        self.assertEqual(Tenant.objects.filter(name="Acme Legal").count(), 1)

    def test_duplicate_pending_email_returns_same_response_without_second_row(self):
        first = self._register()
        second = self._register(company_name="Other Co")
        self.assertEqual(first.status_code, second.status_code)
        self.assertEqual(first.data, second.data)
        self.assertEqual(RegistrationRequest.objects.count(), 1)

    def test_existing_user_email_gets_same_response_and_no_request(self):
        User.objects.create_user(email="asha@acme.test", password="x-Existing-1")
        res = self._register()
        self.assertEqual(res.status_code, 202)
        self.assertEqual(RegistrationRequest.objects.count(), 0)

    @override_settings(TENANT_REGISTRATION_MAX_PENDING=1)
    def test_pending_cap_closes_intake(self):
        self.assertEqual(self._register().status_code, 202)
        res = self._register(admin_email="second@acme.test")
        self.assertEqual(res.status_code, 503)
        self.assertEqual(RegistrationRequest.objects.count(), 1)

    @override_settings(TENANT_REGISTRATION_INVITE_CODE="pilot-code-123")
    def test_valid_invite_code_skips_the_queue(self):
        res = self._register(invite_code="pilot-code-123")
        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        self.assertEqual(RegistrationRequest.objects.count(), 0)

    @override_settings(TENANT_REGISTRATION_INVITE_CODE="pilot-code-123")
    def test_wrong_invite_code_is_just_queued(self):
        res = self._register(invite_code="guess")
        self.assertEqual(res.status_code, 202)
        self.assertFalse(User.objects.filter(email="asha@acme.test").exists())

    @override_settings(ALLOW_PUBLIC_TENANT_REGISTRATION=False)
    def test_invite_only_mode_still_rejects_strangers(self):
        res = self._register()
        self.assertEqual(res.status_code, 403)
        self.assertEqual(RegistrationRequest.objects.count(), 0)
