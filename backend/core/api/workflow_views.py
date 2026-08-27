from datetime import timedelta

from django.db import transaction
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from core.api.pagination import GrantPagination
from core.api.permissions import IsActivePlatformUser, IsAdministrator, IsExpert
from core.api.workflow_serializers import (
    AdminApplicationSerializer,
    AdministratorDashboardSerializer,
    AssignmentCreateSerializer,
    ExpertAssignmentSerializer,
    ExpertDashboardSerializer,
    ExpertDecisionSerializer,
    ExpertiseReportSerializer,
    ReportDraftSerializer,
    NotificationSerializer,
    UserListSerializer,
    UserRoleChangeSerializer,
)
from core.models import Application, ExpertAssignment, Grant, Notification, Role, User
from core.services.expertise_workflow import (
    assign_expert,
    save_report_draft,
    submit_expert_decision,
)
from core.services.audit import write_audit_log


class AdministratorDashboardView(APIView):
    permission_classes = (IsAdministrator,)

    @extend_schema(responses=AdministratorDashboardSerializer)
    def get(self, request):
        start_date = timezone.localdate() - timedelta(days=13)
        registrations = {
            row["day"]: row["count"]
            for row in User.objects.filter(created_at__date__gte=start_date)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        }
        applications_by_day = {
            row["day"]: row["count"]
            for row in Application.objects.filter(created_at__date__gte=start_date)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        }
        days = [start_date + timedelta(days=offset) for offset in range(14)]
        return Response(
            {
                "grants": Grant.objects.count(),
                "applications": Application.objects.count(),
                "awaiting_assignment": Application.objects.filter(
                    status__in=(
                        Application.Status.SUBMITTED,
                        Application.Status.REVISION_SUBMITTED,
                    )
                ).count(),
                "under_review": Application.objects.filter(
                    status=Application.Status.UNDER_REVIEW
                ).count(),
                "users": User.objects.count(),
                "experts": User.objects.filter(role__name=Role.Name.EXPERT).count(),
                "applications_by_status": [
                    {
                        "status": status_value,
                        "count": Application.objects.filter(status=status_value).count(),
                    }
                    for status_value in Application.Status.values
                ],
                "user_registrations_by_day": [
                    {"date": day.isoformat(), "count": registrations.get(day, 0)}
                    for day in days
                ],
                "applications_by_day": [
                    {"date": day.isoformat(), "count": applications_by_day.get(day, 0)}
                    for day in days
                ],
            }
        )


class AdministratorApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminApplicationSerializer
    permission_classes = (IsAdministrator,)
    pagination_class = GrantPagination
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = (
        "application_number",
        "project_name",
        "organization__name",
        "grant__title",
    )
    ordering_fields = ("submitted_at", "updated_at", "requested_amount")
    ordering = ("-submitted_at",)

    def get_queryset(self):
        queryset = Application.objects.select_related("grant", "organization").prefetch_related(
            "attachments",
            "expert_assignments__expert",
        )
        status_value = self.request.query_params.get("status")
        if status_value:
            if status_value not in Application.Status.values:
                raise ValidationError({"status": "Неизвестный статус заявки."})
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=True, methods=("post",), url_path="assign-expert")
    @extend_schema(
        request=AssignmentCreateSerializer,
        responses={status.HTTP_201_CREATED: ExpertAssignmentSerializer},
    )
    def assign_expert(self, request, pk=None):
        application = self.get_object()
        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = assign_expert(
            application.id,
            serializer.validated_data["expert_id"],
            request.user,
        )
        write_audit_log(
            action="expert.assigned",
            request=request,
            user=request.user,
            entity=application,
            metadata={"expert_id": str(assignment.expert_id)},
        )
        assignment = (
            ExpertAssignment.objects.select_related(
                "application",
                "application__grant",
                "application__organization",
                "expert",
                "assigned_by",
            )
            .prefetch_related("application__attachments")
            .get(pk=assignment.pk)
        )
        return Response(
            ExpertAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )


class AdministratorUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserListSerializer
    permission_classes = (IsAdministrator,)
    pagination_class = GrantPagination
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("email", "first_name", "last_name", "organization__name")
    ordering_fields = ("email", "created_at")
    ordering = ("-created_at",)

    def get_queryset(self):
        queryset = User.objects.select_related("role", "organization")
        role = self.request.query_params.get("role")
        status_value = self.request.query_params.get("status")
        if role:
            queryset = queryset.filter(role__name=role)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def _locked_user(self, pk):
        target = User.objects.select_for_update().filter(pk=pk).first()
        if target is None:
            raise NotFound("Пользователь не найден.")
        return target

    def _ensure_not_self(self, request, target, action):
        if target.pk == request.user.pk:
            raise ValidationError(
                {
                    "code": "SELF_USER_CHANGE_FORBIDDEN",
                    "detail": f"Нельзя {action} собственную учётную запись.",
                }
            )

    @action(detail=True, methods=("post",), url_path="change-role")
    def change_role(self, request, pk=None):
        serializer = UserRoleChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            target = self._locked_user(pk)
            self._ensure_not_self(request, target, "изменить роль для")
            if target.role and target.role.name == Role.Name.ADMINISTRATOR:
                raise ValidationError(
                    {
                        "code": "ADMINISTRATOR_ROLE_CHANGE_FORBIDDEN",
                        "detail": "Роль администратора нельзя изменить через этот интерфейс.",
                    }
                )
            previous_role = target.role.name if target.role else None
            next_role = serializer.validated_data["role"]
            if previous_role == next_role:
                return Response(UserListSerializer(target).data)
            target.role = Role.objects.get(name=next_role)
            target.save(update_fields=("role", "updated_at"))
            write_audit_log(
                action="user.role_changed",
                request=request,
                user=request.user,
                entity=target,
                metadata={"old_role": previous_role, "new_role": next_role},
            )
        return Response(UserListSerializer(target).data)

    def _set_blocked(self, request, pk, *, blocked):
        with transaction.atomic():
            target = self._locked_user(pk)
            self._ensure_not_self(request, target, "заблокировать" if blocked else "разблокировать")
            previous_status = target.status
            next_status = User.Status.BLOCKED if blocked else User.Status.ACTIVE
            if previous_status != next_status:
                target.status = next_status
                target.save(update_fields=("status", "updated_at"))
                write_audit_log(
                    action="user.blocked" if blocked else "user.unblocked",
                    request=request,
                    user=request.user,
                    entity=target,
                    metadata={"old_status": previous_status, "new_status": next_status},
                )
        return Response(UserListSerializer(target).data)

    @action(detail=True, methods=("post",))
    def block(self, request, pk=None):
        return self._set_blocked(request, pk, blocked=True)

    @action(detail=True, methods=("post",))
    def unblock(self, request, pk=None):
        return self._set_blocked(request, pk, blocked=False)


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = (IsActivePlatformUser,)
    pagination_class = GrantPagination

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        return Notification.objects.filter(recipient=self.request.user).select_related(
            "application", "recipient__role"
        )

    @action(detail=False, methods=("get",), url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(is_read=False).count()})

    @action(detail=True, methods=("post",))
    def read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=("is_read",))
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=("post",), url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"updated": updated})


class ExpertDashboardView(APIView):
    permission_classes = (IsExpert,)

    @extend_schema(responses=ExpertDashboardSerializer)
    def get(self, request):
        assignments = ExpertAssignment.objects.filter(expert=request.user)
        return Response(
            {
                "total": assignments.count(),
                "active": assignments.filter(status=ExpertAssignment.Status.ACTIVE).count(),
                "completed": assignments.filter(
                    status=ExpertAssignment.Status.COMPLETED
                ).count(),
            }
        )


class ExpertAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ExpertAssignment.objects.all()
    serializer_class = ExpertAssignmentSerializer
    permission_classes = (IsExpert,)
    pagination_class = GrantPagination
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = (
        "application__application_number",
        "application__project_name",
        "application__organization__name",
    )
    ordering_fields = ("assigned_at",)
    ordering = ("-assigned_at",)

    def get_queryset(self):
        queryset = (
            ExpertAssignment.objects.filter(expert=self.request.user)
            .select_related(
                "application",
                "application__grant",
                "application__organization",
                "assigned_by",
                "report",
            )
            .prefetch_related("application__attachments")
        )
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=True, methods=("patch", "put"), url_path="report")
    @extend_schema(request=ReportDraftSerializer, responses=ExpertiseReportSerializer)
    def report(self, request, pk=None):
        serializer = ReportDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = save_report_draft(
            pk,
            request.user.id,
            serializer.validated_data.get("score"),
            serializer.validated_data.get("comment", ""),
        )
        return Response(ExpertiseReportSerializer(report).data)

    @action(detail=True, methods=("post",), url_path="decision")
    @extend_schema(request=ExpertDecisionSerializer, responses=ExpertiseReportSerializer)
    def decision(self, request, pk=None):
        serializer = ExpertDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = submit_expert_decision(
            pk,
            request.user.id,
            **serializer.validated_data,
        )
        write_audit_log(
            action="expert.decision",
            request=request,
            user=request.user,
            entity=report.application,
            metadata={
                "decision": report.decision,
                "score": report.score,
                "assignment_id": str(report.assignment_id),
            },
        )
        return Response(ExpertiseReportSerializer(report).data)
