"""Root URL configuration for the GrantSupport backend."""

from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from config.views import health_check
from core.api.attachment_views import (
    ApplicationAttachmentDetailView,
    ApplicationAttachmentListView,
)
from core.api.auth_views import (
    CurrentUserView,
    LoginView,
    LogoutView,
    RefreshView,
    RegistrationView,
)
from core.api.views import ApplicationViewSet, GrantViewSet, OrganizationViewSet


router = DefaultRouter()
router.register("grants", GrantViewSet, basename="grant")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("applications", ApplicationViewSet, basename="application")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/register/", RegistrationView.as_view(), name="auth-register"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path(
        "api/applications/<uuid:application_id>/attachments/",
        ApplicationAttachmentListView.as_view(),
        name="application-attachment-list",
    ),
    path(
        "api/applications/<uuid:application_id>/attachments/<uuid:attachment_id>/",
        ApplicationAttachmentDetailView.as_view(),
        name="application-attachment-detail",
    ),
    path("api/", include(router.urls)),
]
