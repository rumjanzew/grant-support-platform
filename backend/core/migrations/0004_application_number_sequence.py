from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_alter_application_application_number_attachment"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE SEQUENCE application_number_seq "
                "AS bigint START WITH 1 INCREMENT BY 1 "
                "MINVALUE 1 MAXVALUE 99999 NO CYCLE"
            ),
            reverse_sql="DROP SEQUENCE IF EXISTS application_number_seq",
        ),
    ]
