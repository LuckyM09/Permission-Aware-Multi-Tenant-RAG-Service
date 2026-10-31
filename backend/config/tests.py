from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from config.settings import prod as prod_settings


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

    def test_production_security_headers_configured(self):
        """Ensures HSTS, X-Frame-Options, nosniff, and cookie security flags are active."""
        self.assertFalse(prod_settings.DEBUG)
        self.assertEqual(prod_settings.X_FRAME_OPTIONS, "DENY")
        self.assertTrue(prod_settings.SECURE_CONTENT_TYPE_NOSNIFF)
        self.assertTrue(prod_settings.SECURE_BROWSER_XSS_FILTER)
        self.assertEqual(prod_settings.SECURE_HSTS_SECONDS, 31536000)
        self.assertTrue(prod_settings.SECURE_HSTS_INCLUDE_SUBDOMAINS)
        self.assertTrue(prod_settings.SECURE_HSTS_PRELOAD)
        self.assertTrue(prod_settings.SESSION_COOKIE_HTTPONLY)
        self.assertEqual(prod_settings.SESSION_COOKIE_SAMESITE, "Lax")
        self.assertTrue(prod_settings.CSRF_COOKIE_HTTPONLY)
        self.assertEqual(prod_settings.CSRF_COOKIE_SAMESITE, "Lax")

    def test_production_throttling_rates_configured(self):
        """Ensures production DRF throttle rates are properly defined."""
        rates = prod_settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        self.assertIn("search", rates)
        self.assertIn("chat", rates)
        self.assertIn("anon", rates)
        self.assertIn("user", rates)
