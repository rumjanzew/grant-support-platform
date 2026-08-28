from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from core.models import (
    Application,
    ExpertAssignment,
    ExpertiseReport,
    Role,
    User,
)
from core.services.notifications import (
    notify_applicants_about_decision,
    notify_expert_assigned,
)


def workflow_error(code, detail):
    raise ValidationError({"code": code, "detail": detail})


def assign_expert(application_id, expert_id, administrator):
    with transaction.atomic():
        application = Application.objects.select_for_update().get(pk=application_id)
        if application.status not in {
            Application.Status.SUBMITTED,
            Application.Status.REVISION_SUBMITTED,
        }:
            workflow_error(
                "INVALID_APPLICATION_STATUS",
                "Эксперта можно назначить только на отправленную заявку.",
            )

        expert = (
            User.objects.select_related("role")
            .filter(
                pk=expert_id,
                role__name=Role.Name.EXPERT,
                status=User.Status.ACTIVE,
                is_active=True,
                deleted_at__isnull=True,
            )
            .first()
        )
        if expert is None:
            workflow_error("INVALID_EXPERT", "Выбранный пользователь не является активным экспертом.")

        assignment = ExpertAssignment.objects.create(
            application=application,
            expert=expert,
            assigned_by=administrator,
        )
        application.status = Application.Status.UNDER_REVIEW
        application.save(update_fields=("status", "updated_at"))
        notify_expert_assigned(assignment)
        return assignment


def get_expert_assignment(assignment_id, expert_id, *, for_update=False):
    queryset = ExpertAssignment.objects.select_related(
        "application",
        "application__grant",
        "application__organization",
        "expert",
        "assigned_by",
    )
    if for_update:
        queryset = queryset.select_for_update()
    assignment = queryset.filter(pk=assignment_id, expert_id=expert_id).first()
    if assignment is None:
        raise NotFound("Назначение не найдено.")
    return assignment


def save_report_draft(assignment_id, expert_id, score=None, comment=""):
    with transaction.atomic():
        assignment = get_expert_assignment(assignment_id, expert_id, for_update=True)
        if (
            assignment.status != ExpertAssignment.Status.ACTIVE
            or assignment.application.status != Application.Status.UNDER_REVIEW
        ):
            workflow_error(
                "INVALID_ASSIGNMENT_STATUS",
                "Заключение по завершённому назначению нельзя изменить.",
            )

        report, _ = ExpertiseReport.objects.update_or_create(
            assignment=assignment,
            defaults={
                "application": assignment.application,
                "expert": assignment.expert,
                "score": score,
                "comment": comment,
                "decision": "",
                "draft": True,
                "submitted_at": None,
            },
        )
        return report


def submit_expert_decision(assignment_id, expert_id, score, comment, decision):
    target_statuses = {
        ExpertiseReport.Decision.APPROVED: Application.Status.APPROVED,
        ExpertiseReport.Decision.REJECTED: Application.Status.REJECTED,
        ExpertiseReport.Decision.REVISION_REQUIRED: Application.Status.REVISION_REQUIRED,
    }
    target_status = target_statuses.get(decision)
    if target_status is None:
        workflow_error("INVALID_EXPERT_DECISION", "Указано неизвестное решение эксперта.")
    if score is None:
        workflow_error("SCORE_REQUIRED", "Для принятия решения укажите оценку.")
    if not comment or not comment.strip():
        workflow_error("COMMENT_REQUIRED", "Для принятия решения добавьте комментарий.")

    with transaction.atomic():
        assignment = get_expert_assignment(assignment_id, expert_id, for_update=True)
        application = Application.objects.select_for_update().get(
            pk=assignment.application_id
        )
        if (
            assignment.status != ExpertAssignment.Status.ACTIVE
            or application.status != Application.Status.UNDER_REVIEW
        ):
            workflow_error(
                "INVALID_ASSIGNMENT_STATUS",
                "Решение по этому назначению уже принято.",
            )

        now = timezone.now()
        report, _ = ExpertiseReport.objects.update_or_create(
            assignment=assignment,
            defaults={
                "application": application,
                "expert": assignment.expert,
                "score": score,
                "comment": comment.strip(),
                "decision": decision,
                "draft": False,
                "submitted_at": now,
            },
        )
        assignment.status = ExpertAssignment.Status.COMPLETED
        assignment.save(update_fields=("status",))
        application.status = target_status
        application.save(update_fields=("status", "updated_at"))
        notification_types = {
            ExpertiseReport.Decision.APPROVED: "APPLICATION_APPROVED",
            ExpertiseReport.Decision.REJECTED: "APPLICATION_REJECTED",
            ExpertiseReport.Decision.REVISION_REQUIRED: "REVISION_REQUIRED",
        }
        notify_applicants_about_decision(application, notification_types[decision])
        return report
