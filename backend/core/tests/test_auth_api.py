from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Grant, Role, User


class AuthenticationApiTests(APITestCase):
    password = "S3cure-Grant-2026!"

    @classmethod
    def setUpTestData(cls):
        cls.applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.administrator_role = Role.objects.get(name=Role.Name.ADMINISTRATOR)

    def registration_payload(self, **overrides):
        payload = {
            "email": "new-user@example.com",
            "password": self.password,
            "password_confirm": self.password,
            "first_name": "Иван",
            "last_name": "Иванов",
            "middle_name": "Иванович",
            "phone": "+7 (912) 123-45-67",
            "consent_pd_agreed": True,
        }
        payload.update(overrides)
        return payload

    def create_applicant(self, email="applicant-auth@example.com", **extra_fields):
        return User.objects.create_user(
            email=email,
            password=self.password,
            role=self.applicant_role,
            **extra_fields,
        )

    def login(self, email, password=None):
        return self.client.post(
            reverse("auth-login"),
            {"email": email, "password": password or self.password},
            format="json",
        )

    def test_successful_registration_assigns_applicant_and_hashes_password(self):
        payload = self.registration_payload(role=Role.Name.ADMINISTRATOR)
        response = self.client.post(
            reverse("auth-register"),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email=payload["email"])
        self.assertEqual(user.role, self.applicant_role)
        self.assertTrue(user.check_password(self.password))
        self.assertNotEqual(user.password, self.password)
        self.assertIsNotNone(user.consent_pd_agreed_at)
        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)
        self.assertEqual(response.data["role"], Role.Name.APPLICANT)

    def test_duplicate_email_is_rejected_case_insensitively(self):
        self.create_applicant(email="duplicate@example.com")
        response = self.client.post(
            reverse("auth-register"),
            self.registration_payload(email="DUPLICATE@example.com"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_successful_login_returns_access_and_refresh_tokens(self):
        user = self.create_applicant()
        response = self.login(user.email)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        refreshed = self.client.post(
            reverse("auth-refresh"),
            {"refresh": response.data["refresh"]},
            format="json",
        )
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
        self.assertIn("access", refreshed.data)

    def test_wrong_password_and_blocked_user_cannot_login(self):
        user = self.create_applicant()
        wrong_password = self.login(user.email, "Wrong-password-2026!")
        self.assertEqual(wrong_password.status_code, status.HTTP_401_UNAUTHORIZED)

        refresh = self.login(user.email).data["refresh"]
        user.status = User.Status.BLOCKED
        user.save(update_fields=("status", "updated_at"))
        blocked = self.login(user.email)
        self.assertEqual(blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        blocked_refresh = self.client.post(
            reverse("auth-refresh"),
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(blocked_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_requires_and_accepts_bearer_access_token(self):
        user = self.create_applicant()
        anonymous = self.client.get(reverse("auth-me"))
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)

        tokens = self.login(user.email).data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(user.id))
        self.assertEqual(response.data["email"], user.email)
        self.assertEqual(response.data["role"], Role.Name.APPLICANT)
        self.assertNotIn("password", response.data)

    def test_logout_blacklists_refresh_and_invalid_token_is_rejected(self):
        user = self.create_applicant()
        tokens = self.login(user.email).data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        logout = self.client.post(
            reverse("auth-logout"),
            {"refresh": tokens["refresh"]},
            format="json",
        )
        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)

        refresh = self.client.post(
            reverse("auth-refresh"),
            {"refresh": tokens["refresh"]},
            format="json",
        )
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)

        invalid_logout = self.client.post(
            reverse("auth-logout"),
            {"refresh": "not-a-valid-token"},
            format="json",
        )
        self.assertEqual(invalid_logout.status_code, status.HTTP_400_BAD_REQUEST)

    def test_applicant_jwt_does_not_grant_administrative_access(self):
        user = self.create_applicant()
        tokens = self.login(user.email).data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        today = timezone.localdate()
        response = self.client.post(
            reverse("grant-list"),
            {
                "code": "JWT-ADMIN-DENIED",
                "title": "Недоступный грант",
                "description": "Applicant не может создать грант",
                "category": "Тест",
                "start_date": today.isoformat(),
                "end_date": (today + timedelta(days=10)).isoformat(),
                "max_amount": "100000.00",
                "status": Grant.Status.OPEN,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
