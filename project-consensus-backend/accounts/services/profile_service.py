from __future__ import annotations

import logging
from typing import Any, Mapping

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from accounts.models import Profile
from accounts.serializers import ProfileSerializer
from core.utils import delete_storage_object_by_url


User = get_user_model()
logger = logging.getLogger(__name__)


class NicknameRateLimitError(Exception):
    """Raised when a user attempts to change nickname before cooldown expires."""

    def __init__(self, days_remaining: int) -> None:
        self.days_remaining = days_remaining
        super().__init__(
            f"Nickname can only be updated once every {Profile.NICKNAME_COOLDOWN_DAYS} days. "
            f"Please wait {days_remaining} more day(s)."
        )


class ProfileService:
    """Encapsulate profile update business logic.

    Responsibilities:
    - Enforce nickname cooldown rule
    - Validate and persist profile fields via serializer
    - Clean up old avatar object in storage when avatar_url changes
    - Return a fresh user instance annotated with stats for response payloads
    """

    def update_profile(self, *, request, data: Mapping[str, Any]) -> User | None:
        user = request.user
        if not user or not user.is_authenticated:
            return None

        with transaction.atomic():
            profile, _ = Profile.objects.get_or_create(user=user)

            # Nickname cooldown rule
            new_nickname = data.get("nickname")
            is_nickname_changed = (
                new_nickname is not None
                and new_nickname != profile.nickname
            )

            if is_nickname_changed:
                days_remaining = profile.days_until_nickname_update_allowed()
                if days_remaining is not None and days_remaining > 0:
                    raise NicknameRateLimitError(days_remaining=days_remaining)

            old_avatar_url = profile.avatar_url or ""

            serializer = ProfileSerializer(
                profile,
                data=data,
                partial=True,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

            # Update last_nickname_updated_at if nickname actually changed
            if is_nickname_changed:
                profile.last_nickname_updated_at = timezone.now()
                profile.save(update_fields=["last_nickname_updated_at"])

            new_avatar_url = profile.avatar_url or ""

        # Handle avatar cleanup best-effort (never fail the request because of it)
        try:
            if old_avatar_url and old_avatar_url != new_avatar_url:
                delete_storage_object_by_url(
                    old_avatar_url,
                    owner_user_id=user.pk,
                )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning(
                "Failed to delete old avatar for user %s: %s",
                user.pk,
                exc,
                exc_info=True,
            )

        return User.objects.select_related("profile").get(pk=user.pk)
