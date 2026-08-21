"""Service-level API views."""

from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health_check(request):
    """Return a minimal response confirming that the API is running."""
    return Response({"status": "ok"})
