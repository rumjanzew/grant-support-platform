import uuid

from django.contrib.auth.models import AbstractUser
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
    application_number = models.CharField(max_length=32, unique=True)
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
        return self.application_number
