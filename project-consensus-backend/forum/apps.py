from django.apps import AppConfig


class ForumConfig(AppConfig):
    """App config for the forum app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "forum"

    def ready(self):
        """Register models for audit logging."""
        from auditlog.registry import auditlog
        from .models import ForumPost, ForumPostComment
        auditlog.register(ForumPost)
        auditlog.register(ForumPostComment)
