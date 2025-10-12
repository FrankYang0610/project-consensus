"""
Shared validators and helpers for URL and HTML-related security checks.
"""
from __future__ import annotations

from urllib.parse import urlparse
from typing import Iterable, Set

from django.conf import settings
from rest_framework import serializers
from django.core.validators import URLValidator


DEFAULT_ALLOWED_IMAGE_HOSTS = {"image.polyu.life"}


def get_allowed_image_hosts() -> Set[str]:
    """
    Return the set of allowed public image hosts configured for the app.

    Priority:
    1) settings.ALLOWED_IMAGE_HOSTS (explicit)
    2) Fallback to DEFAULT_ALLOWED_IMAGE_HOSTS
    """
    hosts: Set[str] = set()
    try:
        configured = getattr(settings, "ALLOWED_IMAGE_HOSTS", None)
        if configured:
            hosts.update(h.strip().lower() for h in configured if h and isinstance(h, str))
    except Exception:
        pass
    if not hosts:
        hosts = set(DEFAULT_ALLOWED_IMAGE_HOSTS)
    return hosts


def validate_https_url_in_allowed_hosts(value: str) -> str:
    """
    Validate that a URL is HTTPS and its host is in allowed image hosts.

    Raises DRF ValidationError if invalid.
    Returns the normalized, original value if valid (no rewriting performed).
    """
    if value is None:
        raise serializers.ValidationError("Invalid URL.")
    v = value.strip()
    if v == "":
        return v
    # Validate URL structure and enforce HTTPS using Django's URLValidator
    validator = URLValidator(schemes=["https"])  # Only allow https
    try:
        validator(v)
    except Exception:
        raise serializers.ValidationError("Only HTTPS URLs with a valid host are allowed.")

    # Parse to check the host allowlist
    parsed = urlparse(v)

    allowed_hosts = get_allowed_image_hosts()
    if parsed.netloc.lower() not in allowed_hosts:
        raise serializers.ValidationError("URL host is not allowed.")

    return v
