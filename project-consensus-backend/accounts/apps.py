from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """App config for the accounts app.

    - default_auto_field: default auto primary key type
    - name: dotted path to the app
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        """Register models for audit logging."""
        from auditlog.registry import auditlog
        from .models import Profile
        auditlog.register(Profile)
