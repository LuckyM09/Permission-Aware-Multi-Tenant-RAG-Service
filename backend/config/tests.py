from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


class HealthProbeTests(TestCase):
    """
    Validates Kubernetes / container liveness and readiness endpoints.
    """

    def setUp(self):
        self.client = APIClient()

    def test_liveness_probe_returns_200(self):
        """Liveness probe /healthz returns 200 OK without authentication."""
        url = reverse("liveness_probe")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "alive")
        self.assertEqual(data["service"], "vaultrag-backend")
        self.assertIn("timestamp", data)

    def test_readiness_probe_returns_200(self):
        """Readiness probe /readyz verifies downstream dependencies."""
        url = reverse("readiness_probe")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "ready")
        self.assertIn("database", data["checks"])
        self.assertEqual(data["checks"]["database"], "healthy")


class ProductionSecuritySettingsTests(SimpleTestCase):
    """
    Validates that production settings enforce hardened security headers.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import importlib
        import os
        from unittest.mock import patch

        with patch.dict(os.environ, {"DJANGO_SECRET_KEY": "a" * 50}):
            cls.prod_settings = importlib.import_module("config.settings.prod")

    def test_production_security_headers_configured(self):
        """Ensures HSTS, X-Frame-Options, nosniff, and cookie security flags are active."""
        ps = self.prod_settings
        self.assertFalse(ps.DEBUG)
        self.assertEqual(ps.X_FRAME_OPTIONS, "DENY")
        self.assertTrue(ps.SECURE_CONTENT_TYPE_NOSNIFF)
        self.assertTrue(ps.SECURE_BROWSER_XSS_FILTER)
        self.assertEqual(ps.SECURE_HSTS_SECONDS, 31536000)
        self.assertTrue(ps.SECURE_HSTS_INCLUDE_SUBDOMAINS)
        self.assertTrue(ps.SECURE_HSTS_PRELOAD)
        self.assertTrue(ps.SESSION_COOKIE_HTTPONLY)
        self.assertEqual(ps.SESSION_COOKIE_SAMESITE, "Lax")
        self.assertTrue(ps.CSRF_COOKIE_HTTPONLY)
        self.assertEqual(ps.CSRF_COOKIE_SAMESITE, "Lax")

    def test_production_throttling_rates_configured(self):
        """Ensures production DRF throttle rates are properly defined."""
        rates = self.prod_settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        self.assertIn("search", rates)
        self.assertIn("chat", rates)
        self.assertIn("anon", rates)
        self.assertIn("user", rates)
