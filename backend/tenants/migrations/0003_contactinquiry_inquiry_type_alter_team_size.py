from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0002_contactinquiry"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactinquiry",
            name="inquiry_type",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="contactinquiry",
            name="team_size",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]

