from django.db import migrations


INITIAL_ROLES = (
    ("Applicant", "Заявитель"),
    ("Expert", "Эксперт"),
    ("Administrator", "Администратор"),
)


def create_initial_roles(apps, schema_editor):
    role_model = apps.get_model("core", "Role")
    for name, description in INITIAL_ROLES:
        role_model.objects.get_or_create(
            name=name,
            defaults={"description": description},
        )


def remove_initial_roles(apps, schema_editor):
    role_model = apps.get_model("core", "Role")
    role_model.objects.filter(name__in=[name for name, _ in INITIAL_ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_initial_roles, remove_initial_roles),
    ]
