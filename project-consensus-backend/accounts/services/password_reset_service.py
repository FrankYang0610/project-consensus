from __future__ import annotations

import hmac
import logging
import secrets
from dataclasses import dataclass

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as dj_validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.translation import get_language_from_request

from accounts import error_codes
from accounts.services.email_service import EmailService
from accounts.tasks import send_password_reset_email_async


logger = logging.getLogger(__name__)
User = get_user_model()


class PasswordResetRequestError(Exception):
    """
    Domain error for password reset request failures.

    code:
        - "too_many_requests"
    """

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class PasswordResetError(Exception):
    """
    Domain error for password reset confirmation failures.

    code:
        - "invalid_or_expired"
        - "weak_password"
    """

    def __init__(self, code: str, password_errors: list[str] | None = None):
        self.code = code
        self.password_errors = password_errors or []
        super().__init__(code)


@dataclass
class PasswordResetRequestResult:
    """Result payload for requesting a password reset (currently minimal)."""

    email: str


class PasswordResetService:
    """
    Service layer for password reset flows.

    Responsibilities:
    - Request password reset and send email with tokenized link
    - Confirm password reset and rotate user sessions
    """

    def __init__(self) -> None:
        self.email_service = EmailService()

    def request_reset(self, request, email: str) -> PasswordResetRequestResult:
        """
        Request a password reset for the given email.

        Security:
        - Always returns success to the caller (view) regardless of user existence.
        - Applies per-email throttling using cache to mitigate abuse.
        """
        email = email.lower()

        request_interval = getattr(settings, "PASSWORD_RESET_REQUEST_INTERVAL_SECONDS", 300)
        throttle_key = f"accounts:pwdreset:throttle:{email}"
        if cache.get(throttle_key):
            raise PasswordResetRequestError("too_many_requests")

        # Set throttle regardless of whether user exists to avoid enumeration timing
        cache.set(throttle_key, True, timeout=request_interval)

        language = get_language_from_request(request)

        try:
            user = User.objects.get(email=email)
            user_exists = True
        except User.DoesNotExist:
            user_exists = False
            logger.info(
                "Password reset requested for non-existent email",
                extra={"email": email},
            )

        if user_exists:
            self._send_reset_email(request=request, user=user, email=email, language=language)

        return PasswordResetRequestResult(email=email)

    def _send_reset_email(self, *, request, user: User, email: str, language: str) -> None:
        """
        Build password reset token/link and send email (async or sync).
        """
        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Generate a per-request session identifier so that only the latest email is valid.
        session_id = secrets.token_urlsafe(16)
        timeout_seconds = getattr(settings, "PASSWORD_RESET_TIMEOUT", 3600)
        session_cache_key = f"accounts:pwdreset:session:{user.pk}"
        cache.set(session_cache_key, session_id, timeout=timeout_seconds)

        frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "https://polyu.life").rstrip("/")
        reset_link = f"{frontend_base_url}/reset-password?uid={uid}&token={token}&sid={session_id}"

        timeout_hours = timeout_seconds // 3600

        if getattr(settings, "EMAIL_ENABLED", False):
            use_async = getattr(settings, "EMAIL_USE_CELERY", False)
            if use_async:
                try:
                    send_password_reset_email_async.delay(
                        email=email,
                        reset_link=reset_link,
                        language=language,
                        timeout_hours=timeout_hours,
                    )
                    logger.info(
                        "Password reset email task queued successfully",
                        extra={"email": email, "async": True},
                    )
                except Exception as e:
                    logger.error(
                        "Failed to queue password reset email task",
                        exc_info=True,
                        extra={"email": email, "error_type": type(e).__name__},
                    )
                    self._send_reset_email_sync(
                        email=email,
                        reset_link=reset_link,
                        language=language,
                        timeout_hours=timeout_hours,
                        fallback=True,
                    )
            else:
                self._send_reset_email_sync(
                    email=email,
                    reset_link=reset_link,
                    language=language,
                    timeout_hours=timeout_hours,
                    fallback=False,
                )
        else:
            logger.warning(
                "[DEV MODE] Email disabled. Password reset link for %s: %s",
                email,
                reset_link,
            )

    def _send_reset_email_sync(
        self,
        *,
        email: str,
        reset_link: str,
        language: str,
        timeout_hours: int,
        fallback: bool,
    ) -> None:
        """Helper for synchronous password reset email sending."""
        try:
            self.email_service.send_password_reset(
                email=email,
                reset_link=reset_link,
                language=language,
                timeout_hours=timeout_hours,
            )
            logger.info(
                "Password reset email sent successfully",
                extra={"email": email, "async": False, "fallback": fallback},
            )
        except Exception as e:
            logger.error(
                "Failed to send password reset email",
                exc_info=True,
                extra={"email": email, "error_type": type(e).__name__, "fallback": fallback},
            )

    def confirm_reset(self, *, uid: str, token: str, session_id: str, new_password: str) -> None:
        """
        Confirm password reset and set a new password for the user.

        Raises:
            PasswordResetError: when token/session is invalid or password is weak.
        """
        user = self._resolve_user_from_uid(uid)
        self._validate_reset_session(user=user, session_id=session_id)
        self._validate_reset_token(user=user, token=token)
        self._validate_new_password(user=user, new_password=new_password)

        # Set new password and persist
        user.set_password(new_password)
        user.save()

        # Invalidate this reset session so the link cannot be reused
        session_cache_key = f"accounts:pwdreset:session:{user.pk}"
        cache.delete(session_cache_key)

        # Invalidate existing sessions for this user for security
        self._invalidate_user_sessions(user)

        logger.info(
            "Password reset successful",
            extra={"user_id": user.pk, "email": user.email},
        )

    # Internal helpers
    def _resolve_user_from_uid(self, uid: str) -> User:
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            return User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise PasswordResetError("invalid_or_expired")

    def _validate_reset_session(self, *, user: User, session_id: str) -> None:
        session_cache_key = f"accounts:pwdreset:session:{user.pk}"
        expected_session_id = cache.get(session_cache_key)
        if not expected_session_id or not hmac.compare_digest(str(expected_session_id), str(session_id)):
            raise PasswordResetError("invalid_or_expired")

    def _validate_reset_token(self, *, user: User, token: str) -> None:
        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            raise PasswordResetError("invalid_or_expired")

    def _validate_new_password(self, *, user: User, new_password: str) -> None:
        try:
            dj_validate_password(new_password, user=user)
        except DjangoValidationError as e:
            error_codes_list = [error_codes.map_django_password_error(msg) for msg in e.messages]
            raise PasswordResetError("weak_password", password_errors=error_codes_list)

    def _invalidate_user_sessions(self, user: User) -> None:
        """
        Best-effort invalidation of all active sessions for the given user.

        Any errors are logged but do not block password reset completion.
        """
        try:
            active_sessions = Session.objects.filter(expire_date__gte=timezone.now())
            for session in active_sessions:
                data = session.get_decoded()
                if str(data.get("_auth_user_id")) == str(user.pk):
                    session.delete()
        except Exception as e:  # pragma: no cover - defensive logging
            logger.warning(
                "Failed to invalidate user sessions after password reset",
                extra={"user_id": user.pk, "error": str(e), "error_type": type(e).__name__},
                exc_info=True,
            )

