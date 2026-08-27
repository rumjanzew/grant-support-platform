import tempfile
import uuid
from datetime import timedelta
from decimal import Decimal
from urllib.parse import quote

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Application, Attachment, ExpertAssignment, Grant, Organization, Role, User
from core.services.attachments import MAX_FILE_SIZE


class AttachmentApiTests(APITestCase):
    def setUp(self):
        self.media_directory = tempfile.TemporaryDirectory()
        self.media_override = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.media_override.enable()

        applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        expert_role = Role.objects.get(name=Role.Name.EXPERT)
        administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        self.organization = self.create_organization("Вектор", "1101000200")
        self.other_organization = self.create_organization("Орбита", "1101000201")
        self.applicant = User.objects.create_user(
            email="attachment-owner@example.com",
            role=applicant_role,
            organization=self.organization,
        )
        self.other_applicant = User.objects.create_user(
            email="attachment-other@example.com",
            role=applicant_role,
            organization=self.other_organization,
        )
        self.expert = User.objects.create_user(
            email="attachment-expert@example.com",
            role=expert_role,
        )
        self.other_expert = User.objects.create_user(
            email="attachment-unassigned@example.com",
            role=expert_role,
        )
        self.admin = User.objects.create_user(
            email="attachment-admin@example.com",
            role=administrator_role,
        )
        today = timezone.localdate()
        self.grant = Grant.objects.create(
            code="ATTACHMENTS-TEST",
            title="Грант для тестирования вложений",
            description="Тест",
            category="Тест",
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=10),
            max_amount=Decimal("1000000.00"),
            status=Grant.Status.OPEN,
            created_by=self.admin,
        )
        self.application = self.create_application(self.organization)
        self.client.force_authenticate(self.applicant)

    def tearDown(self):
        self.media_override.disable()
        self.media_directory.cleanup()

    def create_organization(self, name, inn):
        return Organization.objects.create(
            name=name,
            inn=inn,
            kpp="110101200",
            ogrn=f"10211{inn}",
            organization_type="НКО",
        )

    def create_application(self, organization, **overrides):
        values = {
            "organization": organization,
            "grant": self.grant,
            "project_name": "Проект с документами",
            "description": "Описание проекта",
            "requested_amount": Decimal("100000.00"),
        }
        values.update(overrides)
        return Application.objects.create(**values)

    def upload(self, name, content, content_type):
        return self.client.post(
            reverse("application-attachment-list", args=(self.application.id,)),
            {"file": SimpleUploadedFile(name, content, content_type)},
            format="multipart",
        )

    def create_stored_attachment(
        self,
        *,
        application=None,
        original_name="Документ проекта.pdf",
        content=b"%PDF-1.4\nprotected document",
    ):
        application = application or self.application
        storage_path = default_storage.save(
            f"applications/{application.id}/{uuid.uuid4().hex}.pdf",
            ContentFile(content),
        )
        return Attachment.objects.create(
            application=application,
            original_name=original_name,
            stored_name=storage_path.rsplit("/", 1)[-1],
            storage_path=storage_path,
            mime_type="application/pdf",
            size_bytes=len(content),
            sha256="a" * 64,
            uploaded_by=self.applicant,
        )

    def create_attachment_metadata(self, index, size_bytes):
        return Attachment.objects.create(
            application=self.application,
            original_name=f"document-{index}.pdf",
            stored_name=f"stored-{index}.pdf",
            storage_path=f"test/stored-{index}.pdf",
            mime_type="application/pdf",
            size_bytes=size_bytes,
            sha256="a" * 64,
            uploaded_by=self.applicant,
        )

    def download(self, attachment, application=None):
        return self.client.get(
            reverse(
                "application-attachment-download",
                args=((application or self.application).id, attachment.id),
            )
        )

    def test_allowed_pdf_uploads(self):
        response = self.upload(
            "proposal.pdf",
            b"%PDF-1.7\nproposal",
            "application/pdf",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("storage_path", response.data)
        self.assertNotIn("stored_name", response.data)

    def test_allowed_docx_uploads(self):
        response = self.upload(
            "proposal.docx",
            b"PK\x03\x04" + b"docx-content",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_executable_file_is_rejected(self):
        response = self.upload(
            "payload.exe",
            b"MZ" + b"executable",
            "application/vnd.microsoft.portable-executable",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "FILE_FORMAT_NOT_SUPPORTED")

    def test_mime_type_must_match_extension(self):
        response = self.upload(
            "proposal.pdf",
            b"%PDF-1.7\nproposal",
            "text/plain",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "FILE_FORMAT_NOT_SUPPORTED")

    def test_file_larger_than_ten_megabytes_is_rejected(self):
        response = self.upload(
            "large.pdf",
            b"%PDF-1.7\n" + b"x" * MAX_FILE_SIZE,
            "application/pdf",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "FILE_TOO_LARGE")

    def test_eleventh_file_is_rejected(self):
        for index in range(10):
            self.create_attachment_metadata(index, 100)
        response = self.upload("eleventh.pdf", b"%PDF-1.7\nfile", "application/pdf")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "FILE_LIMIT_EXCEEDED")

    def test_total_size_over_fifty_megabytes_is_rejected(self):
        for index in range(9):
            self.create_attachment_metadata(index, 5 * 1024 * 1024 + 512 * 1024)
        response = self.upload(
            "last.pdf",
            b"%PDF-1.7\n" + b"x" * (600 * 1024),
            "application/pdf",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "TOTAL_FILE_SIZE_EXCEEDED")

    def test_applicant_can_download_own_attachment(self):
        attachment = self.create_stored_attachment()
        response = self.download(attachment)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-1.4\nprotected document")

    def test_assigned_expert_can_download_attachment(self):
        attachment = self.create_stored_attachment()
        ExpertAssignment.objects.create(
            application=self.application,
            expert=self.expert,
            assigned_by=self.admin,
        )
        self.client.force_authenticate(self.expert)
        response = self.download(attachment)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        b"".join(response.streaming_content)

    def test_administrator_can_download_attachment(self):
        attachment = self.create_stored_attachment()
        self.client.force_authenticate(self.admin)
        response = self.download(attachment)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        b"".join(response.streaming_content)

    def test_other_applicant_cannot_download_attachment(self):
        attachment = self.create_stored_attachment()
        self.client.force_authenticate(self.other_applicant)
        self.assertEqual(self.download(attachment).status_code, status.HTTP_403_FORBIDDEN)

    def test_unassigned_expert_cannot_download_attachment(self):
        attachment = self.create_stored_attachment()
        self.client.force_authenticate(self.other_expert)
        self.assertEqual(self.download(attachment).status_code, status.HTTP_403_FORBIDDEN)

    def test_guest_cannot_download_attachment(self):
        attachment = self.create_stored_attachment()
        self.client.force_authenticate(user=None)
        self.assertEqual(self.download(attachment).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_storage_file_returns_not_found(self):
        attachment = self.create_attachment_metadata(1, 100)
        self.assertEqual(self.download(attachment).status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_attachment_returns_not_found(self):
        response = self.client.get(
            reverse(
                "application-attachment-download",
                args=(self.application.id, uuid.uuid4()),
            )
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mismatched_application_and_attachment_returns_not_found(self):
        other_application = self.create_application(self.other_organization)
        attachment = self.create_stored_attachment(application=other_application)
        self.client.force_authenticate(self.admin)
        response = self.download(attachment, application=self.application)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unicode_original_filename_is_used_in_content_disposition(self):
        original_name = "Смета проекта 2026.pdf"
        attachment = self.create_stored_attachment(original_name=original_name)
        response = self.download(attachment)
        self.assertIn(
            f"filename*=utf-8''{quote(original_name)}",
            response["Content-Disposition"],
        )
        b"".join(response.streaming_content)
