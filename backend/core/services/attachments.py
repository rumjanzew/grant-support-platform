import hashlib
import uuid
from pathlib import Path

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Sum

from core.models import Application, Attachment
from core.services.application_workflow import workflow_error


MAX_FILES_PER_APPLICATION = 5
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_TOTAL_SIZE = 50 * 1024 * 1024
EDITABLE_STATUSES = {
    Application.Status.DRAFT,
    Application.Status.REVISION_REQUIRED,
}


def _validate_editable(application):
    if application.status not in EDITABLE_STATUSES:
        workflow_error(
            "INVALID_APPLICATION_STATUS",
            "Документы нельзя изменять в текущем статусе заявки.",
        )


def upload_attachment(application_id, organization_id, user, uploaded_file):
    original_name = Path(uploaded_file.name).name
    if not original_name or len(original_name) > 255:
        workflow_error("INVALID_FILE_NAME", "Некорректное имя файла.")
    mime_type = uploaded_file.content_type or "application/octet-stream"
    if len(mime_type) > 128:
        workflow_error("INVALID_MIME_TYPE", "Некорректный MIME-тип файла.")

    digest = hashlib.sha256()
    size_bytes = 0
    for chunk in uploaded_file.chunks():
        size_bytes += len(chunk)
        if size_bytes > MAX_FILE_SIZE:
            workflow_error("FILE_TOO_LARGE", "Размер файла превышает 10 МБ.")
        digest.update(chunk)
    if size_bytes == 0:
        workflow_error("EMPTY_FILE", "Нельзя загрузить пустой файл.")
    uploaded_file.seek(0)

    saved_path = None
    try:
        with transaction.atomic():
            application = Application.objects.select_for_update().get(
                pk=application_id,
                organization_id=organization_id,
            )
            _validate_editable(application)

            attachments = application.attachments.all()
            if attachments.count() >= MAX_FILES_PER_APPLICATION:
                workflow_error(
                    "FILE_LIMIT_EXCEEDED",
                    "К заявке можно прикрепить не более 5 файлов.",
                )
            total_size = attachments.aggregate(total=Sum("size_bytes"))["total"] or 0
            if total_size + size_bytes > MAX_TOTAL_SIZE:
                workflow_error(
                    "TOTAL_FILE_SIZE_EXCEEDED",
                    "Общий размер файлов заявки превышает 50 МБ.",
                )

            suffix = Path(original_name).suffix.lower()[:16]
            stored_name = f"{uuid.uuid4().hex}{suffix}"
            requested_path = f"applications/{application.id}/{stored_name}"
            saved_path = default_storage.save(requested_path, uploaded_file)
            return Attachment.objects.create(
                application=application,
                original_name=original_name,
                stored_name=Path(saved_path).name,
                storage_path=saved_path,
                mime_type=mime_type,
                size_bytes=size_bytes,
                sha256=digest.hexdigest(),
                uploaded_by=user,
            )
    except Exception:
        if saved_path:
            default_storage.delete(saved_path)
        raise


def delete_attachment(application_id, attachment_id, organization_id):
    with transaction.atomic():
        application = Application.objects.select_for_update().get(
            pk=application_id,
            organization_id=organization_id,
        )
        _validate_editable(application)
        attachment = application.attachments.get(pk=attachment_id)
        storage_path = attachment.storage_path
        attachment.delete()
        transaction.on_commit(lambda: default_storage.delete(storage_path))
