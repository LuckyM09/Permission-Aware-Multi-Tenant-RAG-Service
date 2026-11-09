"""Create (or promote) the platform owner who reviews registration requests.

Usage:
    python manage.py create_platform_owner --email you@example.com
    python manage.py create_platform_owner --email you@example.com --company "My HQ"

The owner signs in through the normal login page. Sign-in needs membership in an
active workspace, so the command also gives the owner a small HQ workspace if they
have none. Owner rights come from the Django superuser flag.
"""

import getpass

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from accounts.models import User
from tenants.models import Membership, Role, Tenant


class Command(BaseCommand):
    help = "Create or promote the platform owner (can approve registration requests)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument(
            "--password",
            help="Omit to be prompted (recommended; avoids shell history).",
        )
        parser.add_argument("--company", default="Platform HQ")

    def handle(self, *args, **opts):
        email = opts["email"].strip().lower()
        password = opts["password"]

        existing = User.objects.filter(email__iexact=email).first()
        if not existing and not password:
            password = getpass.getpass("Password: ")
            if password != getpass.getpass("Password (again): "):
                raise CommandError("Passwords do not match.")
        if not existing and len(password or "") < 8:
            raise CommandError("Password must be at least 8 characters.")

        with transaction.atomic():
            if existing:
                user = existing
                user.is_staff = True
                user.is_superuser = True
                user.is_active = True
                if password:
                    user.set_password(password)
                user.save()
                created = False
            else:
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    first_name="Platform",
                    last_name="Owner",
                    is_staff=True,
                    is_superuser=True,
                )
                created = True

            membership = (
                Membership.objects.filter(user=user, tenant__is_active=True)
                .order_by("-is_default", "-created_at")
                .first()
            )
            if not membership:
                base = slugify(opts["company"]) or "platform-hq"
                slug, n = base, 1
                while Tenant.objects.filter(slug=slug).exists():
                    slug = f"{base}-{n}"
                    n += 1
                tenant = Tenant.objects.create(
                    name=opts["company"], slug=slug, is_active=True
                )
                Membership.objects.create(
                    tenant=tenant, user=user, role=Role.ADMIN, is_default=True
                )
                self.stdout.write(f"Created workspace '{tenant.name}' for the owner.")

        verb = "Created" if created else "Promoted"
        self.stdout.write(self.style.SUCCESS(f"{verb} platform owner {user.email}."))
