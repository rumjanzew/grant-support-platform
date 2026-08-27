import hashlib
import uuid
from pathlib import Path

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Sum

from core.models import Application, Attachment
from core.services.application_workflow import workflow_error


MAX_FILES_PER_APPLICATION = 10
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_TOTAL_SIZE = 50 * 1024 * 1024
ALLOWED_FILE_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
    },
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
    },
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
}
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


def _validate_file_type(original_name, mime_type, header):
    extension = Path(original_name).suffix.lower()
    allowed_mime_types = ALLOWED_FILE_TYPES.get(extension)
    if not allowed_mime_types or mime_type.lower() not in allowed_mime_types:
        workflow_error("FILE_FORMAT_NOT_SUPPORTED", "Формат файла не поддерживается.")

    signatures = {
        ".pdf": (b"%PDF-",),
        ".jpg": (b"\xff\xd8\xff",),
        ".jpeg": (b"\xff\xd8\xff",),
        ".png": (b"\x89PNG\r\n\x1a\n",),
        ".zip": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
        ".docx": (b"PK\x03\x04",),
        ".xlsx": (b"PK\x03\x04",),
        ".doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
        ".xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    }
    if not any(header.startswith(signature) for signature in signatures[extension]):
        workflow_error(
            "FILE_CONTENT_MISMATCH",
            "Содержимое файла не соответствует заявленному формату.",
        )


def upload_attachment(application_id, organization_id, user, uploaded_file):
    original_name = Path(str(uploaded_file.name).replace("\\", "/")).name
    if (
        not original_name
        or len(original_name) > 255
        or any(ord(character) < 32 for character in original_name)
    ):
        workflow_error("INVALID_FILE_NAME", "Некорректное имя файла.")
    mime_type = uploaded_file.content_type or "application/octet-stream"
    if len(mime_type) > 128:
        workflow_error("INVALID_MIME_TYPE", "Некорректный MIME-тип файла.")

    digest = hashlib.sha256()
    header = bytearray()
    size_bytes = 0
    for chunk in uploaded_file.chunks():
        size_bytes += len(chunk)
        if size_bytes > MAX_FILE_SIZE:
            workflow_error("FILE_TOO_LARGE", "Размер файла превышает 10 МБ.")
        digest.update(chunk)
        if len(header) < 16:
            header.extend(chunk[: 16 - len(header)])
    if size_bytes == 0:
        workflow_error("EMPTY_FILE", "Нельзя загрузить пустой файл.")
    _validate_file_type(original_name, mime_type, bytes(header))
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
                    "К заявке можно прикрепить не более 10 файлов.",
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
