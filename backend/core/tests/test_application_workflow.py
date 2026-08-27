import hashlib
import tempfile
from datetime import timedelta
from decimal import Decimal

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Application, Attachment, AuditLog, Grant, Organization, Role, User
from core.services.attachments import MAX_FILE_SIZE


class ApplicationWorkflowTests(APITestCase):
    def setUp(self):
        self.media_directory = tempfile.TemporaryDirectory()
        self.media_override = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.media_override.enable()

        applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        self.admin = User.objects.create_user(
            email="workflow-admin@example.com",
            role=administrator_role,
        )
        self.organization = Organization.objects.create(
            name="Организация workflow",
            inn="1101000100",
            kpp="110101100",
            ogrn="1021100000100",
            organization_type="НКО",
        )
        self.other_organization = Organization.objects.create(
            name="Чужая организация workflow",
            inn="1101000101",
            kpp="110101101",
            ogrn="1021100000101",
            organization_type="МСП",
        )
        self.applicant = User.objects.create_user(
            email="workflow-applicant@example.com",
            role=applicant_role,
            organization=self.organization,
        )
        self.other_applicant = User.objects.create_user(
            email="workflow-other@example.com",
            role=applicant_role,
            organization=self.other_organization,
        )
        today = timezone.localdate()
        self.grant = Grant.objects.create(
            code="WORKFLOW-OPEN",
            title="Грант для подачи заявки",
            description="Открытый грант",
            category="Тест",
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=10),
            max_amount=Decimal("1000000.00"),
            status=Grant.Status.OPEN,
            created_by=self.admin,
        )
        self.client.force_authenticate(self.applicant)

    def tearDown(self):
        self.media_override.disable()
        self.media_directory.cleanup()

    def create_application(self, **overrides):
        values = {
            "organization": self.organization,
            "grant": self.grant,
            "project_name": "Проект заявителя",
            "description": "Полное описание проекта",
            "requested_amount": Decimal("100000.00"),
        }
        values.update(overrides)
        return Application.objects.create(**values)

    def submit(self, application):
        return self.client.post(
            reverse("application-submit", args=(application.id,)),
            format="json",
        )

    def upload(
        self,
        application,
        name="document.pdf",
        content=b"%PDF-1.4\nGrantSupport document",
        content_type="application/pdf",
    ):
        return self.client.post(
            reverse("application-attachment-list", args=(application.id,)),
            {"file": SimpleUploadedFile(name, content, content_type)},
            format="multipart",
        )

    def test_successful_submit_assigns_number_and_submitted_status(self):
        application = self.create_application()
        self.assertIsNone(application.application_number)

        response = self.submit(application)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        application.refresh_from_db()
        self.assertEqual(application.status, Application.Status.SUBMITTED)
        self.assertRegex(application.application_number, r"^GR-\d{4}-\d{5}$")
        self.assertIsNotNone(application.submitted_at)
        self.assertTrue(
            AuditLog.objects.filter(
                action="application.submitted",
                entity_id=application.id,
            ).exists()
        )

    def test_revision_required_submits_as_revision_and_keeps_number(self):
        application = self.create_application(
            application_number="GR-2026-90010",
            status=Application.Status.REVISION_REQUIRED,
        )

        response = self.submit(application)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        application.refresh_from_db()
        self.assertEqual(application.status, Application.Status.REVISION_SUBMITTED)
        self.assertEqual(application.application_number, "GR-2026-90010")
        self.assertEqual(application.version, 2)

    def test_submit_after_grant_deadline_is_rejected(self):
        today = timezone.localdate()
        expired_grant = Grant.objects.create(
            code="WORKFLOW-EXPIRED",
            title="Завершённый грант",
            description="Срок закончился",
            category="Тест",
            start_date=today - timedelta(days=20),
            end_date=today - timedelta(days=1),
            max_amount=Decimal("1000000.00"),
            status=Grant.Status.OPEN,
            created_by=self.admin,
        )
        application = self.create_application(grant=expired_grant)

        response = self.submit(application)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "APPLICATION_PERIOD_ENDED")
        application.refresh_from_db()
        self.assertEqual(application.status, Application.Status.DRAFT)

    def test_repeated_submit_is_rejected(self):
        application = self.create_application()
        self.assertEqual(self.submit(application).status_code, status.HTTP_200_OK)

        repeated = self.submit(application)

        self.assertEqual(repeated.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(repeated.data["code"], "INVALID_APPLICATION_STATUS")

    def test_other_organization_cannot_submit_or_upload(self):
        application = self.create_application(organization=self.other_organization)

        submit = self.submit(application)
        upload = self.upload(application)

        self.assertEqual(submit.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(upload.status_code, status.HTTP_404_NOT_FOUND)

    def test_upload_and_delete_attachment(self):
        application = self.create_application()
        content = b"%PDF-1.4\nGrantSupport document"

        uploaded = self.upload(application, content=content)

        self.assertEqual(uploaded.status_code, status.HTTP_201_CREATED)
        attachment = Attachment.objects.get(pk=uploaded.data["id"])
        self.assertEqual(attachment.sha256, hashlib.sha256(content).hexdigest())
        self.assertEqual(attachment.size_bytes, len(content))
        self.assertTrue(default_storage.exists(attachment.storage_path))

        with self.captureOnCommitCallbacks(execute=True):
            deleted = self.client.delete(
                reverse(
                    "application-attachment-detail",
                    args=(application.id, attachment.id),
                )
            )
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Attachment.objects.filter(pk=attachment.id).exists())
        self.assertFalse(default_storage.exists(attachment.storage_path))

    def test_file_larger_than_ten_megabytes_is_rejected(self):
        application = self.create_application()
        response = self.upload(
            application,
            name="large.pdf",
            content=b"%PDF-1.4\n" + b"x" * MAX_FILE_SIZE,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "FILE_TOO_LARGE")
        self.assertFalse(application.attachments.exists())

    def test_more_than_ten_files_is_rejected(self):
        application = self.create_application()
        for index in range(10):
            Attachment.objects.create(
                application=application,
                original_name=f"document-{index}.txt",
                stored_name=f"stored-{index}.txt",
                storage_path=f"test/stored-{index}.txt",
                mime_type="text/plain",
                size_bytes=10,
                sha256="a" * 64,
                uploaded_by=self.applicant,
            )

        response = self.upload(application, name="eleventh.pdf")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "FILE_LIMIT_EXCEEDED")
        self.assertEqual(application.attachments.count(), 10)

    def test_submitted_application_cannot_be_edited_or_receive_files(self):
        application = self.create_application(status=Application.Status.SUBMITTED)

        edited = self.client.patch(
            reverse("application-detail", args=(application.id,)),
            {"project_name": "Запрещённое изменение"},
            format="json",
        )
        uploaded = self.upload(application)

        self.assertEqual(edited.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(edited.data["code"], "INVALID_APPLICATION_STATUS")
        self.assertEqual(uploaded.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(uploaded.data["code"], "INVALID_APPLICATION_STATUS")
