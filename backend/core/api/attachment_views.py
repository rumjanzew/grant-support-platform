from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from core.api.permissions import IsActivePlatformUser, IsVerifiedApplicant, is_administrator
from core.api.serializers import AttachmentSerializer, AttachmentUploadSerializer
from core.models import Application, Attachment, ExpertAssignment, Role
from core.services.attachments import delete_attachment, upload_attachment


class ApplicationAttachmentListView(APIView):
    permission_classes = (IsVerifiedApplicant,)
    parser_classes = (MultiPartParser, FormParser)

    def get_application(self, request, application_id):
        return get_object_or_404(
            Application.objects.all(),
            pk=application_id,
            organization_id=request.user.organization_id,
        )

    @extend_schema(responses=AttachmentSerializer(many=True))
    def get(self, request, application_id):
        application = self.get_application(request, application_id)
        attachments = application.attachments.select_related("uploaded_by")
        return Response(AttachmentSerializer(attachments, many=True).data)

    @extend_schema(
        request=AttachmentUploadSerializer,
        responses={status.HTTP_201_CREATED: AttachmentSerializer},
    )
    def post(self, request, application_id):
        application = self.get_application(request, application_id)
        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment = upload_attachment(
            application.id,
            request.user.organization_id,
            request.user,
            serializer.validated_data["file"],
        )
        return Response(
            AttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class ApplicationAttachmentDetailView(APIView):
    permission_classes = (IsVerifiedApplicant,)

    @extend_schema(responses={status.HTTP_204_NO_CONTENT: None})
    def delete(self, request, application_id, attachment_id):
        get_object_or_404(
            Application.objects.all(),
            pk=application_id,
            organization_id=request.user.organization_id,
        )
        delete_attachment(
            application_id,
            attachment_id,
            request.user.organization_id,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplicationAttachmentDownloadView(APIView):
    permission_classes = (IsActivePlatformUser,)

    def _can_download(self, user, application):
        if is_administrator(user):
            return True
        if user.role_id and user.role.name == Role.Name.APPLICANT:
            return bool(
                user.email_verified_at is not None
                and user.organization_id
                and user.organization_id == application.organization_id
            )
        if user.role_id and user.role.name == Role.Name.EXPERT:
            return ExpertAssignment.objects.filter(
                application=application,
                expert=user,
            ).exists()
        return False

    @extend_schema(responses={(status.HTTP_200_OK, "application/octet-stream"): bytes})
    def get(self, request, application_id, attachment_id):
        application = get_object_or_404(Application, pk=application_id)
        if not self._can_download(request.user, application):
            raise PermissionDenied("Нет доступа к документам этой заявки.")
        attachment = get_object_or_404(
            Attachment,
            pk=attachment_id,
            application=application,
        )
        if not default_storage.exists(attachment.storage_path):
            raise Http404("Файл не найден в хранилище.")
        response = FileResponse(
            default_storage.open(attachment.storage_path, "rb"),
            as_attachment=True,
            filename=attachment.original_name,
            content_type=attachment.mime_type,
        )
        response["Content-Length"] = attachment.size_bytes
        return response
