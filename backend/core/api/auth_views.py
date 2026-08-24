from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.api.auth_serializers import (
    ActiveUserTokenRefreshSerializer,
    CurrentUserSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegistrationSerializer,
)
from core.api.permissions import IsActivePlatformUser


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

    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer
    permission_classes = (IsActivePlatformUser,)

    def get_object(self):
        return self.request.user
