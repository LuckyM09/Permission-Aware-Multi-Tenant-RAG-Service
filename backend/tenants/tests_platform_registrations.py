from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from tenants.models import Membership, RegistrationRequest, Role, Tenant

BASE = "/api/v1/tenants/platform/registrations/"


def make_request(email="asha@acme.test", company="Acme Legal", **kw):
    from django.contrib.auth.hashers import make_password

    return RegistrationRequest.objects.create(
        company_name=company,
        admin_name="Asha Rao",
        admin_email=email,
        password_hash=make_password("Str0ng-Passw0rd!"),
        departments=["Litigation"],
        **kw,
    )


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PlatformRegistrationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="owner@example.test", password="Own3r-Passw0rd!", is_superuser=True, is_staff=True
        )
        self.normal = User.objects.create_user(email="user@example.test", password="User-Passw0rd!1")

    def test_requires_authentication(self):
        self.assertEqual(self.client.get(BASE).status_code, 401)

    def test_regular_user_is_forbidden_everywhere(self):
        reg = make_request()
        self.client.force_authenticate(self.normal)
        self.assertEqual(self.client.get(BASE).status_code, 403)
        self.assertEqual(self.client.post(f"{BASE}{reg.id}/approve/").status_code, 403)
        reg.refresh_from_db()
        self.assertEqual(reg.status, RegistrationRequest.Status.PENDING)
        self.assertFalse(User.objects.filter(email="asha@acme.test").exists())

    def test_inactive_superuser_is_forbidden(self):
        self.owner.is_active = False
        self.owner.save()
        self.client.force_authenticate(self.owner)
        self.assertIn(self.client.get(BASE).status_code, (401, 403))

    def test_list_defaults_to_pending_and_returns_counts(self):
        make_request()
        done = make_request(email="b@x.test", company="B Co")
        done.reject()
        self.client.force_authenticate(self.owner)

        res = self.client.get(BASE)
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r["admin_email"] for r in res.data["results"]], ["asha@acme.test"])
        self.assertEqual(res.data["counts"], {"pending": 1, "approved": 0, "rejected": 1})
        self.assertNotIn("password_hash", res.data["results"][0])

        res = self.client.get(BASE + "?status=all")
        self.assertEqual(len(res.data["results"]), 2)
        self.assertEqual(self.client.get(BASE + "?status=bogus").status_code, 400)

    def test_approve_creates_workspace_and_emails_applicant(self):
        reg = make_request()
        self.client.force_authenticate(self.owner)
        res = self.client.post(f"{BASE}{reg.id}/approve/", {"note": "Welcome"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "approved")
        self.assertTrue(Tenant.objects.filter(name="Acme Legal").exists())
        self.assertTrue(
            Membership.objects.filter(user__email="asha@acme.test", role=Role.ADMIN).exists()
        )
        self.assertEqual(mail.outbox[-1].to, ["asha@acme.test"])

    def test_reject_records_note_and_creates_nothing(self):
        reg = make_request()
        self.client.force_authenticate(self.owner)
        res = self.client.post(f"{BASE}{reg.id}/reject/", {"note": "Not a fit"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "rejected")
        self.assertEqual(res.data["decision_note"], "Not a fit")
        self.assertFalse(User.objects.filter(email="asha@acme.test").exists())

    def test_deciding_twice_conflicts(self):
        reg = make_request()
        self.client.force_authenticate(self.owner)
        self.client.post(f"{BASE}{reg.id}/approve/")
        again = self.client.post(f"{BASE}{reg.id}/reject/")
        self.assertEqual(again.status_code, 409)
        self.assertEqual(Tenant.objects.filter(name="Acme Legal").count(), 1)

    def test_unknown_id_and_unknown_action(self):
        self.client.force_authenticate(self.owner)
        missing = "00000000-0000-0000-0000-000000000000"
        self.assertEqual(self.client.post(f"{BASE}{missing}/approve/").status_code, 404)
        reg = make_request()
        self.assertEqual(self.client.post(f"{BASE}{reg.id}/delete/").status_code, 404)

    def test_approve_fails_cleanly_when_email_already_has_account(self):
        reg = make_request(email="user@example.test")
        self.client.force_authenticate(self.owner)
        res = self.client.post(f"{BASE}{reg.id}/approve/")
        self.assertEqual(res.status_code, 409)
        reg.refresh_from_db()
        self.assertEqual(reg.status, RegistrationRequest.Status.PENDING)


class CreatePlatformOwnerCommandTests(TestCase):
    def test_creates_owner_with_workspace(self):
        call_command("create_platform_owner", email="Boss@Example.test", password="Own3r-Passw0rd!")
        user = User.objects.get(email="boss@example.test")
        self.assertTrue(user.is_superuser and user.is_staff)
        self.assertTrue(Membership.objects.filter(user=user, role=Role.ADMIN).exists())

    def test_promotes_existing_user_without_second_workspace(self):
        user = User.objects.create_user(email="me@example.test", password="Some-Passw0rd!1")
        tenant = Tenant.objects.create(name="Mine", slug="mine")
        Membership.objects.create(tenant=tenant, user=user, role=Role.ADMIN, is_default=True)
        call_command("create_platform_owner", email="me@example.test")
        user.refresh_from_db()
        self.assertTrue(user.is_superuser)
        self.assertEqual(Tenant.objects.count(), 1)
