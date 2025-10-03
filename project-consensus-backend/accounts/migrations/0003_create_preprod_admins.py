from __future__ import annotations

import os
import secrets
import string
from django.db import migrations
from django.contrib.auth.hashers import make_password


def _gen_strong_password(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def create_preprod_admins(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Profile = apps.get_model("accounts", "Profile")

    admins = [
        {
            "username": os.getenv("PREPROD_ADMIN1_USERNAME", "admin1"),
            "email": os.getenv("PREPROD_ADMIN1_EMAIL", "admin1@example.com"),
            "password": os.getenv("PREPROD_ADMIN1_PASSWORD"),
            "display_name": os.getenv("PREPROD_ADMIN1_DISPLAY_NAME", "Preprod Admin 1"),
        },
        {
            "username": os.getenv("PREPROD_ADMIN2_USERNAME", "admin2"),
            "email": os.getenv("PREPROD_ADMIN2_EMAIL", "admin2@example.com"),
            "password": os.getenv("PREPROD_ADMIN2_PASSWORD"),
            "display_name": os.getenv("PREPROD_ADMIN2_DISPLAY_NAME", "Preprod Admin 2"),
        },
    ]

    for a in admins:
        user = None
        # Prefer locate by username; fallback to email
        if a["username"]:
            user = User.objects.filter(username=a["username"]).first()
        if not user and a["email"]:
            user = User.objects.filter(email=a["email"]).first()

        if user:
            # ensure is staff/superuser
            changed = False
            if not user.is_staff:
                user.is_staff = True
                changed = True
            if not user.is_superuser:
                user.is_superuser = True
                changed = True
            if changed:
                user.save(update_fields=["is_staff", "is_superuser"])
        else:
            password = a["password"] or _gen_strong_password()
            user = User(
                username=a["username"],
                email=a["email"],
                is_active=True,
                is_staff=True,
                is_superuser=True,
                password=make_password(password),
            )
            user.save()

            # Best-effort create Profile
            Profile.objects.get_or_create(
                user_id=user.pk,
                defaults={"display_name": a["display_name"]},
            )

            # Only print if password was generated (to avoid leaking env-provided secrets)
            if not a["password"]:
                print(f"[accounts.migrations.0003] Created admin '{a['username']}' with generated password: {password}")


def noop_reverse(apps, schema_editor):
    # We generally don't delete superusers on reverse to avoid accidental data loss.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_create_demo_user"),
    ]

    operations = [
        migrations.RunPython(create_preprod_admins, noop_reverse),
    ]
