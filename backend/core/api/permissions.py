from rest_framework.permissions import SAFE_METHODS, BasePermission

from core.models import Role, User


def user_has_role(user, role_name):
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.status == User.Status.ACTIVE
        and user.role_id
        and user.role.name == role_name
    )


def is_administrator(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.status == User.Status.ACTIVE
        and (
            user.is_superuser
            or (user.role_id and user.role.name == Role.Name.ADMINISTRATOR)
        )
    )


class IsAdministratorOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return is_administrator(request.user)


class IsApplicant(BasePermission):
    def has_permission(self, request, view):
        return user_has_role(request.user, Role.Name.APPLICANT)
