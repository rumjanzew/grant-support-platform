from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Application, AuditLog, Grant, Organization, Role, User


class CoreApiTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.expert_role = Role.objects.get(name=Role.Name.EXPERT)
        cls.administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)

        cls.admin = User.objects.create_user(
            email="admin@example.com",
            role=cls.administrator_role,
        )
        cls.expert = User.objects.create_user(
            email="expert@example.com",
            role=cls.expert_role,
        )
        cls.organization = Organization.objects.create(
            name="Организация заявителя",
            inn="1101000000",
            kpp="110101001",
            ogrn="1021100000000",
            organization_type="НКО",
        )
        cls.other_organization = Organization.objects.create(
            name="Другая организация",
            inn="1101000001",
            kpp="110101002",
            ogrn="1021100000001",
            organization_type="МСП",
        )
        cls.applicant = User.objects.create_user(
            email="applicant@example.com",
            role=cls.applicant_role,
            organization=cls.organization,
        )
        cls.other_applicant = User.objects.create_user(
            email="other@example.com",
            role=cls.applicant_role,
            organization=cls.other_organization,
        )

        today = timezone.localdate()
        cls.open_grant = Grant.objects.create(
            code="OPEN-001",
            title="Открытый образовательный грант",
            description="Поддержка образовательных проектов",
            category="Образование",
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=30),
            max_amount=Decimal("1000000.00"),
            status=Grant.Status.OPEN,
            created_by=cls.admin,
        )
        cls.published_grant = Grant.objects.create(
            code="PUBLISHED-001",
            title="Опубликованный грант",
            description="Приём заявок ещё не открыт",
            category="Культура",
            start_date=today + timedelta(days=10),
            end_date=today + timedelta(days=40),
            max_amount=Decimal("500000.00"),
            status=Grant.Status.PUBLISHED,
            created_by=cls.admin,
        )
        cls.draft_grant = Grant.objects.create(
            code="DRAFT-001",
            title="Скрытый черновик",
            description="Не опубликован",
            category="Образование",
            start_date=today,
            end_date=today + timedelta(days=10),
            max_amount=Decimal("100000.00"),
            status=Grant.Status.DRAFT,
            created_by=cls.admin,
        )

    def grant_payload(self, **overrides):
        today = timezone.localdate()
        payload = {
            "code": "NEW-001",
            "title": "Новый грант",
            "description": "Описание гранта",
            "category": "Социальные проекты",
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=20)).isoformat(),
            "max_amount": "250000.00",
            "status": Grant.Status.OPEN,
        }
        payload.update(overrides)
        return payload

    def test_public_grants_are_visible_filtered_and_paginated(self):
        response = self.client.get(reverse("grant-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        returned_ids = {item["id"] for item in response.data["results"]}
        self.assertIn(str(self.open_grant.id), returned_ids)
        self.assertNotIn(str(self.draft_grant.id), returned_ids)

        filtered = self.client.get(
            reverse("grant-list"),
            {
                "search": "образовательный",
                "category": "Образование",
                "status": Grant.Status.OPEN,
                "ordering": "max_amount",
            },
        )
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(filtered.data["results"][0]["id"], str(self.open_grant.id))

        hidden_detail = self.client.get(
            reverse("grant-detail", args=(self.draft_grant.id,))
        )
        self.assertEqual(hidden_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_grant_pagination_boundaries(self):
        today = timezone.localdate()

        for index in range(1, 22):
            markers = ["edge21"]
            if index <= 20:
                markers.append("edge20")
            if index <= 11:
                markers.append("edge11")
            if index <= 10:
                markers.append("edge10")

            Grant.objects.create(
                code=f"PAGE-{index:03d}",
                title=f"Проверка пагинации {index:02d}",
                description=" ".join(markers),
                category="TEST",
                start_date=today - timedelta(days=1),
                end_date=today + timedelta(days=30),
                max_amount=Decimal("100000.00"),
                status=Grant.Status.OPEN,
                created_by=self.admin,
            )

        expectations = {
            "edge10": (10, [10]),
            "edge11": (11, [10, 1]),
            "edge20": (20, [10, 10]),
            "edge21": (21, [10, 10, 1]),
        }

        for search_term, (expected_count, expected_page_sizes) in expectations.items():
            with self.subTest(search_term=search_term):
                for page, expected_page_size in enumerate(expected_page_sizes, start=1):
                    response = self.client.get(
                        reverse("grant-list"),
                        {"search": search_term, "ordering": "title", "page": page},
                    )

                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                    self.assertEqual(response.data["count"], expected_count)
                    self.assertEqual(len(response.data["results"]), expected_page_size)

                self.assertIsNone(response.data["next"])

    def test_only_administrator_can_manage_grants(self):
        self.client.force_authenticate(self.applicant)
        denied = self.client.post(
            reverse("grant-list"),
            self.grant_payload(),
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        created = self.client.post(
            reverse("grant-list"),
            self.grant_payload(),
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["created_by"], self.admin.id)
        self.assertTrue(
            AuditLog.objects.filter(
                action="grant.created",
                entity_id=created.data["id"],
            ).exists()
        )

        invalid = self.client.post(
            reverse("grant-list"),
            self.grant_payload(
                code="NEW-002",
                start_date="2026-09-10",
                end_date="2026-09-01",
            ),
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        deleted = self.client.delete(
            reverse("grant-detail", args=(created.data["id"],))
        )
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_applicant_can_create_and_update_only_one_organization(self):
        applicant = User.objects.create_user(
            email="new-applicant@example.com",
            role=self.applicant_role,
        )
        self.client.force_authenticate(applicant)
        payload = {
            "name": "Новая организация",
            "inn": "1101000002",
            "kpp": "110101003",
            "ogrn": "1021100000002",
            "organization_type": "НКО",
            "city": "Сыктывкар",
        }

        created = self.client.post(
            reverse("organization-list"),
            payload,
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        applicant.refresh_from_db()
        self.assertEqual(str(applicant.organization_id), created.data["id"])

        duplicate = self.client.post(
            reverse("organization-list"),
            {**payload, "inn": "1101000003", "ogrn": "1021100000003"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        updated = self.client.patch(
            reverse("organization-me"),
            {"city": "Ухта"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["city"], "Ухта")

    def test_expert_cannot_access_applicant_organization_api(self):
        self.client.force_authenticate(self.expert)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_applicant_creates_and_sees_only_own_applications(self):
        other_application = Application.objects.create(
            application_number="GR-2026-90001",
            organization=self.other_organization,
            grant=self.open_grant,
            project_name="Чужой проект",
            description="Чужая заявка",
            requested_amount=Decimal("50000.00"),
        )
        self.client.force_authenticate(self.applicant)
        payload = {
            "grant": str(self.open_grant.id),
            "project_name": "Собственный проект",
            "description": "Описание собственного проекта",
            "requested_amount": "100000.00",
        }

        created = self.client.post(
            reverse("application-list"),
            payload,
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["organization"], self.organization.id)
        self.assertEqual(created.data["status"], Application.Status.DRAFT)
        self.assertTrue(
            AuditLog.objects.filter(
                action="application.created",
                entity_id=created.data["id"],
            ).exists()
        )

        applications = self.client.get(reverse("application-list"))
        returned_ids = {item["id"] for item in applications.data}
        self.assertIn(created.data["id"], returned_ids)
        self.assertNotIn(str(other_application.id), returned_ids)

        updated = self.client.patch(
            reverse("application-detail", args=(created.data["id"],)),
            {"project_name": "Обновлённый проект"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)

        application = Application.objects.get(pk=created.data["id"])
        application.status = Application.Status.SUBMITTED
        application.save(update_fields=("status", "updated_at"))
        blocked = self.client.patch(
            reverse("application-detail", args=(application.id,)),
            {"project_name": "Запрещённое изменение"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

    def test_guest_cannot_create_application(self):
        response = self.client.post(
            reverse("application-list"),
            {
                "grant": str(self.open_grant.id),
                "project_name": "Проект гостя",
                "description": "Описание",
                "requested_amount": "10000.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
