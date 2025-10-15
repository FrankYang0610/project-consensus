from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from accounts.models import Profile


User = get_user_model()


def build_forum_author_payload(user: Any) -> dict:
    """Return forum Author payload shape: {id, name, avatar}.

    Uses Profile.author_payload when available; falls back to username.
    """
    try:
        profile: Profile = user.profile  # type: ignore[attr-defined]
        return profile.author_payload
    except Profile.DoesNotExist:  # pragma: no cover
        return {"id": str(user.pk), "name": user.get_username(), "avatar": None}


def build_course_author_payload(user: Any) -> dict:
    """Return course Author payload shape: {id, name, avatarUrl}.

    Course serializers expect camelCase `avatarUrl`.
    """
    try:
        profile: Profile = user.profile  # type: ignore[attr-defined]
        name = profile.nickname or user.get_username()
        avatar_url = profile.avatar_url or None
    except Profile.DoesNotExist:  # pragma: no cover
        name = user.get_username()
        avatar_url = None
    return {"id": str(user.pk), "name": name, "avatarUrl": avatar_url}


