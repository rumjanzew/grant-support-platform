from django.conf import settings
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema

from core.api.auth_serializers import (
    ActiveUserTokenRefreshSerializer,
    ChangePasswordSerializer,
    CurrentUserSerializer,
    EmailVerificationConfirmSerializer,
    EmailVerificationResendSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileSerializer,
    RegistrationSerializer,
)
from core.api.permissions import IsActivePlatformUser
from core.services.audit import write_audit_log
from core.models import User
from core.services.email_verification import send_verification_email


class RegistrationView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = (AllowAny,)

    def perform_create(self, serializer):
        user = serializer.save()
        send_verification_email(user)
        write_audit_log(
            action="user.registered",
            request=self.request,
            user=user,
            entity=user,
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = (AllowAny,)


class RefreshView(TokenRefreshView):
    serializer_class = ActiveUserTokenRefreshSerializer
    permission_classes = (AllowAny,)


class LogoutView(APIView):
    permission_classes = (IsActivePlatformUser,)

    @extend_schema(request=LogoutSerializer, responses={status.HTTP_204_NO_CONTENT: None})
    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        write_audit_log(
            action="auth.logout",
            request=request,
            user=request.user,
            entity=request.user,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer
    permission_classes = (IsActivePlatformUser,)

    def get_object(self):
        return self.request.user


class ProfileView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProfileSerializer
    permission_classes = (IsActivePlatformUser,)
    http_method_names = ("get", "patch", "delete", "head", "options")

    def get_object(self):
        return self.request.user

    def perform_destroy(self, instance):
        write_audit_log(
            action="user.soft_deleted",
            request=self.request,
            user=instance,
            entity=instance,
        )
        instance.soft_delete()


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = (IsActivePlatformUser,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Пароль успешно изменён. Войдите с новым паролем."}
        )


class PasswordResetRequestView(generics.GenericAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={"frontend_url": settings.FRONTEND_URL},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "detail": (
                    "Если указанный email зарегистрирован, инструкция отправлена."
                )
            }
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Пароль успешно изменён."})


class EmailVerificationConfirmView(generics.GenericAPIView):
    serializer_class = EmailVerificationConfirmSerializer
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if serializer.was_verified:
            write_audit_log(
                action="user.email_verified",
                request=request,
                user=user,
                entity=user,
            )
        return Response(
            {
                "detail": (
                    "Email успешно подтверждён."
                    if serializer.was_verified
                    else "Email уже был подтверждён ранее."
                ),
                "already_verified": not serializer.was_verified,
            }
        )


class EmailVerificationResendView(generics.GenericAPIView):
    serializer_class = EmailVerificationResendSerializer
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
            status=User.Status.ACTIVE,
            deleted_at__isnull=True,
            email_verified_at__isnull=True,
        ).first()
        if user is not None:
            send_verification_email(user)
        return Response(
            {
                "detail": (
                    "Если аккаунт существует и email ещё не подтверждён, "
                    "новое письмо отправлено."
                )
            }
        )
