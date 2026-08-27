import uuid

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from core.managers import UserManager


class Role(models.Model):
    class Name(models.TextChoices):
        APPLICANT = "Applicant", "Заявитель"
        EXPERT = "Expert", "Эксперт"
        ADMINISTRATOR = "Administrator", "Администратор"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=32, choices=Name.choices, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "roles"
        ordering = ("name",)

    def __str__(self):
        return self.name


class Organization(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Активна"
        BLOCKED = "BLOCKED", "Заблокирована"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    inn = models.CharField(max_length=12)
    kpp = models.CharField(max_length=9, blank=True)
    ogrn = models.CharField(max_length=15)
    organization_type = models.CharField(max_length=64)
    registration_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    city = models.CharField(max_length=128, blank=True)
    street = models.CharField(max_length=255, blank=True)
    house = models.CharField(max_length=32, blank=True)
    postal_code = models.CharField(max_length=12, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"
        ordering = ("name",)

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Активен"
        BLOCKED = "BLOCKED", "Заблокирован"

    username = None
    date_joined = None
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    middle_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    last_login = models.DateTimeField(
        "last login",
        null=True,
        blank=True,
        db_column="last_login_at",
    )
    failed_login_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    consent_pd_agreed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        ordering = ("email",)

    def __str__(self):
        return self.email


class Grant(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Черновик"
        PUBLISHED = "PUBLISHED", "Опубликован"
        OPEN = "OPEN", "Открыт"
        CLOSED = "CLOSED", "Закрыт"
        ARCHIVED = "ARCHIVED", "В архиве"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=128)
    start_date = models.DateField()
    end_date = models.DateField()
    max_amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="created_grants",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "grants"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status",)),
            models.Index(fields=("start_date",)),
            models.Index(fields=("end_date",)),
            models.Index(fields=("created_at",)),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="grant_end_date_gte_start_date",
            ),
            models.CheckConstraint(
                condition=Q(max_amount__gte=0),
                name="grant_max_amount_non_negative",
            ),
        ]

    def __str__(self):
        return self.title


class Application(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Черновик"
        SUBMITTED = "SUBMITTED", "Подана"
        UNDER_REVIEW = "UNDER_REVIEW", "На рассмотрении"
        REVISION_REQUIRED = "REVISION_REQUIRED", "Требуется доработка"
        REVISION_SUBMITTED = "REVISION_SUBMITTED", "Доработка подана"
        APPROVED = "APPROVED", "Одобрена"
        REJECTED = "REJECTED", "Отклонена"
        CANCELLED = "CANCELLED", "Отменена"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_number = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="applications",
    )
    grant = models.ForeignKey(
        Grant,
        on_delete=models.PROTECT,
        related_name="applications",
    )
    project_name = models.CharField(max_length=255)
    description = models.TextField()
    requested_amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    review_deadline = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "applications"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status",)),
            models.Index(fields=("submitted_at",)),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(requested_amount__gte=0),
                name="application_requested_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(version__gte=1),
                name="application_version_gte_one",
            ),
        ]

    def __str__(self):
        return self.application_number or str(self.id)


class Attachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    original_name = models.CharField(max_length=255)
    stored_name = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=500)
    mime_type = models.CharField(max_length=128)
    size_bytes = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="uploaded_attachments",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "attachments"
        ordering = ("uploaded_at",)
        indexes = [
            models.Index(fields=("application", "uploaded_at")),
        ]

    def __str__(self):
        return self.original_name


class ExpertAssignment(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Активно"
        COMPLETED = "COMPLETED", "Завершено"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        Application,
        on_delete=models.PROTECT,
        related_name="expert_assignments",
    )
    expert = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="expert_assignments",
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="created_expert_assignments",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "expert_assignments"
        ordering = ("-assigned_at",)
        indexes = [models.Index(fields=("expert", "status"))]
        constraints = [
            models.UniqueConstraint(
                fields=("application",),
                condition=Q(status="ACTIVE"),
                name="one_active_expert_assignment_per_application",
            )
        ]

    def __str__(self):
        return f"{self.application} — {self.expert}"


class ExpertiseReport(models.Model):
    class Decision(models.TextChoices):
        APPROVED = "APPROVED", "Одобрить"
        REJECTED = "REJECTED", "Отклонить"
        REVISION_REQUIRED = "REVISION_REQUIRED", "Вернуть на доработку"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.OneToOneField(
        ExpertAssignment,
        on_delete=models.PROTECT,
        related_name="report",
    )
    application = models.ForeignKey(
        Application,
        on_delete=models.PROTECT,
        related_name="expertise_reports",
    )
    expert = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="expertise_reports",
    )
    score = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=(MinValueValidator(0), MaxValueValidator(100)),
    )
    comment = models.TextField(blank=True)
    decision = models.CharField(
        max_length=24,
        choices=Decision.choices,
        blank=True,
    )
    draft = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "expertise_reports"
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(score__isnull=True) | Q(score__gte=0, score__lte=100),
                name="expertise_score_between_0_and_100",
            )
        ]

    def __str__(self):
        return f"Заключение по {self.application}"


class Notification(models.Model):
    class Type(models.TextChoices):
        APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED", "Новая заявка"
        EXPERT_ASSIGNED = "EXPERT_ASSIGNED", "Назначение эксперта"
        REVISION_REQUIRED = "REVISION_REQUIRED", "Требуется доработка"
        APPLICATION_APPROVED = "APPLICATION_APPROVED", "Заявка одобрена"
        APPLICATION_REJECTED = "APPLICATION_REJECTED", "Заявка отклонена"
        REVISION_SUBMITTED = "REVISION_SUBMITTED", "Доработка отправлена"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=32, choices=Type.choices, db_index=True)
    title = models.CharField(max_length=160)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "notifications"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("recipient", "is_read", "created_at"))]

    def __str__(self):
        return f"{self.title} — {self.recipient}"


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=64, db_index=True)
    entity_type = models.CharField(max_length=64, db_index=True)
    entity_id = models.UUIDField(null=True, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("user", "created_at")),
            models.Index(fields=("entity_type", "entity_id")),
        ]

    def __str__(self):
        return f"{self.action} · {self.created_at:%Y-%m-%d %H:%M:%S}"
