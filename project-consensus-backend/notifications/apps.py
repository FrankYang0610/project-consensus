from __future__ import annotations

from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"

    def ready(self):  # pragma: no cover
        # Import signals to register post_save hooks
        try:
            from . import signals  # noqa: F401
        except Exception:
            pass
