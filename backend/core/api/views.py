from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.api.pagination import GrantPagination
from core.api.permissions import (
    IsAdministratorOrReadOnly,
    IsApplicant,
    is_administrator,
)
from core.api.serializers import (
    ApplicationSerializer,
    GrantSerializer,
    OrganizationSerializer,
)
from core.models import Application, Grant, Organization, User


class GrantViewSet(viewsets.ModelViewSet):
    serializer_class = GrantSerializer
    permission_classes = (IsAdministratorOrReadOnly,)
    pagination_class = GrantPagination
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("title", "description", "code")
    ordering_fields = (
        "title",
        "start_date",
        "end_date",
        "max_amount",
        "created_at",
    )
    ordering = ("-created_at",)

    def get_queryset(self):
        queryset = Grant.objects.select_related("created_by")
        if not is_administrator(self.request.user):
            queryset = queryset.filter(
                status__in=(Grant.Status.PUBLISHED, Grant.Status.OPEN)
            )

        status_value = self.request.query_params.get("status")
        category = self.request.query_params.get("category")
        if status_value:
            if status_value not in Grant.Status.values:
                raise ValidationError({"status": "Неизвестный статус гранта."})
            queryset = queryset.filter(status=status_value)
        if category:
            queryset = queryset.filter(category__iexact=category)

        queryset = self._filter_date(queryset, "start_date", "start_date_from", "gte")
        queryset = self._filter_date(queryset, "start_date", "start_date_to", "lte")
        queryset = self._filter_date(queryset, "end_date", "deadline_from", "gte")
        queryset = self._filter_date(queryset, "end_date", "deadline_to", "lte")
        return queryset

    def _filter_date(self, queryset, field, parameter, lookup):
        raw_value = self.request.query_params.get(parameter)
        if not raw_value:
            return queryset
        value = parse_date(raw_value)
        if value is None:
            raise ValidationError({parameter: "Используйте формат даты YYYY-MM-DD."})
        return queryset.filter(**{f"{field}__{lookup}": value})

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        grant = self.get_object()
        if grant.applications.exists():
            raise ValidationError(
                {"detail": "Грант с заявками необходимо архивировать, а не удалять."}
            )
        return super().destroy(request, *args, **kwargs)


class OrganizationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = OrganizationSerializer
    permission_classes = (IsApplicant,)

    def get_queryset(self):
        organization_id = self.request.user.organization_id
        if not organization_id:
            return Organization.objects.none()
        return Organization.objects.filter(pk=organization_id)

    def perform_create(self, serializer):
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=self.request.user.pk)
            if user.organization_id:
                raise ValidationError(
                    {"detail": "У пользователя уже указана организация."}
                )
            organization = serializer.save()
            user.organization = organization
            user.save(update_fields=("organization", "updated_at"))
            self.request.user.organization = organization

    @action(detail=False, methods=("get", "put", "patch"), url_path="me")
    def me(self, request):
        organization = get_object_or_404(self.get_queryset())
        if request.method == "GET":
            return Response(self.get_serializer(organization).data)

        serializer = self.get_serializer(
            organization,
            data=request.data,
            partial=request.method == "PATCH",
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ApplicationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ApplicationSerializer
    permission_classes = (IsApplicant,)

    def get_queryset(self):
        organization_id = self.request.user.organization_id
        if not organization_id:
            return Application.objects.none()
        return Application.objects.filter(
            organization_id=organization_id
        ).select_related("grant", "organization")

    def perform_create(self, serializer):
        organization = self.request.user.organization
        if organization is None:
            raise ValidationError(
                {"organization": "Сначала необходимо создать организацию."}
            )
        if organization.status != Organization.Status.ACTIVE:
            raise PermissionDenied("Заблокированная организация не может подавать заявки.")
        serializer.save(organization=organization)

    def update(self, request, *args, **kwargs):
        application = self.get_object()
        editable_statuses = {
            Application.Status.DRAFT,
            Application.Status.REVISION_REQUIRED,
        }
        if application.status not in editable_statuses:
            raise ValidationError(
                {"status": "Заявку в текущем статусе нельзя редактировать."}
            )
        return super().update(request, *args, **kwargs)
