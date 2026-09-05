from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.test import override_settings

from core.models import (
    Application,
    AuditLog,
    ExpertAssignment,
    ExpertiseReport,
    Grant,
    Organization,
    Role,
    User,
)


class SeedDemoCommandTests(TestCase):
    def test_seed_demo_is_idempotent(self):
        call_command("seed_demo", stdout=StringIO())
        call_command("seed_demo", stdout=StringIO())

        self.assertEqual(
            User.objects.filter(email__in=(
                "admin@example.com",
                "expert@example.com",
                "applicant@example.com",
            )).count(),
            3,
        )
        self.assertEqual(Organization.objects.filter(inn__startswith="000000000").count(), 3)
        self.assertEqual(Grant.objects.filter(code__startswith="DEMO-").count(), 8)
        self.assertEqual(
            Application.objects.filter(grant__code__startswith="DEMO-").count(),
            6,
        )
        self.assertEqual(
            set(
                Application.objects.filter(grant__code__startswith="DEMO-")
                .values_list("status", flat=True)
            ),
            {
                Application.Status.DRAFT,
                Application.Status.SUBMITTED,
                Application.Status.UNDER_REVIEW,
                Application.Status.REVISION_REQUIRED,
                Application.Status.APPROVED,
                Application.Status.REJECTED,
            },
        )
        self.assertEqual(ExpertAssignment.objects.count(), 3)
        self.assertEqual(ExpertiseReport.objects.count(), 3)
        self.assertEqual(AuditLog.objects.filter(metadata__source="seed_demo").count(), 5)
        self.assertTrue(
            User.objects.get(email="admin@example.com").check_password("DemoPass2026!")
        )


class SeedGrantsCommandTests(TestCase):
    def setUp(self):
        administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        self.administrator = User.objects.create_user(
            email="catalog-admin@example.com",
            role=administrator_role,
        )

    def test_seed_grants_is_idempotent_and_only_populates_grants(self):
        command_args = ("seed_grants", "--created-by", self.administrator.email)
        command_args += ("--allow-production",)

        call_command(*command_args, stdout=StringIO())
        call_command(*command_args, stdout=StringIO())

        grants = Grant.objects.filter(code__startswith="CATALOG-DEMO-")
        self.assertEqual(grants.count(), 30)
        self.assertEqual(
            grants.filter(status__in=(Grant.Status.OPEN, Grant.Status.PUBLISHED)).count(),
            24,
        )
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Organization.objects.count(), 0)
        self.assertEqual(Application.objects.count(), 0)

    @override_settings(DEBUG=False)
    def test_seed_grants_requires_explicit_production_confirmation(self):
        with self.assertRaises(CommandError):
            call_command(
                "seed_grants",
                "--created-by",
                self.administrator.email,
                stdout=StringIO(),
            )
