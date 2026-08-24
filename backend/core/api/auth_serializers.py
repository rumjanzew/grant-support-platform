import re

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from core.models import Role, User


class CurrentUserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "middle_name",
            "phone",
            "role",
            "status",
            "organization",
            "consent_pd_agreed_at",
            "created_at",
        )
        read_only_fields = fields


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)
    consent_pd_agreed = serializers.BooleanField(write_only=True)
    role = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "middle_name",
            "phone",
            "consent_pd_agreed",
            "consent_pd_agreed_at",
            "role",
            "status",
            "created_at",
        )
        read_only_fields = (
            "id",
            "consent_pd_agreed_at",
            "role",
            "status",
            "created_at",
        )
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
            "middle_name": {"required": False, "allow_blank": True},
            "phone": {"required": True, "allow_blank": False},
        }

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Пользователь с таким email уже существует."
            )
        return value

    def validate_phone(self, value):
        normalized = re.sub(r"[\s()-]", "", value)
        if not re.fullmatch(r"\+?[0-9]{10,15}", normalized):
            raise serializers.ValidationError("Укажите корректный номер телефона.")
        return normalized

    def validate_consent_pd_agreed(self, value):
        if value is not True:
            raise serializers.ValidationError(
                "Необходимо согласие на обработку персональных данных."
            )
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Пароли не совпадают."}
            )

        candidate = User(
            email=attrs.get("email", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {"password": list(error.messages)}
            ) from error
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        validated_data.pop("consent_pd_agreed")
        password = validated_data.pop("password")
        applicant_role = Role.objects.get(name=Role.Name.APPLICANT)
        return User.objects.create_user(
            password=password,
            role=applicant_role,
            consent_pd_agreed_at=timezone.now(),
            **validated_data,
        )


class LoginSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": "Неверный email или пароль.",
    }

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.status != User.Status.ACTIVE:
            raise AuthenticationFailed("Учётная запись заблокирована.")
        return data


class ActiveUserTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs["refresh"])
            user_id = refresh[api_settings.USER_ID_CLAIM]
        except (KeyError, TokenError) as error:
            raise AuthenticationFailed("Refresh token недействителен.") from error

        user = User.objects.filter(pk=user_id).first()
        if not user or not user.is_active or user.status != User.Status.ACTIVE:
            raise AuthenticationFailed("Учётная запись заблокирована.")
        return super().validate(attrs)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(write_only=True)

    def validate_refresh(self, value):
        try:
            self.token = RefreshToken(value)
        except TokenError as error:
            raise serializers.ValidationError(
                "Refresh token недействителен."
            ) from error
        request = self.context["request"]
        token_user_id = self.token.get(api_settings.USER_ID_CLAIM)
        if str(token_user_id) != str(request.user.pk):
            raise serializers.ValidationError(
                "Refresh token принадлежит другому пользователю."
            )
        return value

    def save(self, **kwargs):
        self.token.blacklist()
