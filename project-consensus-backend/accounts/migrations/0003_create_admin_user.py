import os

from django.conf import settings
from django.contrib.auth.hashers import identify_hasher, make_password
from django.db import migrations


def _clean_env_value(value: str) -> str:
    v = str(value).strip()
    if len(v) >= 2 and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
        v = v[1:-1].strip()
    return v


def _truthy(value: str | None) -> bool:
    if value is None:
        return False
    return _clean_env_value(value).lower() in {"1", "true", "yes", "y", "on"}


def _get_env(*names: str) -> str | None:
    for name in names:
        v = os.environ.get(name)
        if v is None:
            continue
        cleaned = _clean_env_value(v)
        if cleaned != "":
            return cleaned
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

    email = email.lower()
    username = email
    nickname = _get_env("ADMIN_NICKNAME") or "Admin"

    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    Profile = apps.get_model("accounts", "Profile")

    username_field = getattr(User, "USERNAME_FIELD", "username")

    user = None
    try:
        user = User.objects.filter(**{username_field: username}).first()
    except Exception:
        user = None

    if user is None and hasattr(User, "email"):
        try:
            user = User.objects.filter(email=email).first()
        except Exception:
            user = None

    if user is None:
        user_kwargs = {
            username_field: username,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
            "password": make_password(password),
        }
        if hasattr(User, "email"):
            user_kwargs["email"] = email

        user = User.objects.create(**user_kwargs)
    else:
        update_fields = []

        try:
            current_username = getattr(user, username_field, None)
            if current_username != username:
                conflict = (
                    User.objects.filter(**{username_field: username})
                    .exclude(pk=user.pk)
                    .exists()
                )
                if not conflict:
                    setattr(user, username_field, username)
                    update_fields.append(username_field)
        except Exception:
            pass

        if hasattr(user, "email"):
            current_email = getattr(user, "email", None)
            if current_email != email:
                conflict = False
                try:
                    conflict = User.objects.filter(email=email).exclude(pk=user.pk).exists()
                except Exception:
                    conflict = False

                if not conflict:
                    user.email = email
                    update_fields.append("email")

        if hasattr(user, "is_staff") and not getattr(user, "is_staff"):
            user.is_staff = True
            update_fields.append("is_staff")
        if hasattr(user, "is_superuser") and not getattr(user, "is_superuser"):
            user.is_superuser = True
            update_fields.append("is_superuser")
        if hasattr(user, "is_active") and not getattr(user, "is_active"):
            user.is_active = True
            update_fields.append("is_active")

        needs_password = False
        try:
            encoded = str(getattr(user, "password", "") or "").strip()
            if not encoded:
                needs_password = True
            else:
                try:
                    identify_hasher(encoded)
                except Exception:
                    needs_password = True

            if hasattr(user, "has_usable_password") and not user.has_usable_password():
                needs_password = True
        except Exception:
            needs_password = True

        if needs_password:
            user.password = make_password(password)
            update_fields.append("password")

        if update_fields:
            user.save(update_fields=list(dict.fromkeys(update_fields)))

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
