from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.core.cache import cache
from django.utils.translation import get_language_from_request

from accounts.models import Profile
from accounts.services.email_service import EmailService
from accounts.tasks import send_verification_email_async


logger = logging.getLogger(__name__)
User = get_user_model()


@dataclass
class VerificationCodeResult:
    """Result payload for sending a verification code."""

    email: str
    resend_after_seconds: int


class VerificationThrottleError(Exception):
    """Raised when a verification code is requested too frequently for an email."""


class RegistrationError(Exception):
    """
    Domain error for registration failures.

    reason:
        - "too_many_attempts"
        - "invalid_or_expired"
        - "email_already_registered"
    """

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


class AuthService:
    """
    Service layer for authentication-related flows.

    Responsibilities:
    - Email verification code generation and delivery
    - Registration with verification code
    """

    def __init__(self) -> None:
        self.email_service = EmailService()

    def send_verification_code(self, request, email: str) -> VerificationCodeResult:
        """
        Generate and cache a verification code for the given email, then send it.

        Behavior:
        - Throttles per-email using a cache key to mitigate abuse.
        - If the email is already registered, does not send an email but returns success.
        - Stores a SHA256 hash of the code in cache (not the raw code).
        """
        email = email.lower()

        # Per-email throttle window
        request_interval = getattr(settings, "AUTH_VERIFICATION_REQUEST_INTERVAL_SECONDS", 90)
        throttle_key = f"accounts:verify:throttle:{email}"
        if cache.get(throttle_key):
            raise VerificationThrottleError("too_many_requests")

        # If the email already belongs to an existing account, avoid user enumeration:
        # - Set throttle
        # - Log the event
        # - Return success without sending an email
        if User.objects.filter(email=email).exists():
            cache.set(throttle_key, True, timeout=request_interval)
            logger.info(
                "Verification code requested for existing account; suppressed sending",
                extra={"email": email},
            )
            return VerificationCodeResult(email=email, resend_after_seconds=request_interval)

        # Generate a 6‑digit numeric code
        code = f"{secrets.randbelow(10**6):06d}"
        ttl_seconds = getattr(settings, "AUTH_VERIFICATION_CODE_TTL_SECONDS", 60 * 15)

        # Store only a hash of the code in cache for security
        code_key = f"accounts:verify:code:{email}"
        cache.set(code_key, hashlib.sha256(code.encode("utf-8")).hexdigest(), timeout=ttl_seconds)

        # Set email-specific throttle window
        cache.set(throttle_key, True, timeout=request_interval)

        # Reset attempt counter when issuing a new code
        attempt_key = f"accounts:verify:attempts:{email}"
        cache.delete(attempt_key)

        # Send verification code via email (async via Celery when enabled)
        if getattr(settings, "EMAIL_ENABLED", False):
            language = get_language_from_request(request)
            use_async = getattr(settings, "EMAIL_USE_CELERY", False)

            if use_async:
                try:
                    send_verification_email_async.delay(
                        email=email,
                        code=code,
                        language=language,
                        ttl_minutes=ttl_seconds // 60,
                    )
                    logger.info(
                        "Verification email task queued successfully",
                        extra={"email": email, "async": True},
                    )
                except Exception as e:
                    # Fallback to synchronous send if Celery is unavailable
                    logger.error(
                        "Failed to queue verification email task",
                        exc_info=True,
                        extra={"email": email, "error_type": type(e).__name__},
                    )
                    self._send_verification_code_sync(
                        email=email,
                        code=code,
                        language=language,
                        ttl_minutes=ttl_seconds // 60,
                        fallback=True,
                    )
            else:
                # Synchronous send (development or when Celery is disabled)
                self._send_verification_code_sync(
                    email=email,
                    code=code,
                    language=language,
                    ttl_minutes=ttl_seconds // 60,
                    fallback=False,
                )
        else:
            # Development mode: log the code instead of sending email
            logger.warning(
                "[DEV MODE] Email disabled. Verification code for %s: %s",
                email,
                code,
            )

        return VerificationCodeResult(email=email, resend_after_seconds=request_interval)

    def _send_verification_code_sync(
        self,
        *,
        email: str,
        code: str,
        language: str,
        ttl_minutes: int,
        fallback: bool,
    ) -> None:
        """
        Helper for synchronous verification email sending.

        `fallback=True` indicates this is called as a backup when Celery fails.
        """
        try:
            self.email_service.send_verification_code(
                email=email,
                code=code,
                language=language,
                ttl_minutes=ttl_minutes,
            )
            logger.info(
                "Verification email sent successfully",
                extra={"email": email, "async": False, "fallback": fallback},
            )
        except Exception as e:
            logger.error(
                "Failed to send verification email",
                exc_info=True,
                extra={"email": email, "error_type": type(e).__name__, "fallback": fallback},
            )

    @transaction.atomic
    def register_user(self, *, username: str, nickname: str, email: str | None, verification_code: str | None, password: str) -> User:
        """
        Create a new user + profile with username-based registration.

        Args:
            username: Unique username for login (uniqueness check is done in the serializer)
            nickname: Display name (uniqueness check is done in the serializer)
            email: Optional email address (requires code if provided)
            verification_code: Verification code (required if email is provided)
            password: User password

        Raises:
            RegistrationError: when username is already taken or verification fails.
        
        Note:
            Email uniqueness [must] be checked [here] in the service layer after successful
            verification, and should not be done in the serializer. This ensures the
            uniqueness check is tied to a verified email, which is important for security.
        """

        # Handle optional email: use None (not empty string) when no email provided
        email_value: str | None = (email.lower().strip() if email else "") or None
        
        # If email is provided, verify the code
        if email_value:
            if not verification_code:
                raise RegistrationError("verification_code_required")
            
            # Verify the code
            max_attempts = getattr(settings, "AUTH_VERIFICATION_MAX_ATTEMPTS", 5)
            attempt_key = f"accounts:verify:attempts:{email_value}"
            attempts = cache.get(attempt_key, 0)
            if attempts >= max_attempts:
                raise RegistrationError("too_many_attempts")

            code_key = f"accounts:verify:code:{email_value}"
            expected_digest = cache.get(code_key)
            provided_digest = hashlib.sha256(verification_code.encode("utf-8")).hexdigest()

            if not expected_digest or not hmac.compare_digest(str(expected_digest), str(provided_digest)):
                ttl_seconds = getattr(settings, "AUTH_VERIFICATION_CODE_TTL_SECONDS", 60 * 15)
                cache.set(attempt_key, attempts + 1, timeout=ttl_seconds)
                raise RegistrationError("invalid_or_expired")
            
            # Check email is not already registered
            if User.objects.filter(email=email_value).exists():
                raise RegistrationError("email_already_registered")
            
            # Invalidate code and attempt counter to prevent reuse
            cache.delete(code_key)
            cache.delete(attempt_key)

        try:
            user = User.objects.create_user(username=username, email=email_value, password=password)
        except IntegrityError:
            # IntegrityError is raised when the username is already taken
            # Because there is a time gap between the uniqueness check in the serializer and the database check
            raise RegistrationError("username_already_taken")

        Profile.objects.create(
            user=user,
            nickname=nickname,
            pronouns="",
        )

        return user

