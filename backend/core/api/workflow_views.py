from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api.pagination import GrantPagination
from core.api.permissions import IsAdministrator, IsExpert
from core.api.workflow_serializers import (
    AdminApplicationSerializer,
    AssignmentCreateSerializer,
    ExpertAssignmentSerializer,
    ExpertDecisionSerializer,
    ExpertiseReportSerializer,
    ReportDraftSerializer,
    UserListSerializer,
)
from core.models import Application, ExpertAssignment, Grant, Role, User
from core.services.expertise_workflow import (
    assign_expert,
    save_report_draft,
    submit_expert_decision,
)


class AdministratorDashboardView(APIView):
    permission_classes = (IsAdministrator,)

    def get(self, request):
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
            "expert_assignments__expert"
        )
        status_value = self.request.query_params.get("status")
        if status_value:
            if status_value not in Application.Status.values:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"status": "Неизвестный статус заявки."})
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=True, methods=("post",), url_path="assign-expert")
    def assign_expert(self, request, pk=None):
        application = self.get_object()
        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = assign_expert(
            application.id,
            serializer.validated_data["expert_id"],
            request.user,
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


class ExpertDashboardView(APIView):
    permission_classes = (IsExpert,)

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
    def decision(self, request, pk=None):
        serializer = ExpertDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = submit_expert_decision(
            pk,
            request.user.id,
            **serializer.validated_data,
        )
        return Response(ExpertiseReportSerializer(report).data)
