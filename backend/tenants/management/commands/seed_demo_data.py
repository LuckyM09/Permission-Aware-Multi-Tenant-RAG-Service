from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from tenants.models import Group, GroupMember, Membership, Role, Tenant

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds initial demo tenants, users, roles, and groups for VaultRAG."

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.NOTICE("Seeding VaultRAG demo tenants and personas...")
        )

        password = "SecurePassword123!"

        # 1. Create Tenant A (Acme Corp)
        tenant_a, _ = Tenant.objects.get_or_create(
            slug="acme-corp",
            defaults={"name": "Acme Corp"},
        )
        group_hr, _ = Group.objects.get_or_create(
            tenant=tenant_a,
            name="Human Resources",
            defaults={"description": "HR and People Operations"},
        )
        group_eng, _ = Group.objects.get_or_create(
            tenant=tenant_a,
            name="Engineering",
            defaults={"description": "Core Software Engineering"},
        )

        # 2. Create Tenant B (Beta Labs)
        tenant_b, _ = Tenant.objects.get_or_create(
            slug="beta-labs",
            defaults={"name": "Beta Labs"},
        )
        group_res, _ = Group.objects.get_or_create(
            tenant=tenant_b,
            name="Research",
            defaults={"description": "R&D and Special Projects"},
        )

        # 3. Create Demo Users & Memberships
        personas = [
            {
                "email": "alice@acme.com",
                "first_name": "Alice",
                "last_name": "HR Admin",
                "tenant": tenant_a,
                "role": Role.ADMIN,
                "groups": [group_hr, group_eng],
            },
            {
                "email": "bob@acme.com",
                "first_name": "Bob",
                "last_name": "Engineer",
                "tenant": tenant_a,
                "role": Role.MEMBER,
                "groups": [group_eng],
            },
            {
                "email": "charlie@acme.com",
                "first_name": "Charlie",
                "last_name": "Viewer",
                "tenant": tenant_a,
                "role": Role.VIEWER,
                "groups": [],
            },
            {
                "email": "mallory@betalabs.com",
                "first_name": "Mallory",
                "last_name": "Attacker",
                "tenant": tenant_b,
                "role": Role.MEMBER,
                "groups": [group_res],
            },
        ]

        for p in personas:
            user, created = User.objects.get_or_create(
                email=p["email"],
                defaults={
                    "first_name": p["first_name"],
                    "last_name": p["last_name"],
                },
            )
            user.set_password(password)
            user.save()

            # Assign membership
            Membership.objects.update_or_create(
                tenant=p["tenant"],
                user=user,
                defaults={"role": p["role"], "is_default": True},
            )

            # Assign groups
            for grp in p["groups"]:
                GroupMember.objects.get_or_create(group=grp, user=user)

            status_str = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"  [{status_str}] {user.email} in {p['tenant'].name} as {p['role']}"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                "\nSuccessfully seeded all demo personas! Passwords set to 'SecurePassword123!'."
            )
        )
