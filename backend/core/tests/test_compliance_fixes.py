from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.mail.backends.base import BaseEmailBackend
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Application, AuditLog, Grant, Organization, Role, User


class FailingEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        raise OSError("SMTP is temporarily unavailable")


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://frontend.test",
    EMAIL_VERIFICATION_TIMEOUT=86400,
)
class EmailVerificationTests(APITestCase):
    password = "Verification-Password-2026!"

    def registration_payload(self, **overrides):
        payload = {
            "email": "verify@example.com",
            "password": self.password,
            "password_confirm": self.password,
            "first_name": "Ирина",
            "last_name": "Тестова",
            "middle_name": "",
            "phone": "+79121234567",
            "consent_pd_agreed": True,
        }
        payload.update(overrides)
        return payload

    def register(self, **overrides):
        return self.client.post(
            reverse("auth-register"),
            self.registration_payload(**overrides),
            format="json",
        )

    def token_from_latest_email(self):
        url = mail.outbox[-1].body.splitlines()[1]
        return parse_qs(urlparse(url).query)["token"][0]

    def test_registration_requires_consent_and_stores_timestamp(self):
        rejected = self.register(consent_pd_agreed=False)
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="verify@example.com").exists())

        accepted = self.register()
        user = User.objects.get(email="verify@example.com")
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(user.consent_pd_agreed_at)
        self.assertIsNone(user.email_verified_at)

    def test_registration_sends_email_and_confirmation_is_one_time(self):
        self.assertEqual(self.register().status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        token = self.token_from_latest_email()

        confirmed = self.client.post(
            reverse("auth-email-verification-confirm"),
            {"token": token},
            format="json",
        )
        repeated = self.client.post(
            reverse("auth-email-verification-confirm"),
            {"token": token},
            format="json",
        )

        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertFalse(confirmed.data["already_verified"])
        self.assertEqual(repeated.status_code, status.HTTP_200_OK)
        self.assertTrue(repeated.data["already_verified"])
        user = User.objects.get(email="verify@example.com")
        self.assertIsNotNone(user.email_verified_at)
        self.assertTrue(
            AuditLog.objects.filter(action="user.email_verified", user=user).exists()
        )

    def test_invalid_and_expired_tokens_are_rejected(self):
        invalid = self.client.post(
            reverse("auth-email-verification-confirm"),
            {"token": "invalid-token"},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid.data["code"], "INVALID_EMAIL_VERIFICATION_TOKEN")

        self.register(email="expired@example.com")
        token = self.token_from_latest_email()
        with override_settings(EMAIL_VERIFICATION_TIMEOUT=-1):
            expired = self.client.post(
                reverse("auth-email-verification-confirm"),
                {"token": token},
                format="json",
            )
        self.assertEqual(expired.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(expired.data["code"], "EMAIL_VERIFICATION_EXPIRED")

    def test_resend_does_not_disclose_account_existence(self):
        self.register()
        mail.outbox.clear()
        known = self.client.post(
            reverse("auth-email-verification-resend"),
            {"email": "verify@example.com"},
            format="json",
        )
        unknown = self.client.post(
            reverse("auth-email-verification-resend"),
            {"email": "unknown@example.com"},
            format="json",
        )
        self.assertEqual(known.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_unverified_user_can_login_but_cannot_create_organization(self):
        self.register()
        login = self.client.post(
            reverse("auth-login"),
            {"email": "verify@example.com", "password": self.password},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        denied = self.client.post(
            reverse("organization-list"),
            {
                "name": "Тестовая организация",
                "inn": "000000001111",
                "ogrn": "000000000001111",
                "organization_type": "НКО",
            },
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(denied.data["code"], "EMAIL_NOT_VERIFIED")

    @override_settings(
        EMAIL_BACKEND="core.tests.test_compliance_fixes.FailingEmailBackend"
    )
    def test_smtp_failure_does_not_rollback_registration_or_return_500(self):
        registered = self.register(email="smtp-failure@example.com")
        self.assertEqual(registered.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="smtp-failure@example.com").exists())

        reset = self.client.post(
            reverse("auth-password-reset"),
            {"email": "smtp-failure@example.com"},
            format="json",
        )
        self.assertEqual(reset.status_code, status.HTTP_200_OK)


class SoftDeleteAndOrganizationUniquenessTests(APITestCase):
    password = "Compliance-Password-2026!"

    @classmethod
    def setUpTestData(cls):
        cls.applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.admin_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        cls.admin = User.objects.create_user(
            email="compliance-admin@example.com",
            password=cls.password,
            role=cls.admin_role,
        )
        cls.organization = Organization.objects.create(
            name="Вымышленная организация",
            inn="000000002222",
            ogrn="000000000002222",
            organization_type="НКО",
        )
        cls.applicant = User.objects.create_user(
            email="soft-delete@example.com",
            password=cls.password,
            role=cls.applicant_role,
            organization=cls.organization,
        )
        today = timezone.localdate()
        cls.grant = Grant.objects.create(
            code="SOFT-DELETE-HISTORY",
            title="Исторический грант",
            description="Проверка сохранения истории",
            category="Тест",
            start_date=today,
            end_date=today + timedelta(days=7),
            max_amount="100000.00",
            status=Grant.Status.OPEN,
            created_by=cls.admin,
        )
        cls.application = Application.objects.create(
            organization=cls.organization,
            grant=cls.grant,
            project_name="Историческая заявка",
            description="Заявка должна сохраниться",
            requested_amount="50000.00",
        )

    def test_administrator_soft_deletes_user_and_preserves_history(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(
            reverse("admin-user-detail", args=(self.applicant.id,))
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        user = User.objects.get(pk=self.applicant.pk)
        self.assertIsNotNone(user.deleted_at)
        self.assertFalse(user.is_active)
        self.assertFalse(user.has_usable_password())
        self.assertTrue(user.email.endswith("@deleted.invalid"))
        self.assertTrue(Application.objects.filter(pk=self.application.pk).exists())
        self.assertTrue(
            AuditLog.objects.filter(action="user.soft_deleted", entity_id=user.id).exists()
        )
        listed = self.client.get(reverse("admin-user-list"))
        self.assertNotContains(listed, "deleted.invalid")

    def test_soft_deleted_user_cannot_login(self):
        self.applicant.soft_delete()
        response = self.client.post(
            reverse("auth-login"),
            {"email": "soft-delete@example.com", "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_organization_soft_delete_anonymizes_and_preserves_application(self):
        self.client.force_authenticate(self.applicant)
        response = self.client.delete(reverse("organization-me"))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        organization = Organization.objects.get(pk=self.organization.pk)
        user = User.objects.get(pk=self.applicant.pk)
        self.assertIsNotNone(organization.deleted_at)
        self.assertEqual(organization.status, Organization.Status.BLOCKED)
        self.assertTrue(organization.name.startswith("Удалённая организация"))
        self.assertIsNotNone(user.deleted_at)
        self.assertTrue(Application.objects.filter(pk=self.application.pk).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                action="organization.soft_deleted",
                entity_id=organization.id,
            ).exists()
        )

    def test_duplicate_inn_and_ogrn_return_validation_errors(self):
        other = User.objects.create_user(
            email="unique-org@example.com",
            password=self.password,
            role=self.applicant_role,
        )
        self.client.force_authenticate(other)
        duplicate = self.client.post(
            reverse("organization-list"),
            {
                "name": "Другая организация",
                "inn": self.organization.inn,
                "ogrn": self.organization.ogrn,
                "organization_type": "ООО",
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inn", duplicate.data)
        self.assertIn("ogrn", duplicate.data)
