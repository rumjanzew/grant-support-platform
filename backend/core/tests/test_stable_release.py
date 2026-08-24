from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import AuditLog, Role, User


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://frontend.test",
    PASSWORD_RESET_TIMEOUT=3600,
)
class PasswordResetTests(APITestCase):
    old_password = "Old-Secure-Password-2026!"
    new_password = "New-Secure-Password-2026!"

    @classmethod
    def setUpTestData(cls):
        applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.user = User.objects.create_user(
            email="reset-user@example.com",
            password=cls.old_password,
            role=applicant_role,
            first_name="Reset",
        )

    def request_reset(self, email):
        return self.client.post(
            reverse("auth-password-reset"),
            {"email": email},
            format="json",
        )

    def confirmation_payload(self):
        reset_url = mail.outbox[-1].body.splitlines()[1]
        parameters = parse_qs(urlparse(reset_url).query)
        return {
            "uid": parameters["uid"][0],
            "token": parameters["token"][0],
            "password": self.new_password,
            "password_confirm": self.new_password,
        }

    def test_known_and_unknown_email_have_identical_response(self):
        known = self.request_reset(self.user.email)
        unknown = self.request_reset("unknown@example.com")

        self.assertEqual(known.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_password_reset_changes_password_and_token_is_one_time(self):
        self.assertEqual(self.request_reset(self.user.email).status_code, status.HTTP_200_OK)
        payload = self.confirmation_payload()

        confirmed = self.client.post(
            reverse("auth-password-reset-confirm"), payload, format="json"
        )

        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        old_login = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.old_password},
            format="json",
        )
        new_login = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.new_password},
            format="json",
        )
        reused = self.client.post(
            reverse("auth-password-reset-confirm"), payload, format="json"
        )
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)


class StableReleaseApiTests(APITestCase):
    password = "Stable-Release-Password-2026!"

    @classmethod
    def setUpTestData(cls):
        applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)
        cls.applicant = User.objects.create_user(
            email="statistics-applicant@example.com",
            password=cls.password,
            role=applicant_role,
        )
        cls.admin = User.objects.create_user(
            email="statistics-admin@example.com",
            password=cls.password,
            role=administrator_role,
        )

    def test_login_failure_login_and_logout_are_audited(self):
        failed = self.client.post(
            reverse("auth-login"),
            {"email": self.applicant.email, "password": "Wrong-password!"},
            format="json",
            HTTP_USER_AGENT="Audit test agent",
            REMOTE_ADDR="127.0.0.7",
        )
        self.assertEqual(failed.status_code, status.HTTP_401_UNAUTHORIZED)

        logged_in = self.client.post(
            reverse("auth-login"),
            {"email": self.applicant.email, "password": self.password},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {logged_in.data['access']}"
        )
        logged_out = self.client.post(
            reverse("auth-logout"),
            {"refresh": logged_in.data["refresh"]},
            format="json",
        )

        self.assertEqual(logged_out.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            AuditLog.objects.filter(
                action="auth.login_failed",
                user=self.applicant,
                ip_address="127.0.0.7",
            ).exists()
        )
        self.assertTrue(AuditLog.objects.filter(action="auth.login").exists())
        self.assertTrue(AuditLog.objects.filter(action="auth.logout").exists())

    def test_administrator_statistics_are_protected_and_complete(self):
        self.client.force_authenticate(self.applicant)
        denied = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("applications_by_status", response.data)
        self.assertEqual(len(response.data["user_registrations_by_day"]), 14)
        self.assertEqual(len(response.data["applications_by_day"]), 14)

    def test_openapi_schema_and_swagger_are_public_and_include_jwt(self):
        schema = self.client.get(reverse("openapi-schema"), HTTP_ACCEPT="application/json")
        docs = self.client.get(reverse("swagger-ui"))

        self.assertEqual(schema.status_code, status.HTTP_200_OK)
        self.assertEqual(docs.status_code, status.HTTP_200_OK)
        self.assertIn("jwtAuth", schema.data["components"]["securitySchemes"])
        self.assertIn("/api/auth/password-reset/", schema.data["paths"])
