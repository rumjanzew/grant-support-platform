from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Organization, Role, User


class ProfileApiTests(APITestCase):
    password = "S3cure-Grant-2026!"
    new_password = "N3w-Secure-Grant-2026!"

    @classmethod
    def setUpTestData(cls):
        cls.applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        cls.expert_role = Role.objects.get(name=Role.Name.EXPERT)
        cls.organization = Organization.objects.create(
            name="Тестовая организация",
            inn="0000000000",
            kpp="000000000",
            ogrn="0000000000000",
            organization_type="НКО",
            city="Сыктывкар",
        )

    def create_user(self, **overrides):
        values = {
            "email": "profile@example.com",
            "password": self.password,
            "role": self.applicant_role,
            "organization": self.organization,
            "first_name": "Иван",
            "last_name": "Иванов",
            "phone": "+79121234567",
        }
        values.update(overrides)
        return User.objects.create_user(**values)

    def authenticate(self, user):
        response = self.client.post(
            reverse("auth-login"),
            {"email": user.email, "password": self.password},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {response.data['access']}"
        )
        return response.data

    def test_profile_requires_authentication_and_returns_organization(self):
        anonymous = self.client.get(reverse("profile"))
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)

        user = self.create_user()
        self.authenticate(user)
        response = self.client.get(reverse("profile"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], user.email)
        self.assertEqual(response.data["role"], Role.Name.APPLICANT)
        self.assertEqual(response.data["organization"]["id"], str(self.organization.id))
        self.assertNotIn("password", response.data)

    def test_profile_updates_only_personal_fields(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        self.authenticate(user)
        response = self.client.patch(
            reverse("profile"),
            {
                "first_name": "Пётр",
                "last_name": "Петров",
                "middle_name": "Петрович",
                "phone": "+7 (999) 123-45-67",
                "email": "changed@example.com",
                "role": Role.Name.EXPERT,
                "status": User.Status.BLOCKED,
                "is_staff": True,
                "is_superuser": True,
                "password": "unsafe",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Пётр")
        self.assertEqual(user.last_name, "Петров")
        self.assertEqual(user.middle_name, "Петрович")
        self.assertEqual(user.phone, "+79991234567")
        self.assertEqual(user.email, "profile@example.com")
        self.assertEqual(user.role, self.applicant_role)
        self.assertEqual(user.status, User.Status.ACTIVE)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password(self.password))

    def test_change_password_validates_current_password_and_confirmation(self):
        user = self.create_user()
        self.authenticate(user)

        wrong_current = self.client.post(
            reverse("profile-change-password"),
            {
                "current_password": "Wrong-password-2026!",
                "new_password": self.new_password,
                "new_password_confirm": self.new_password,
            },
            format="json",
        )
        self.assertEqual(wrong_current.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", wrong_current.data)

        mismatch = self.client.post(
            reverse("profile-change-password"),
            {
                "current_password": self.password,
                "new_password": self.new_password,
                "new_password_confirm": "Different-password-2026!",
            },
            format="json",
        )
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password_confirm", mismatch.data)

    def test_change_password_invalidates_refresh_and_old_credentials(self):
        user = self.create_user()
        tokens = self.authenticate(user)
        changed = self.client.post(
            reverse("profile-change-password"),
            {
                "current_password": self.password,
                "new_password": self.new_password,
                "new_password_confirm": self.new_password,
            },
            format="json",
        )

        self.assertEqual(changed.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertIsNotNone(user.password_changed_at)
        self.assertFalse(user.check_password(self.password))
        self.assertTrue(user.check_password(self.new_password))

        self.client.credentials()
        old_login = self.client.post(
            reverse("auth-login"),
            {"email": user.email, "password": self.password},
            format="json",
        )
        new_login = self.client.post(
            reverse("auth-login"),
            {"email": user.email, "password": self.new_password},
            format="json",
        )
        old_refresh = self.client.post(
            reverse("auth-refresh"),
            {"refresh": tokens["refresh"]},
            format="json",
        )
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
        self.assertEqual(old_refresh.status_code, status.HTTP_401_UNAUTHORIZED)
