from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.models import Application, Grant, Organization
from core.services.notifications import (
    notify_application_submitted,
    notify_revision_submitted,
)


def workflow_error(code, detail):
    raise ValidationError({"code": code, "detail": detail})


def _next_application_number():
    year = timezone.localdate().year
    while True:
        with connection.cursor() as cursor:
            cursor.execute("SELECT nextval('application_number_seq')")
            sequence_value = cursor.fetchone()[0]

        if sequence_value > 99999:
            workflow_error(
                "APPLICATION_NUMBER_LIMIT_REACHED",
                "Исчерпан диапазон номеров заявок.",
            )

        number = f"GR-{year}-{sequence_value:05d}"
        if not Application.objects.filter(application_number=number).exists():
            return number


def submit_application(application_id, organization_id):
    with transaction.atomic():
        application = (
            Application.objects.select_for_update()
            .select_related("grant", "organization")
            .get(pk=application_id, organization_id=organization_id)
        )

        transitions = {
            Application.Status.DRAFT: Application.Status.SUBMITTED,
            Application.Status.REVISION_REQUIRED: Application.Status.REVISION_SUBMITTED,
        }
        target_status = transitions.get(application.status)
        if target_status is None:
            workflow_error(
                "INVALID_APPLICATION_STATUS",
                "Заявку в текущем статусе нельзя отправить.",
            )

        if application.organization.status != Organization.Status.ACTIVE:
            workflow_error(
                "ORGANIZATION_BLOCKED",
                "Заблокированная организация не может отправлять заявки.",
            )

        grant = application.grant
        today = timezone.localdate()
        if grant.status != Grant.Status.OPEN:
            workflow_error("GRANT_NOT_OPEN", "Грант не принимает заявки.")
        if today < grant.start_date:
            workflow_error(
                "APPLICATION_PERIOD_NOT_STARTED",
                "Период подачи заявок ещё не начался.",
            )
        if today > grant.end_date:
            workflow_error(
                "APPLICATION_PERIOD_ENDED",
                "Период подачи заявок завершён.",
            )

        missing_fields = [
            field
            for field, value in (
                ("project_name", application.project_name),
                ("description", application.description),
                ("requested_amount", application.requested_amount),
            )
            if value is None or (isinstance(value, str) and not value.strip())
        ]
        if missing_fields:
            raise ValidationError(
                {
                    "code": "REQUIRED_FIELDS_MISSING",
                    "detail": "Заполнены не все обязательные поля заявки.",
                    "fields": missing_fields,
                }
            )
        if application.requested_amount <= 0:
            workflow_error(
                "INVALID_REQUESTED_AMOUNT",
                "Запрашиваемая сумма должна быть больше нуля.",
            )
        if application.requested_amount > grant.max_amount:
            workflow_error(
                "REQUESTED_AMOUNT_EXCEEDED",
                "Запрашиваемая сумма превышает максимальную сумму гранта.",
            )

        update_fields = [
            "application_number",
            "status",
            "submitted_at",
            "updated_at",
        ]
        if application.application_number is None:
            application.application_number = _next_application_number()
        previous_status = application.status
        if previous_status == Application.Status.REVISION_REQUIRED:
            application.version += 1
            update_fields.append("version")
        application.status = target_status
        application.submitted_at = timezone.now()
        application.save(update_fields=update_fields)
        if previous_status == Application.Status.DRAFT:
            notify_application_submitted(application)
        else:
            notify_revision_submitted(application)
        return application
