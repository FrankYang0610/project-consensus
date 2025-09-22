from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """App config for the accounts app.

    - default_auto_field: default auto primary key type
    - name: dotted path to the app
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
