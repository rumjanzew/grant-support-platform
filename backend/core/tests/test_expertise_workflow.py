from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Application,
    ExpertAssignment,
    ExpertiseReport,
    Grant,
    Organization,
    Role,
    User,
)


class ExpertiseWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        expert_role = Role.objects.get(name=Role.Name.EXPERT)
        applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.admin = User.objects.create_user(
            email="expertise-admin@example.com", role=administrator_role
        )
        cls.expert = User.objects.create_user(
            email="assigned-expert@example.com", role=expert_role
        )
        cls.other_expert = User.objects.create_user(
            email="other-expert@example.com", role=expert_role
        )
        cls.applicant = User.objects.create_user(
            email="expertise-applicant@example.com", role=applicant_role
        )
        cls.organization = Organization.objects.create(
            name="Организация экспертизы",
            inn="1101000200",
            kpp="110101200",
            ogrn="1021100000200",
            organization_type="НКО",
        )
        today = timezone.localdate()
        cls.grant = Grant.objects.create(
            code="EXPERTISE-001",
            title="Грант для экспертизы",
            description="Описание",
            category="Тест",
            start_date=today - timedelta(days=10),
            end_date=today + timedelta(days=10),
            max_amount=Decimal("1000000.00"),
            status=Grant.Status.OPEN,
            created_by=cls.admin,
        )

    def create_application(self, status_value=Application.Status.SUBMITTED, suffix="1"):
        return Application.objects.create(
            application_number=f"GR-2026-8{int(suffix):04d}",
            organization=self.organization,
            grant=self.grant,
            project_name=f"Проект {suffix}",
            description="Описание проекта для экспертизы",
            requested_amount=Decimal("250000.00"),
            status=status_value,
            submitted_at=timezone.now(),
        )

    def assign(self, application, expert=None):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            reverse("admin-application-assign-expert", args=(application.id,)),
            {"expert_id": str((expert or self.expert).id)},
            format="json",
        )

    def test_administrator_assigns_expert_and_starts_review(self):
        application = self.create_application()

        response = self.assign(application)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        application.refresh_from_db()
        assignment = ExpertAssignment.objects.get(application=application)
        self.assertEqual(application.status, Application.Status.UNDER_REVIEW)
        self.assertEqual(assignment.expert, self.expert)
        self.assertEqual(assignment.assigned_by, self.admin)
        self.assertEqual(assignment.status, ExpertAssignment.Status.ACTIVE)

    def test_revision_submitted_application_can_be_assigned(self):
        application = self.create_application(
            Application.Status.REVISION_SUBMITTED,
            "21",
        )

        response = self.assign(application)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        application.refresh_from_db()
        self.assertEqual(application.status, Application.Status.UNDER_REVIEW)

    def test_assignment_requires_administrator_valid_status_and_expert(self):
        draft = self.create_application(Application.Status.DRAFT, "2")
        invalid_status = self.assign(draft)
        self.assertEqual(invalid_status.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_status.data["code"], "INVALID_APPLICATION_STATUS")

        submitted = self.create_application(suffix="3")
        invalid_expert = self.assign(submitted, self.applicant)
        self.assertEqual(invalid_expert.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_expert.data["code"], "INVALID_EXPERT")

        self.client.force_authenticate(self.applicant)
        denied = self.client.post(
            reverse("admin-application-assign-expert", args=(submitted.id,)),
            {"expert_id": str(self.expert.id)},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_expert_sees_only_own_assignments(self):
        own_application = self.create_application(suffix="4")
        other_application = self.create_application(suffix="5")
        own_assignment = ExpertAssignment.objects.create(
            application=own_application, expert=self.expert, assigned_by=self.admin
        )
        ExpertAssignment.objects.create(
            application=other_application,
            expert=self.other_expert,
            assigned_by=self.admin,
        )
        own_application.status = Application.Status.UNDER_REVIEW
        own_application.save(update_fields=("status", "updated_at"))
        other_application.status = Application.Status.UNDER_REVIEW
        other_application.save(update_fields=("status", "updated_at"))

        self.client.force_authenticate(self.expert)
        response = self.client.get(reverse("expert-assignment-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(returned_ids, {str(own_assignment.id)})

    def test_expert_saves_report_draft(self):
        application = self.create_application(suffix="6")
        assignment_response = self.assign(application)
        assignment_id = assignment_response.data["id"]
        self.client.force_authenticate(self.expert)

        response = self.client.patch(
            reverse("expert-assignment-report", args=(assignment_id,)),
            {"score": 82, "comment": "Черновик заключения"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report = ExpertiseReport.objects.get(assignment_id=assignment_id)
        self.assertTrue(report.draft)
        self.assertEqual(report.score, 82)
        application.refresh_from_db()
        self.assertEqual(application.status, Application.Status.UNDER_REVIEW)

    def test_expert_cannot_review_another_experts_assignment(self):
        application = self.create_application(suffix="7")
        assignment_id = self.assign(application).data["id"]
        self.client.force_authenticate(self.other_expert)

        response = self.client.patch(
            reverse("expert-assignment-report", args=(assignment_id,)),
            {"score": 50, "comment": "Чужое заключение"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(ExpertiseReport.objects.filter(assignment_id=assignment_id).exists())

    def test_expert_decisions_complete_assignment_and_change_application_status(self):
        decisions = (
            ExpertiseReport.Decision.APPROVED,
            ExpertiseReport.Decision.REJECTED,
            ExpertiseReport.Decision.REVISION_REQUIRED,
        )
        for index, decision in enumerate(decisions, start=10):
            with self.subTest(decision=decision):
                application = self.create_application(suffix=str(index))
                assignment_id = self.assign(application).data["id"]
                self.client.force_authenticate(self.expert)

                response = self.client.post(
                    reverse("expert-assignment-decision", args=(assignment_id,)),
                    {"score": 75, "comment": "Итоговое заключение", "decision": decision},
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                application.refresh_from_db()
                assignment = ExpertAssignment.objects.get(pk=assignment_id)
                report = ExpertiseReport.objects.get(assignment=assignment)
                self.assertEqual(application.status, decision)
                self.assertEqual(assignment.status, ExpertAssignment.Status.COMPLETED)
                self.assertFalse(report.draft)
                self.assertIsNotNone(report.submitted_at)

    def test_completed_assignment_cannot_receive_second_decision(self):
        application = self.create_application(suffix="20")
        assignment_id = self.assign(application).data["id"]
        self.client.force_authenticate(self.expert)
        payload = {"score": 90, "comment": "Решение", "decision": "APPROVED"}
        self.assertEqual(
            self.client.post(
                reverse("expert-assignment-decision", args=(assignment_id,)),
                payload,
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        repeated = self.client.post(
            reverse("expert-assignment-decision", args=(assignment_id,)),
            payload,
            format="json",
        )

        self.assertEqual(repeated.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(repeated.data["code"], "INVALID_ASSIGNMENT_STATUS")

    def test_administrator_user_list_does_not_expose_password(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("admin-user-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["results"])
        self.assertNotIn("password", response.data["results"][0])
