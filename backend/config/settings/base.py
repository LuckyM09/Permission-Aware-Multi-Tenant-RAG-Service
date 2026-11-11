"""
Django Base Settings for VaultRAG Project.
These settings are shared across all environments (dev, test, prod).
"""

from datetime import timedelta
from pathlib import Path

from decouple import config
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Quick-start development settings - unsuitable for production
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
SECRET_KEY = config("DJANGO_SECRET_KEY", default="")

if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-vaultrag-dev-key-change-me"
    else:
        raise ImproperlyConfigured(
            "CRITICAL SECURITY FAILURE: DJANGO_SECRET_KEY environment variable is required when DEBUG is False."
        )

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1,backend",
    cast=lambda v: [s.strip() for s in v.split(",") if s.strip()],
)

# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "pgvector.django",
]

LOCAL_APPS = [
    "accounts",
    "tenants",
    "documents",
    "ingestion",
    "retrieval",
    "chat",
    "audit",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "accounts.middleware.TenantContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database Configuration (PostgreSQL 16 + pgvector)
# ATOMIC_REQUESTS guarantees that every HTTP request runs inside a transaction,
# ensuring PostgreSQL transaction-local RLS variables ('app.tenant_id') remain active.
# Connects as non-superuser vaultrag_user by default so FORCE ROW LEVEL SECURITY is enforced.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="vaultrag_db"),
        "USER": config(
            "POSTGRES_DB_USER",
            default=config("POSTGRES_APP_USER", default="vaultrag_user"),
        ),
        "PASSWORD": config(
            "POSTGRES_DB_PASSWORD",
            default=config(
                "POSTGRES_APP_PASSWORD", default="vaultrag_secure_password_dev"
            ),
        ),
        "HOST": config("POSTGRES_HOST", default="postgres"),
        "PORT": config("POSTGRES_PORT", default="5432"),
        "ATOMIC_REQUESTS": True,
    }
}

# Multi-Tenancy Registration Invariants
ALLOW_PUBLIC_TENANT_REGISTRATION = config(
    "ALLOW_PUBLIC_TENANT_REGISTRATION", default=DEBUG, cast=bool
)
TENANT_REGISTRATION_INVITE_CODE = config(
    "TENANT_REGISTRATION_INVITE_CODE", default=""
)

# When True (default), self-service registrations wait in a review queue until the
# platform owner approves them in Django admin. A valid invite code skips the queue.
TENANT_REGISTRATION_REQUIRES_APPROVAL = config(
    "TENANT_REGISTRATION_REQUIRES_APPROVAL", default=True, cast=bool
)
# Stop accepting new requests while this many are already waiting (spam guard).
TENANT_REGISTRATION_MAX_PENDING = config(
    "TENANT_REGISTRATION_MAX_PENDING", default=50, cast=int
)
# Used for the sign-in link in approval emails.
FRONTEND_BASE_URL = config("FRONTEND_BASE_URL", default="http://localhost:3000")

# Custom User Model - Configured from Day 1
AUTH_USER_MODEL = "accounts.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework Settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
        "search": "60/minute",
        "chat": "30/minute",
        "contact": "5/minute",
    },
}

# SimpleJWT Settings
JWT_SIGNING_KEY = config("JWT_SIGNING_KEY", default=SECRET_KEY)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": JWT_SIGNING_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# CORS & CSRF Settings (Allow Next.js frontend and configured domains)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=lambda v: [s.strip() for s in v.split(",") if s.strip()],
)
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=lambda v: [s.strip() for s in v.split(",") if s.strip()],
)

# AI Service Flags
ALLOW_MOCK_AI_FALLBACK = config("ALLOW_MOCK_AI_FALLBACK", default=DEBUG, cast=bool)

# Celery Configuration
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://redis:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ALWAYS_EAGER = config("CELERY_TASK_ALWAYS_EAGER", default=DEBUG, cast=bool)

# Email & Lead Notification Service (SMTP / Resend / SES)
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default=(
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    ),
)
EMAIL_HOST = config("EMAIL_HOST", default="smtp.resend.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config(
    "DEFAULT_FROM_EMAIL", default="VaultRAG Notifications <leads@vaultrag.com>"
)
SERVER_EMAIL = config("SERVER_EMAIL", default=DEFAULT_FROM_EMAIL)

admin_emails_raw = config("ADMIN_EMAILS", default="luckmeena191@gmail.com")
ADMINS = [
    ("Admin", email.strip())
    for email in admin_emails_raw.split(",")
    if email.strip()
]
CELERY_TASK_EAGER_PROPAGATES = True
