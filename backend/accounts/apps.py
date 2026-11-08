from django.apps import AppConfig
from django.core.checks import Error, Tags, register


@register(Tags.security)
def check_postgres_rls_role(app_configs, **kwargs):
    """
    Ensures that in PostgreSQL environments, the database user connecting from Django
    is NOT a superuser and does NOT have the BYPASSRLS attribute.
    Superusers inherently bypass PostgreSQL Row-Level Security, invalidating the anti-leak guarantee.
    """
    import sys
    from decouple import config

    # Schema migration runners or privileged maintenance commands may explicitly allow admin role
    if config("RLS_ALLOW_PRIVILEGED_ROLE", default=False, cast=bool):
        return []

    if any(
        cmd in sys.argv
        for cmd in ["migrate", "makemigrations", "showmigrations", "sqlmigrate"]
    ):
        return []

    from django.db import connection

    errors = []
    if connection.vendor == "postgresql":
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;"
                )
                row = cursor.fetchone()
                if row:
                    role_name, is_super, is_bypass = row
                    if is_super:
                        errors.append(
                            Error(
                                f"Connected database role '{role_name}' is a SUPERUSER. PostgreSQL superusers bypass all Row-Level Security (RLS) policies.",
                                hint="Connect using a dedicated non-superuser role such as 'vaultrag_user' configured with NOSUPERUSER NOBYPASSRLS.",
                                id="vaultrag.security.E001",
                            )
                        )
                    elif is_bypass:
                        errors.append(
                            Error(
                                f"Connected database role '{role_name}' has the BYPASSRLS attribute. This role will bypass tenant data isolation.",
                                hint="Execute 'ALTER ROLE <role> NOBYPASSRLS;' in PostgreSQL.",
                                id="vaultrag.security.E002",
                            )
                        )
        except Exception:
            # Skip check if database server is offline during build/check steps
            pass

    return errors


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
    verbose_name = "Accounts & Authentication"

    def ready(self):
        """
        Runs at application initialization across both CLI and WSGI/ASGI servers (Gunicorn/Uvicorn).
        Validates that the connected PostgreSQL role does not possess SUPERUSER or BYPASSRLS privileges.
        """
        import sys
        from decouple import config

        # Avoid executing DB check during static collection, help, or migrations
        if any(
            cmd in sys.argv
            for cmd in [
                "collectstatic",
                "help",
                "--help",
                "migrate",
                "makemigrations",
                "showmigrations",
            ]
        ):
            return

        if config("RLS_ALLOW_PRIVILEGED_ROLE", default=False, cast=bool):
            return

        from django.conf import settings
        from django.core.exceptions import ImproperlyConfigured

        errors = check_postgres_rls_role(None)
        if errors and not getattr(settings, "DEBUG", False):
            error_msgs = "\n".join(
                f"[{err.id}] {err.msg} ({err.hint})" for err in errors
            )
            raise ImproperlyConfigured(
                f"\n\nCRITICAL SECURITY INVARIANT VIOLATION:\n{error_msgs}\n"
            )
