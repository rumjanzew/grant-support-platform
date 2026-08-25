from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from core.models import (
    Application,
    AuditLog,
    ExpertAssignment,
    ExpertiseReport,
    Grant,
    Organization,
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
