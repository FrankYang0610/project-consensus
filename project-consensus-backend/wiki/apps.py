from django.apps import AppConfig


class WikiConfig(AppConfig):
    """
    Configuration for the wiki application.
    Provides a knowledge base / documentation system with Markdown support.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'wiki'
    verbose_name = 'Wiki'

