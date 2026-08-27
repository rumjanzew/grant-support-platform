from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from core.models import (
    Application,
    Attachment,
    AuditLog,
    ExpertAssignment,
    ExpertiseReport,
    Grant,
    Notification,
    Organization,
    Role,
    User,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    ordering = ("email",)
    list_display = ("email", "full_name", "role", "status", "organization", "is_staff")
    list_filter = ("role", "status", "is_staff", "is_active")
    search_fields = ("email", "first_name", "last_name", "phone")
    readonly_fields = ("created_at", "updated_at", "last_login")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("ФИО и контакты", {"fields": ("last_name", "first_name", "middle_name", "phone")}),
        ("Платформа", {"fields": ("role", "organization", "status", "consent_pd_agreed_at")}),
        ("Безопасность", {"fields": ("failed_login_attempts", "locked_until", "password_changed_at", "last_login")}),
        ("Права Django", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "role", "status", "is_staff"),
            },
        ),
    )

    @admin.display(description="ФИО")
    def full_name(self, user):
        return user.get_full_name().strip() or "—"


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("created_at",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "inn", "organization_type", "city", "status", "updated_at")
    list_filter = ("status", "organization_type", "city")
    search_fields = ("name", "inn", "ogrn")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Grant)
class GrantAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "category", "status", "start_date", "end_date", "created_by")
    list_filter = ("status", "category", "start_date", "end_date")
    search_fields = ("code", "title", "description")
    readonly_fields = ("created_at", "updated_at")
    autocomplete_fields = ("created_by",)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("application_number", "project_name", "organization", "grant", "status", "submitted_at")
    list_filter = ("status", "grant", "submitted_at")
    search_fields = ("application_number", "project_name", "organization__name")
    readonly_fields = (
        "application_number",
        "status",
        "version",
        "submitted_at",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = ("organization", "grant")


class ReadOnlyWorkflowAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Attachment)
class AttachmentAdmin(ReadOnlyWorkflowAdmin):
    list_display = ("original_name", "application", "mime_type", "size_bytes", "uploaded_by", "uploaded_at")
    search_fields = ("original_name", "application__application_number")
    list_filter = ("mime_type", "uploaded_at")


@admin.register(ExpertAssignment)
class ExpertAssignmentAdmin(ReadOnlyWorkflowAdmin):
    list_display = ("application", "expert", "assigned_by", "status", "assigned_at")
    search_fields = ("application__application_number", "expert__email")
    list_filter = ("status", "assigned_at")


@admin.register(ExpertiseReport)
class ExpertiseReportAdmin(ReadOnlyWorkflowAdmin):
    list_display = ("application", "expert", "score", "decision", "draft", "submitted_at")
    search_fields = ("application__application_number", "expert__email", "comment")
    list_filter = ("decision", "draft", "submitted_at")


@admin.register(Notification)
class NotificationAdmin(ReadOnlyWorkflowAdmin):
    list_display = ("created_at", "recipient", "type", "title", "is_read", "application")
    search_fields = ("recipient__email", "title", "message", "application__application_number")
    list_filter = ("type", "is_read", "created_at")
    date_hierarchy = "created_at"


@admin.register(AuditLog)
class AuditLogAdmin(ReadOnlyWorkflowAdmin):
    list_display = ("created_at", "action", "user", "entity_type", "entity_id", "ip_address")
    search_fields = ("action", "user__email", "entity_type", "entity_id", "user_agent")
    list_filter = ("action", "entity_type", "created_at")
    date_hierarchy = "created_at"
