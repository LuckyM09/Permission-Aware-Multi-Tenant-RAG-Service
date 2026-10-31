"""
Production settings for VaultRAG.
Hardened security headers, rate limiting, and structured logging.
"""

from decouple import config

from .base import *

DEBUG = False

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
