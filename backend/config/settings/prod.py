"""
Production settings for VaultRAG.
Hardened security headers, rate limiting, and structured logging.
"""

import sys

from decouple import config

from .base import *

DEBUG = False

# Hard production invariant: Mock AI fallbacks are strictly disabled
ALLOW_MOCK_AI_FALLBACK = False

# In production, public registration is closed unless explicitly enabled with an invite code
ALLOW_PUBLIC_TENANT_REGISTRATION = config(
    "ALLOW_PUBLIC_TENANT_REGISTRATION", default=False, cast=bool
)

# Hard production invariant: Insecure secret keys halt startup immediately (exempt in test runners)
if not any(arg in sys.argv for arg in ["test", "pytest"]):
    if SECRET_KEY.startswith("django-insecure") or "change-me" in SECRET_KEY or len(SECRET_KEY) < 32:
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured(
            "CRITICAL SECURITY FAILURE: DJANGO_SECRET_KEY is using an insecure or default value in production. "
            "Set a cryptographically strong, random DJANGO_SECRET_KEY before deploying."
        )

# Security Headers & SSL
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Cookies & Session Security
SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=True, cast=bool)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = config("CSRF_COOKIE_SECURE", default=True, cast=bool)
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

# SSL Termination / Proxy Header
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)

# Production Throttling Rates
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
    "anon": "20/minute",
    "user": "120/minute",
    "search": "40/minute",
    "chat": "20/minute",
}

# Structured Production Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {process:d} {thread:d}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "retrieval": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "audit": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
