import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContactInquiry",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("full_name", models.CharField(max_length=255)),
                ("work_email", models.EmailField(max_length=254)),
                ("company_name", models.CharField(max_length=255)),
                ("team_size", models.CharField(blank=True, max_length=50)),
                ("use_case", models.TextField(blank=True)),
                ("source_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Contact Inquiry",
                "verbose_name_plural": "Contact Inquiries",
                "ordering": ["-created_at"],
            },
        ),
    ]

