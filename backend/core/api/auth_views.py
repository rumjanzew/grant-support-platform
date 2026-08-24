from django.conf import settings
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema

from core.api.auth_serializers import (
    ActiveUserTokenRefreshSerializer,
    CurrentUserSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegistrationSerializer,
)
from core.api.permissions import IsActivePlatformUser
from core.services.audit import write_audit_log


class RegistrationView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = (AllowAny,)


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
