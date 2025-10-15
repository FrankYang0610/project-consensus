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

    # Also include storage custom_domain (e.g., image.polyu.life) when configured
    try:
        storages = getattr(settings, "STORAGES", {}) or {}
        default_storage = storages.get("default", {}) or {}
        options = default_storage.get("OPTIONS", {}) or {}
        custom_domain = options.get("custom_domain")
        if custom_domain and isinstance(custom_domain, str):
            parsed = urlparse(custom_domain if custom_domain.startswith("http") else f"https://{custom_domain}")
            host = parsed.hostname
            if host:
                hosts.add(host.strip().lower())
    except Exception:
        pass
    if not hosts:
        hosts = set(DEFAULT_ALLOWED_IMAGE_HOSTS)
    return hosts


def _normalize_host(host: str | None) -> str | None:
    if not host:
        return None
    try:
        return host.strip().lower().rstrip('.')
    except Exception:
        return None


def is_host_in_allowed(host: str | None, allowed_hosts: Set[str]) -> bool:
    h = _normalize_host(host)
    if not h:
        return False
    # Exact match first
    if h in allowed_hosts:
        return True
    # wildcard patterns: entries starting with '*.' allow any subdomain
    for entry in allowed_hosts:
        e = _normalize_host(entry)
        if not e:
            continue
        if e.startswith('*.'):
            base = e[2:]
            if h.endswith('.' + base) and h != base:
                return True
    return False


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
    hostname = _normalize_host(parsed.hostname)
    allowed_hosts = get_allowed_image_hosts()
    if not is_host_in_allowed(hostname, allowed_hosts):
        raise serializers.ValidationError("URL host is not allowed.")

    return v
