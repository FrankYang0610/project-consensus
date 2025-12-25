import os

from django.conf import settings
from django.db import migrations


def _truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_env(*names: str) -> str | None:
    for name in names:
        v = os.environ.get(name)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return None


def _make_unique_nickname(Profile, base: str) -> str:
    base = (base or "admin").strip() or "admin"
    base = base[:15]

    nickname = base
    if not Profile.objects.filter(nickname=nickname).exists():
        return nickname

    for i in range(2, 1000):
        suffix = str(i)
        nickname = f"{base[: max(0, 15 - 1 - len(suffix))]}-{suffix}"[:15]
        if not Profile.objects.filter(nickname=nickname).exists():
            return nickname

    return f"admin-{os.urandom(2).hex()}"[:15]


def create_admin_user(apps, schema_editor):
    enabled = _truthy(_get_env("SEED_ADMIN_USER", "CREATE_ADMIN_USER"))
    if not enabled:
        return

    email = _get_env("ADMIN_EMAIL", "DJANGO_SUPERUSER_EMAIL")
    password = _get_env("ADMIN_PASSWORD", "DJANGO_SUPERUSER_PASSWORD")

    if not email or not password:
        return

    username = _get_env("ADMIN_USERNAME", "DJANGO_SUPERUSER_USERNAME") or email
    nickname = _get_env("ADMIN_NICKNAME") or "Admin"

    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    Profile = apps.get_model("accounts", "Profile")

    user = None
    try:
        user = User.objects.filter(email=email).first()
    except Exception:
        user = None

    if user is None:
        username_field = getattr(User, "USERNAME_FIELD", "username")
        user_kwargs = {
            username_field: username,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        }
        if hasattr(User, "email"):
            user_kwargs["email"] = email

        user = User.objects.create(**user_kwargs)
        try:
            user.set_password(password)
        except Exception:
            pass
        user.save()
    else:
        update_fields = []
        if hasattr(user, "is_staff") and not getattr(user, "is_staff"):
            user.is_staff = True
            update_fields.append("is_staff")
        if hasattr(user, "is_superuser") and not getattr(user, "is_superuser"):
            user.is_superuser = True
            update_fields.append("is_superuser")
        if hasattr(user, "is_active") and not getattr(user, "is_active"):
            user.is_active = True
            update_fields.append("is_active")
        if update_fields:
            user.save(update_fields=update_fields)

    if not Profile.objects.filter(user_id=user.pk).exists():
        Profile.objects.create(
            user=user,
            nickname=_make_unique_nickname(Profile, nickname),
            pronouns="not_specified",
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_create_demo_user"),
    ]

    operations = [
        migrations.RunPython(create_admin_user, migrations.RunPython.noop),
    ]
