from core.models import Application, ExpertAssignment, Notification, Role, User


def _create_for_users(users, *, notification_type, title, message, application):
    Notification.objects.bulk_create(
        [
            Notification(
                recipient=user,
                type=notification_type,
                title=title,
                message=message,
                application=application,
            )
            for user in users
        ]
    )


def notify_application_submitted(application):
    administrators = User.objects.filter(
        role__name=Role.Name.ADMINISTRATOR,
        status=User.Status.ACTIVE,
        is_active=True,
    )
    _create_for_users(
        administrators,
        notification_type=Notification.Type.APPLICATION_SUBMITTED,
        title="Новая заявка",
        message=f"Подана новая заявка {application.application_number}.",
        application=application,
    )


def notify_expert_assigned(assignment):
    Notification.objects.create(
        recipient=assignment.expert,
        type=Notification.Type.EXPERT_ASSIGNED,
        title="Новая назначенная заявка",
        message=f"Вам назначена заявка {assignment.application.application_number}.",
        application=assignment.application,
    )


def notify_applicants_about_decision(application, decision):
    details = {
        Notification.Type.REVISION_REQUIRED: (
            "Требуется доработка",
            f"Заявка {application.application_number} возвращена на доработку.",
        ),
        Notification.Type.APPLICATION_APPROVED: (
            "Заявка одобрена",
            f"По заявке {application.application_number} принято положительное решение.",
        ),
        Notification.Type.APPLICATION_REJECTED: (
            "Заявка отклонена",
            f"По заявке {application.application_number} принято решение об отклонении.",
        ),
    }
    title, message = details[decision]
    applicants = User.objects.filter(
        organization=application.organization,
        role__name=Role.Name.APPLICANT,
        status=User.Status.ACTIVE,
        is_active=True,
    )
    _create_for_users(
        applicants,
        notification_type=decision,
        title=title,
        message=message,
        application=application,
    )


def notify_revision_submitted(application):
    assignment = (
        ExpertAssignment.objects.filter(application=application)
        .select_related("expert")
        .order_by("-assigned_at")
        .first()
    )
    if (
        assignment is None
        or not assignment.expert.is_active
        or assignment.expert.status != User.Status.ACTIVE
    ):
        return
    Notification.objects.create(
        recipient=assignment.expert,
        type=Notification.Type.REVISION_SUBMITTED,
        title="Заявка повторно отправлена",
        message=(
            f"Заявитель повторно отправил заявку "
            f"{application.application_number} после доработки."
        ),
        application=application,
    )
