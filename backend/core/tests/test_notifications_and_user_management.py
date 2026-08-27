from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Application,
    AuditLog,
    ExpertAssignment,
    Grant,
    Notification,
    Organization,
    Role,
    User,
)


class NotificationWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.expert_role = Role.objects.get(name=Role.Name.EXPERT)
        cls.administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        cls.organization = Organization.objects.create(
            name="Организация уведомлений",
            inn="1101000700",
            kpp="110101700",
            ogrn="1021100000700",
            organization_type="НКО",
        )
        cls.applicant = User.objects.create_user(
            email="notifications-applicant@example.com",
            role=cls.applicant_role,
            organization=cls.organization,
        )
        cls.expert = User.objects.create_user(
            email="notifications-expert@example.com",
            role=cls.expert_role,
        )
        cls.admin = User.objects.create_user(
            email="notifications-admin@example.com",
            role=cls.administrator_role,
        )
        cls.blocked_admin = User.objects.create_user(
            email="notifications-blocked-admin@example.com",
            role=cls.administrator_role,
            status=User.Status.BLOCKED,
        )
        today = timezone.localdate()
        cls.grant = Grant.objects.create(
            code="NOTIFICATIONS-001",
            title="Грант для уведомлений",
            description="Описание",
            category="Тест",
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=10),
            max_amount=Decimal("1000000.00"),
            status=Grant.Status.OPEN,
            created_by=cls.admin,
        )

    def create_application(self, *, status_value=Application.Status.DRAFT, suffix="1"):
        return Application.objects.create(
            application_number=(
                None if status_value == Application.Status.DRAFT else f"GR-2026-7{int(suffix):04d}"
            ),
            organization=self.organization,
            grant=self.grant,
            project_name=f"Проект уведомлений {suffix}",
            description="Описание проекта",
            requested_amount=Decimal("200000.00"),
            status=status_value,
        )

    def assign(self, application):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            reverse("admin-application-assign-expert", args=(application.id,)),
            {"expert_id": str(self.expert.id)},
            format="json",
        )

    def test_submit_notifies_active_administrators(self):
        application = self.create_application()
        self.client.force_authenticate(self.applicant)

        response = self.client.post(reverse("application-submit", args=(application.id,)))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification = Notification.objects.get(
            recipient=self.admin,
            type=Notification.Type.APPLICATION_SUBMITTED,
        )
        self.assertEqual(notification.application, application)
        self.assertFalse(Notification.objects.filter(recipient=self.blocked_admin).exists())

    def test_assign_expert_notifies_assigned_expert(self):
        application = self.create_application(
            status_value=Application.Status.SUBMITTED,
            suffix="2",
        )

        response = self.assign(application)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.expert,
                type=Notification.Type.EXPERT_ASSIGNED,
                application=application,
            ).exists()
        )

    def test_each_expert_decision_notifies_applicant(self):
        cases = (
            ("APPROVED", Notification.Type.APPLICATION_APPROVED),
            ("REJECTED", Notification.Type.APPLICATION_REJECTED),
            ("REVISION_REQUIRED", Notification.Type.REVISION_REQUIRED),
        )
        for index, (decision, notification_type) in enumerate(cases, start=10):
            with self.subTest(decision=decision):
                application = self.create_application(
                    status_value=Application.Status.SUBMITTED,
                    suffix=str(index),
                )
                assignment_id = self.assign(application).data["id"]
                self.client.force_authenticate(self.expert)

                response = self.client.post(
                    reverse("expert-assignment-decision", args=(assignment_id,)),
                    {"score": 80, "comment": "Экспертное решение", "decision": decision},
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertTrue(
                    Notification.objects.filter(
                        recipient=self.applicant,
                        type=notification_type,
                        application=application,
                    ).exists()
                )

    def test_revision_submit_notifies_previous_expert(self):
        application = self.create_application(
            status_value=Application.Status.REVISION_REQUIRED,
            suffix="20",
        )
        ExpertAssignment.objects.create(
            application=application,
            expert=self.expert,
            assigned_by=self.admin,
            status=ExpertAssignment.Status.COMPLETED,
        )
        self.client.force_authenticate(self.applicant)

        response = self.client.post(reverse("application-submit", args=(application.id,)))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.expert,
                type=Notification.Type.REVISION_SUBMITTED,
                application=application,
            ).exists()
        )


class NotificationApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        expert_role = Role.objects.get(name=Role.Name.EXPERT)
        cls.applicant = User.objects.create_user(
            email="notification-api-applicant@example.com", role=applicant_role
        )
        cls.expert = User.objects.create_user(
            email="notification-api-expert@example.com", role=expert_role
        )

    def setUp(self):
        self.own = Notification.objects.create(
            recipient=self.applicant,
            type=Notification.Type.APPLICATION_SUBMITTED,
            title="Своё уведомление",
            message="Текст",
        )
        self.other = Notification.objects.create(
            recipient=self.expert,
            type=Notification.Type.EXPERT_ASSIGNED,
            title="Чужое уведомление",
            message="Текст",
        )

    def test_user_sees_only_own_notifications(self):
        self.client.force_authenticate(self.applicant)
        response = self.client.get(reverse("notification-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data["results"]], [str(self.own.id)])

    def test_read_changes_state_and_other_notification_is_hidden(self):
        self.client.force_authenticate(self.applicant)
        response = self.client.post(reverse("notification-read", args=(self.own.id,)))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.own.refresh_from_db()
        self.assertTrue(self.own.is_read)
        denied = self.client.post(reverse("notification-read", args=(self.other.id,)))
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_unread_count_and_mark_all_read(self):
        Notification.objects.create(
            recipient=self.applicant,
            type=Notification.Type.REVISION_REQUIRED,
            title="Ещё одно",
            message="Текст",
        )
        self.client.force_authenticate(self.applicant)
        count = self.client.get(reverse("notification-unread-count"))
        self.assertEqual(count.data["count"], 2)
        marked = self.client.post(reverse("notification-mark-all-read"))
        self.assertEqual(marked.status_code, status.HTTP_200_OK)
        self.assertEqual(marked.data["updated"], 2)
        self.assertFalse(Notification.objects.filter(recipient=self.applicant, is_read=False).exists())

    def test_guest_has_no_access(self):
        response = self.client.get(reverse("notification-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AdministratorUserManagementTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.expert_role = Role.objects.get(name=Role.Name.EXPERT)
        cls.administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        cls.admin = User.objects.create_user(
            email="user-admin@example.com", role=cls.administrator_role
        )
        cls.other_admin = User.objects.create_user(
            email="other-user-admin@example.com", role=cls.administrator_role
        )
        cls.applicant = User.objects.create_user(
            email="managed-applicant@example.com", role=cls.applicant_role
        )
        cls.expert = User.objects.create_user(
            email="managed-expert@example.com", role=cls.expert_role
        )

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def change_role(self, user, role):
        return self.client.post(
            reverse("admin-user-change-role", args=(user.id,)),
            {"role": role},
            format="json",
        )

    def test_administrator_changes_applicant_and_expert_roles(self):
        self.assertEqual(self.change_role(self.applicant, Role.Name.EXPERT).status_code, status.HTTP_200_OK)
        self.applicant.refresh_from_db()
        self.assertEqual(self.applicant.role, self.expert_role)
        self.assertEqual(self.change_role(self.expert, Role.Name.APPLICANT).status_code, status.HTTP_200_OK)
        self.expert.refresh_from_db()
        self.assertEqual(self.expert.role, self.applicant_role)

    def test_administrator_role_cannot_be_assigned_or_removed(self):
        assigned = self.change_role(self.applicant, Role.Name.ADMINISTRATOR)
        self.assertEqual(assigned.status_code, status.HTTP_400_BAD_REQUEST)
        removed = self.change_role(self.other_admin, Role.Name.EXPERT)
        self.assertEqual(removed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_administrator_cannot_change_or_block_self(self):
        role_response = self.change_role(self.admin, Role.Name.EXPERT)
        block_response = self.client.post(reverse("admin-user-block", args=(self.admin.id,)))
        self.assertEqual(role_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(block_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_block_and_unblock_create_audit_logs(self):
        blocked = self.client.post(reverse("admin-user-block", args=(self.applicant.id,)))
        self.assertEqual(blocked.status_code, status.HTTP_200_OK)
        self.applicant.refresh_from_db()
        self.assertEqual(self.applicant.status, User.Status.BLOCKED)
        unblocked = self.client.post(reverse("admin-user-unblock", args=(self.applicant.id,)))
        self.assertEqual(unblocked.status_code, status.HTTP_200_OK)
        self.assertTrue(
            AuditLog.objects.filter(action="user.blocked", entity_id=self.applicant.id).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(action="user.unblocked", entity_id=self.applicant.id).exists()
        )

    def test_role_change_creates_audit_log_with_old_and_new_values(self):
        response = self.change_role(self.applicant, Role.Name.EXPERT)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.get(action="user.role_changed", entity_id=self.applicant.id)
        self.assertEqual(log.metadata["old_role"], Role.Name.APPLICANT)
        self.assertEqual(log.metadata["new_role"], Role.Name.EXPERT)

    def test_applicant_and_expert_cannot_manage_users(self):
        for user in (self.applicant, self.expert):
            with self.subTest(role=user.role.name):
                self.client.force_authenticate(user)
                response = self.client.post(reverse("admin-user-block", args=(self.other_admin.id,)))
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
