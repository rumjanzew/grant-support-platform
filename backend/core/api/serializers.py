from django.utils import timezone
from rest_framework import serializers

from core.models import Application, Attachment, Grant, Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "inn",
            "kpp",
            "ogrn",
            "organization_type",
            "registration_date",
            "status",
            "city",
            "street",
            "house",
            "postal_code",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at")

    def validate_inn(self, value):
        if not value.isdigit() or len(value) not in {10, 12}:
            raise serializers.ValidationError("ИНН должен содержать 10 или 12 цифр.")
        return value

    def validate_kpp(self, value):
        if value and (not value.isdigit() or len(value) != 9):
            raise serializers.ValidationError("КПП должен содержать 9 цифр.")
        return value

    def validate_ogrn(self, value):
        if not value.isdigit() or len(value) not in {13, 15}:
            raise serializers.ValidationError("ОГРН должен содержать 13 или 15 цифр.")
        return value

    def validate_registration_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError(
                "Дата регистрации не может быть в будущем."
            )
        return value


class GrantSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Grant
        fields = (
            "id",
            "code",
            "title",
            "description",
            "category",
            "start_date",
            "end_date",
            "max_amount",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        max_amount = attrs.get(
            "max_amount",
            getattr(self.instance, "max_amount", None),
        )

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "Дата окончания не может быть раньше даты начала."}
            )
        if max_amount is not None and max_amount <= 0:
            raise serializers.ValidationError(
                {"max_amount": "Максимальная сумма должна быть больше нуля."}
            )
        return attrs


class ApplicationSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "application_number",
            "organization",
            "grant",
            "project_name",
            "description",
            "requested_amount",
            "status",
            "version",
            "created_at",
            "updated_at",
            "submitted_at",
            "review_deadline",
        )
        read_only_fields = (
            "id",
            "application_number",
            "organization",
            "status",
            "version",
            "created_at",
            "updated_at",
            "submitted_at",
            "review_deadline",
        )

    def validate(self, attrs):
        grant = attrs.get("grant", getattr(self.instance, "grant", None))
        requested_amount = attrs.get(
            "requested_amount",
            getattr(self.instance, "requested_amount", None),
        )

        if self.instance is None or "grant" in attrs:
            today = timezone.localdate()
            if grant.status != Grant.Status.OPEN:
                raise serializers.ValidationError(
                    {"grant": "Подать заявку можно только на открытый грант."}
                )
            if not grant.start_date <= today <= grant.end_date:
                raise serializers.ValidationError(
                    {"grant": "Срок подачи заявок на этот грант не активен."}
                )

        if requested_amount is not None and requested_amount <= 0:
            raise serializers.ValidationError(
                {"requested_amount": "Запрашиваемая сумма должна быть больше нуля."}
            )
        if grant and requested_amount is not None and requested_amount > grant.max_amount:
            raise serializers.ValidationError(
                {
                    "requested_amount": (
                        "Запрашиваемая сумма превышает максимальную сумму гранта."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        return Application.objects.create(**validated_data)


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = (
            "id",
            "application",
            "original_name",
            "stored_name",
            "storage_path",
            "mime_type",
            "size_bytes",
            "sha256",
            "uploaded_by",
            "uploaded_at",
        )
        read_only_fields = fields


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(write_only=True)
