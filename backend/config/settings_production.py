"""Production settings loaded by the Docker deployment stack."""

import os

from django.core.exceptions import ImproperlyConfigured

from config.settings import *  # noqa: F403


DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
if DEBUG:
    raise ImproperlyConfigured("DJANGO_DEBUG must be False in production.")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY is required in production.")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "DJANGO_ALLOWED_HOSTS must contain explicit production hosts."
    )

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
