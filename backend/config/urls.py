"""Root URL configuration for the GrantSupport backend."""

from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from config.views import health_check
from core.api.views import ApplicationViewSet, GrantViewSet, OrganizationViewSet


router = DefaultRouter()
router.register("grants", GrantViewSet, basename="grant")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("applications", ApplicationViewSet, basename="application")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/", include(router.urls)),
]
