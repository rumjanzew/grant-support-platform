from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.api.pagination import GrantPagination
from core.api.permissions import (
    IsAdministratorOrReadOnly,
    IsVerifiedApplicant,
    is_administrator,
)
from core.api.serializers import (
    ApplicationSerializer,
    GrantSerializer,
    OrganizationSerializer,
)
from core.models import Application, Grant, Organization, User
from core.services.application_workflow import submit_application
from core.services.audit import write_audit_log


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
        grant = serializer.save(created_by=self.request.user)
        write_audit_log(
            action="grant.created",
            request=self.request,
            user=self.request.user,
            entity=grant,
            metadata={"status": grant.status},
        )

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        grant = serializer.save()
        write_audit_log(
            action=(
                "grant.archived"
                if previous_status != Grant.Status.ARCHIVED
                and grant.status == Grant.Status.ARCHIVED
                else "grant.updated"
            ),
            request=self.request,
            user=self.request.user,
            entity=grant,
            metadata={"previous_status": previous_status, "status": grant.status},
        )

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
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = (IsVerifiedApplicant,)

    def get_queryset(self):
        organization_id = self.request.user.organization_id
        if not organization_id:
            return Organization.objects.none()
        return Organization.objects.filter(pk=organization_id, deleted_at__isnull=True)

    def perform_create(self, serializer):
        try:
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
        except IntegrityError as error:
            raise ValidationError(
                {
                    "code": "ORGANIZATION_IDENTIFIER_NOT_UNIQUE",
                    "detail": "Организация с таким ИНН или ОГРН уже существует.",
                }
            ) from error

    @action(detail=False, methods=("get", "put", "patch", "delete"), url_path="me")
    def me(self, request):
        organization = get_object_or_404(self.get_queryset())
        if request.method == "GET":
            return Response(self.get_serializer(organization).data)

        if request.method == "DELETE":
            with transaction.atomic():
                organization = Organization.objects.select_for_update().get(
                    pk=organization.pk
                )
                users = list(
                    User.objects.select_for_update().filter(
                        organization=organization,
                        deleted_at__isnull=True,
                    )
                )
                write_audit_log(
                    action="organization.soft_deleted",
                    request=request,
                    user=request.user,
                    entity=organization,
                )
                organization.soft_delete()
                for user in users:
                    write_audit_log(
                        action="user.soft_deleted",
                        request=request,
                        user=request.user,
                        entity=user,
                        metadata={"reason": "organization_soft_deleted"},
                    )
                    user.soft_delete(deleted_at=organization.deleted_at)
            return Response(status=204)

        serializer = self.get_serializer(
            organization,
            data=request.data,
            partial=request.method == "PATCH",
        )
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as error:
            raise ValidationError(
                {
                    "code": "ORGANIZATION_IDENTIFIER_NOT_UNIQUE",
                    "detail": "Организация с таким ИНН или ОГРН уже существует.",
                }
            ) from error
        return Response(serializer.data)


class ApplicationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = (IsVerifiedApplicant,)

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
        application = serializer.save(organization=organization)
        write_audit_log(
            action="application.created",
            request=self.request,
            user=self.request.user,
            entity=application,
            metadata={"status": application.status},
        )

    def update(self, request, *args, **kwargs):
        application = self.get_object()
        editable_statuses = {
            Application.Status.DRAFT,
            Application.Status.REVISION_REQUIRED,
        }
        if application.status not in editable_statuses:
            raise ValidationError(
                {
                    "code": "INVALID_APPLICATION_STATUS",
                    "detail": "Заявку в текущем статусе нельзя редактировать.",
                }
            )
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        application = self.get_object()
        application = submit_application(
            application.id,
            request.user.organization_id,
        )
        write_audit_log(
            action="application.submitted",
            request=request,
            user=request.user,
            entity=application,
            metadata={"status": application.status},
        )
        return Response(self.get_serializer(application).data)
