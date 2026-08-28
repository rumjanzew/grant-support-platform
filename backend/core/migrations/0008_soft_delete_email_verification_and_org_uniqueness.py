import uuid

from django.db import migrations, models
from django.db.models import Count


def verify_organization_identifiers_are_unique(apps, schema_editor):
    Organization = apps.get_model("core", "Organization")
    for field_name, label in (("inn", "ИНН"), ("ogrn", "ОГРН")):
        duplicates = list(
            Organization.objects.values(field_name)
            .annotate(total=Count("id"))
            .filter(total__gt=1)
            .values_list(field_name, "total")
        )
        if duplicates:
            values = ", ".join(f"{value} ({total})" for value, total in duplicates)
            raise RuntimeError(
                f"Невозможно добавить UNIQUE для {label}: обнаружены дубли: {values}. "
                "Исправьте данные вручную и повторите миграцию."
            )


def mark_existing_users_verified(apps, schema_editor):
    User = apps.get_model("core", "User")
    for user in User.objects.filter(email_verified_at__isnull=True).iterator():
        user.email_verified_at = user.created_at
        user.save(update_fields=("email_verified_at",))


class Migration(migrations.Migration):
    dependencies = [("core", "0007_notification")]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="deleted_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="deleted_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verification_nonce",
            field=models.UUIDField(default=uuid.uuid4, editable=False),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(mark_existing_users_verified, migrations.RunPython.noop),
        migrations.RunPython(
            verify_organization_identifiers_are_unique,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="organization",
            name="inn",
            field=models.CharField(max_length=12, unique=True),
        ),
        migrations.AlterField(
            model_name="organization",
            name="ogrn",
            field=models.CharField(max_length=15, unique=True),
        ),
    ]
