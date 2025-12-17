from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.utils import timezone


logger = logging.getLogger(__name__)
User = get_user_model()


class SessionService:
    """
    Service layer for session-related operations.

    Responsibilities:
    - Best-effort invalidation of active sessions for a given user.
    """

    def invalidate_user_sessions(self, user: User, keep_session_key: str | None = None) -> None:
        """
        Best-effort invalidation of active sessions for the given user.

        By default, **all** sessions for the user are invalidated. When
        `keep_session_key` is provided, the session with that key will be
        preserved (useful for in-session password changes where we want to
        keep the current login but log out all other devices).

        Any errors are logged but do not block password reset (or change)
        completion.
        """
        try:
            active_sessions = Session.objects.filter(expire_date__gte=timezone.now())
            for session in active_sessions:
                # Optionally preserve the current request's session.
                if keep_session_key and session.session_key == keep_session_key:
                    continue
                data = session.get_decoded()
                if str(data.get("_auth_user_id")) == str(user.pk):
                    session.delete()
        except Exception as e:  # pragma: no cover - defensive logging
            logger.warning(
                "Failed to invalidate user sessions",
                extra={
                    "user_id": user.pk,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
                exc_info=True,
            )


session_service = SessionService()

