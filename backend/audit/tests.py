import uuid

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tokens import create_token_for_user
from tenants.models import Membership, Role, Tenant

from .models import AuditAction, AuditLog


class AuditLogModelTests(TestCase):
    def setUp(self):
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()

    def test_create_audit_log_success(self):
        log = AuditLog.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            user_email="alice@acme.com",
            action=AuditAction.QUERY,
            query_text_sanitized="What is VaultRAG?",
            retrieved_chunk_ids=["chunk-1", "chunk-2"],
            latency_ms=142.5,
        )
        self.assertIsNotNone(log.id)
        self.assertEqual(log.action, "query")
        self.assertEqual(len(log.retrieved_chunk_ids), 2)

    def test_update_audit_log_raises_permission_error(self):
        log = AuditLog.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            user_email="alice@acme.com",
            action=AuditAction.QUERY,
            query_text_sanitized="Original Query",
        )
        log.query_text_sanitized = "Tampered Query"
        with self.assertRaises(PermissionError):
            log.save()

    def test_delete_audit_log_raises_permission_error(self):
        log = AuditLog.objects.create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            user_email="alice@acme.com",
            action=AuditAction.QUERY,
        )
        with self.assertRaises(PermissionError):
            log.delete()


class AuditServiceAndAPITests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Tenant A", slug="tenant-a")
        self.tenant_b = Tenant.objects.create(name="Tenant B", slug="tenant-b")

        self.user_a = User.objects.create_user(email="alice@tenanta.com", password="password123")
        self.user_b = User.objects.create_user(email="mallory@tenantb.com", password="password123")

        Membership.objects.create(user=self.user_a, tenant=self.tenant_a, role=Role.ADMIN)
        Membership.objects.create(user=self.user_b, tenant=self.tenant_b, role=Role.MEMBER)

        # Create logs for Tenant A and Tenant B
        AuditLog.objects.create(
            tenant_id=self.tenant_a.id,
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            action=AuditAction.QUERY,
            query_text_sanitized="Tenant A sensitive query",
        )
        AuditLog.objects.create(
            tenant_id=self.tenant_b.id,
            user_id=self.user_b.id,
            user_email=self.user_b.email,
            action=AuditAction.QUERY,
            query_text_sanitized="Tenant B query",
        )

        self.client = APIClient()

    def test_tenant_isolation_in_audit_api(self):
        token_a = create_token_for_user(self.user_a, self.tenant_a.id, role="admin")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")

        res = self.client.get("/api/v1/audit/logs/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["tenant_id"], str(self.tenant_a.id))
        self.assertNotIn("Tenant B", results[0]["query_text_sanitized"])

    def test_filter_audit_logs_by_action_and_search(self):
        token_a = create_token_for_user(self.user_a, self.tenant_a.id, role="admin")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")

        AuditLog.objects.create(
            tenant_id=self.tenant_a.id,
            user_id=self.user_a.id,
            user_email=self.user_a.email,
            action=AuditAction.INGEST,
            query_text_sanitized="Uploaded quarterly_revenue.pdf",
        )

        res_action = self.client.get("/api/v1/audit/logs/?action=ingest")
        self.assertEqual(res_action.status_code, 200)
        self.assertEqual(len(res_action.data["results"]), 1)
        self.assertEqual(res_action.data["results"][0]["action"], "ingest")

        res_search = self.client.get("/api/v1/audit/logs/?search=revenue")
        self.assertEqual(res_search.status_code, 200)
        self.assertEqual(len(res_search.data["results"]), 1)
        self.assertIn("revenue", res_search.data["results"][0]["query_text_sanitized"])
