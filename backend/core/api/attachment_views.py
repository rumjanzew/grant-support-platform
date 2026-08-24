from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from core.api.permissions import IsApplicant
from core.api.serializers import AttachmentSerializer, AttachmentUploadSerializer
from core.models import Application
from core.services.attachments import delete_attachment, upload_attachment


class ApplicationAttachmentListView(APIView):
    permission_classes = (IsApplicant,)
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
    permission_classes = (IsApplicant,)

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
