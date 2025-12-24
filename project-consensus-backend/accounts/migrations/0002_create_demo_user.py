"""
This migration creates a demo user for local development/testing so you can
log in immediately. Rolling back this migration will delete the demo user.

Account:
  Email: demo@connect.polyu.hk
  Password: Demo1234!
"""

from django.conf import settings
from django.db import migrations


DEMO_EMAIL = "demo@connect.polyu.hk"
DEMO_PASSWORD = "Demo1234!"
DEMO_NAME = "Demo User"

def _seed_demo_enabled() -> bool:
    """
    Demo data seeding is opt-in.

    Production safety: do NOT create a known-password demo account unless explicitly enabled.
    """
    return bool(getattr(settings, "SEED_DEMO_DATA", False))


def create_demo_user(apps, schema_editor):
    if not _seed_demo_enabled():
        return

    # Use swappable AUTH_USER_MODEL via apps registry
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    Profile = apps.get_model("accounts", "Profile")

    # Idempotent: create only if not exists
    user = User.objects.filter(email=DEMO_EMAIL).first()
    if user is None:
        user = User.objects.create_user(username=DEMO_EMAIL, email=DEMO_EMAIL, password=DEMO_PASSWORD)
        # Create a simple profile with default pronouns
        Profile.objects.create(
            user=user,
            nickname=DEMO_NAME,
            pronouns="not_specified",
        )

# For Database Rollback
def delete_demo_user(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)

    user = User.objects.filter(email=DEMO_EMAIL).first()
    if user is not None:
        user.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_demo_user, delete_demo_user),
    ]
