from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from core.models import (
    Application,
    Attachment,
    ExpertAssignment,
    ExpertiseReport,
    User,
)


class UserListSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="role.name", read_only=True)
    organization_name = serializers.CharField(
        source="organization.name", read_only=True, allow_null=True
    )

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
            "organization_name",
            "created_at",
        )
        read_only_fields = fields


class AssignmentSummarySerializer(serializers.ModelSerializer):
    expert_name = serializers.SerializerMethodField()
    expert_email = serializers.EmailField(source="expert.email", read_only=True)

    class Meta:
        model = ExpertAssignment
        fields = ("id", "expert", "expert_name", "expert_email", "assigned_at", "status")
        read_only_fields = fields

    def get_expert_name(self, assignment) -> str:
        return assignment.expert.get_full_name().strip() or assignment.expert.email


class AdminApplicationSerializer(serializers.ModelSerializer):
    grant_title = serializers.CharField(source="grant.title", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    assignment = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = (
            "id",
            "application_number",
            "organization",
            "organization_name",
            "grant",
            "grant_title",
            "project_name",
            "description",
            "requested_amount",
            "status",
            "version",
            "created_at",
            "updated_at",
            "submitted_at",
            "assignment",
        )
        read_only_fields = fields

    @extend_schema_field(AssignmentSummarySerializer(allow_null=True))
    def get_assignment(self, application):
        assignments = list(application.expert_assignments.all())
        active = next(
            (
                assignment
                for assignment in assignments
                if assignment.status == ExpertAssignment.Status.ACTIVE
            ),
            None,
        )
        assignment = active or (assignments[0] if assignments else None)
        return AssignmentSummarySerializer(assignment).data if assignment else None


class AssignmentCreateSerializer(serializers.Serializer):
    expert_id = serializers.UUIDField()


class AttachmentReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ("id", "original_name", "mime_type", "size_bytes", "uploaded_at")
        read_only_fields = fields


class ReviewApplicationSerializer(serializers.ModelSerializer):
    grant_title = serializers.CharField(source="grant.title", read_only=True)
    grant_code = serializers.CharField(source="grant.code", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    organization_inn = serializers.CharField(source="organization.inn", read_only=True)
    attachments = AttachmentReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "application_number",
            "project_name",
            "description",
            "requested_amount",
            "status",
            "version",
            "submitted_at",
            "grant",
            "grant_title",
            "grant_code",
            "organization",
            "organization_name",
            "organization_inn",
            "attachments",
        )
        read_only_fields = fields


class ExpertiseReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpertiseReport
        fields = (
            "id",
            "score",
            "comment",
            "decision",
            "draft",
            "created_at",
            "updated_at",
            "submitted_at",
        )
        read_only_fields = fields


class ExpertAssignmentSerializer(serializers.ModelSerializer):
    application = ReviewApplicationSerializer(read_only=True)
    report = serializers.SerializerMethodField()
    assigned_by_email = serializers.EmailField(source="assigned_by.email", read_only=True)

    class Meta:
        model = ExpertAssignment
        fields = (
            "id",
            "application",
            "assigned_by",
            "assigned_by_email",
            "assigned_at",
            "status",
            "report",
        )
        read_only_fields = fields

    @extend_schema_field(ExpertiseReportSerializer(allow_null=True))
    def get_report(self, assignment):
        try:
            report = assignment.report
        except ExpertiseReport.DoesNotExist:
            return None
        return ExpertiseReportSerializer(report).data


class ReportDraftSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=0, max_value=100, allow_null=True)
    comment = serializers.CharField(allow_blank=True, required=False, default="")


class ExpertDecisionSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=0, max_value=100)
    comment = serializers.CharField(allow_blank=False, trim_whitespace=True)
    decision = serializers.ChoiceField(choices=ExpertiseReport.Decision.choices)


class DailyCountSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class StatusCountSerializer(serializers.Serializer):
    status = serializers.CharField()
    count = serializers.IntegerField()


class AdministratorDashboardSerializer(serializers.Serializer):
    grants = serializers.IntegerField()
    applications = serializers.IntegerField()
    awaiting_assignment = serializers.IntegerField()
    under_review = serializers.IntegerField()
    users = serializers.IntegerField()
    experts = serializers.IntegerField()
    applications_by_status = StatusCountSerializer(many=True)
    user_registrations_by_day = DailyCountSerializer(many=True)
    applications_by_day = DailyCountSerializer(many=True)


class ExpertDashboardSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    completed = serializers.IntegerField()
