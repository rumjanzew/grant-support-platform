import logging
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.core.mail import EmailMessage
from django.db import transaction
from django.utils import timezone

from core.models import User


logger = logging.getLogger(__name__)
TOKEN_SALT = "core.email-verification.v1"


class EmailVerificationError(Exception):
    def __init__(self, code, detail):
        self.code = code
        self.detail = detail
        super().__init__(detail)


def send_email_safely(message, *, purpose):
    """Send synchronously without turning a temporary SMTP failure into API 500."""
    try:
        return message.send(fail_silently=False) == 1
    except Exception as error:  # SMTP backends expose several provider-specific errors.
        logger.warning("Email delivery failed for %s (%s).", purpose, type(error).__name__)
        return False


def make_email_verification_token(user):
    return signing.dumps(
        {"uid": str(user.pk), "nonce": str(user.email_verification_nonce)},
        salt=TOKEN_SALT,
        compress=True,
    )


def send_verification_email(user):
    if user.email_verified_at is not None or user.deleted_at is not None:
        return False
    token = make_email_verification_token(user)
    verification_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/email-verification?"
        f"{urlencode({'token': token})}"
    )
    message = EmailMessage(
        subject="Подтверждение email в GrantSupport",
        body=(
            "Подтвердите email, перейдя по ссылке:\n"
            f"{verification_url}\n\n"
            "Если вы не регистрировались в GrantSupport, проигнорируйте это письмо."
        ),
        to=[user.email],
    )
    return send_email_safely(message, purpose="email verification")


def confirm_email(token):
    try:
        payload = signing.loads(
            token,
            salt=TOKEN_SALT,
            max_age=settings.EMAIL_VERIFICATION_TIMEOUT,
        )
        user_id = payload["uid"]
        nonce = payload["nonce"]
    except signing.SignatureExpired as error:
        raise EmailVerificationError(
            "EMAIL_VERIFICATION_EXPIRED",
            "Ссылка подтверждения устарела. Запросите новое письмо.",
        ) from error
    except (signing.BadSignature, KeyError, TypeError) as error:
        raise EmailVerificationError(
            "INVALID_EMAIL_VERIFICATION_TOKEN",
            "Ссылка подтверждения недействительна.",
        ) from error

    with transaction.atomic():
        user = User.objects.select_for_update().filter(pk=user_id).first()
        if user is None or user.deleted_at is not None or not user.is_active:
            raise EmailVerificationError(
                "INVALID_EMAIL_VERIFICATION_TOKEN",
                "Ссылка подтверждения недействительна.",
            )
        if user.email_verified_at is not None:
            return user, False
        if str(user.email_verification_nonce) != nonce:
            raise EmailVerificationError(
                "INVALID_EMAIL_VERIFICATION_TOKEN",
                "Ссылка подтверждения недействительна.",
            )
        user.email_verified_at = timezone.now()
        user.save(update_fields=("email_verified_at", "updated_at"))
        return user, True
