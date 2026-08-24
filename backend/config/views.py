"""Service-level API views."""

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import serializers
from drf_spectacular.utils import extend_schema, inline_serializer


@extend_schema(
    responses=inline_serializer(
        name="HealthCheck",
        fields={"status": serializers.CharField()},
    )
)
@api_view(["GET"])
def health_check(request):
    """Return a minimal response confirming that the API is running."""
    return Response({"status": "ok"})
