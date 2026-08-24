import re
from email.utils import make_msgid

from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMessage
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from core.models import Role, User
from core.services.audit import write_audit_log


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
        request = self.context.get("request")
        email = attrs.get("email", "").strip().lower()
        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            user = User.objects.filter(email__iexact=email).first()
            write_audit_log(
                action="auth.login_failed",
                request=request,
                user=user,
                entity=user,
                entity_type="user",
                metadata={"email": email},
            )
            raise
        if self.user.status != User.Status.ACTIVE:
            write_audit_log(
                action="auth.login_failed",
                request=request,
                user=self.user,
                entity=self.user,
                metadata={"email": email, "reason": "blocked"},
            )
            raise AuthenticationFailed("Учётная запись заблокирована.")
        write_audit_log(
            action="auth.login",
            request=request,
            user=self.user,
            entity=self.user,
        )
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


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self, **kwargs):
        email = self.validated_data["email"].strip().lower()
        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
            status=User.Status.ACTIVE,
        ).first()
        if user is None:
            return

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = self.context["frontend_url"].rstrip("/")
        reset_url = f"{frontend_url}/password-reset/confirm?uid={uid}&token={token}"
        EmailMessage(
            subject="Восстановление пароля GrantSupport",
            body=(
                "Для установки нового пароля перейдите по ссылке:\n"
                f"{reset_url}\n\n"
                "Если вы не запрашивали восстановление, проигнорируйте это письмо."
            ),
            to=[user.email],
            headers={"Message-ID": make_msgid(domain="grantsupport.local")},
        ).send()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    default_error = "Ссылка восстановления недействительна или устарела."

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Пароли не совпадают."}
            )
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(
                pk=user_id,
                is_active=True,
                status=User.Status.ACTIVE,
            )
        except (ValueError, TypeError, OverflowError, User.DoesNotExist) as error:
            raise serializers.ValidationError({"detail": self.default_error}) from error
        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"detail": self.default_error})
        try:
            password_validation.validate_password(attrs["password"], user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {"password": list(error.messages)}
            ) from error
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.password_changed_at = timezone.now()
        user.save(update_fields=("password", "password_changed_at", "updated_at"))
        for outstanding_token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding_token)
        return user
