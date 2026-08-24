from core.models import AuditLog


def get_request_ip(request):
    return request.META.get("REMOTE_ADDR") if request else None


def write_audit_log(
    *,
    action,
    request=None,
    user=None,
    entity=None,
    entity_type="",
    metadata=None,
):
    if entity is not None:
        entity_type = entity._meta.model_name
        entity_id = entity.pk
    else:
        entity_id = None
    return AuditLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=get_request_ip(request),
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:1000] if request else ""),
        metadata=metadata or {},
    )
