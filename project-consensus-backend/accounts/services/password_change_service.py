from __future__ import annotations

import logging
from typing import Any, Mapping

from django.conf import settings
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.core.cache import cache

from accounts.serializers import PasswordChangeSerializer
from accounts.services.session_service import session_service


logger = logging.getLogger(__name__)
User = get_user_model()


class PasswordChangeRateLimitError(Exception):
    """
    Raised when a user attempts to change password before cooldown expires.

    code:
        - "too_many_requests"
    """

    def __init__(self, code: str = "too_many_requests"):
        self.code = code
        super().__init__(code)


class PasswordChangeService:
    """
    Service layer for authenticated password change flow.

    Responsibilities:
    - Enforce per-user cooldown for password changes
    - Validate input via `PasswordChangeSerializer`
    - Persist new password and rotate sessions
    """

    def change_password(self, *, request, data: Mapping[str, Any]) -> User | None:
        user = request.user if request is not None else None
        if not user or not user.is_authenticated:
            return None

        cooldown_seconds = getattr(settings, "PASSWORD_CHANGE_COOLDOWN_SECONDS", 300)
        throttle_key = f"accounts:pwdchange:throttle:{user.pk}"

        # Enforce per-user cooldown: at most one successful change per window.
        if cache.get(throttle_key):
            raise PasswordChangeRateLimitError()

        serializer = PasswordChangeSerializer(
            data=data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        # Set cooldown only after a successful password change so users are not
        # penalized for validation errors (e.g., weak passwords or mismatched
        # confirmation).
        cache.set(throttle_key, True, timeout=cooldown_seconds)

        # Keep the current session authenticated but invalidate all other
        # active sessions for this user for better security (e.g. log out
        # other devices/browsers that were using the old password).
        update_session_auth_hash(request, user)
        session_service.invalidate_user_sessions(
            user=user,
            keep_session_key=request.session.session_key,
        )

        logger.info(
            "Password changed successfully",
            extra={"user_id": user.pk},
        )

        return user

