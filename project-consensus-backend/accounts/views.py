from __future__ import annotations

import logging

from django.contrib.auth import (
    authenticate,
    get_user_model,
    login as django_login,
    logout as django_logout,
    update_session_auth_hash,
)
from django.db import transaction
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from accounts import error_codes
from accounts.models import Profile
from .selectors import get_user_with_stats
from .serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    SendCodeSerializer,
    UserDetailSerializer,
)
from .services.auth_service import AuthService, RegistrationError, VerificationThrottleError
from .services.password_reset_service import (
    PasswordResetError,
    PasswordResetRequestError,
    PasswordResetService,
)
from .services.profile_service import (
    NicknameRateLimitError,
    ProfileService,
)


User = get_user_model()
logger = logging.getLogger(__name__)

# Service instances (stateless; safe to reuse per-process)
auth_service = AuthService()
password_reset_service = PasswordResetService()
profile_service = ProfileService()


# Custom throttle classes for authentication endpoints
class LoginRateThrottle(AnonRateThrottle):
    """Rate limit for login attempts: 5 per minute per IP."""
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    """Rate limit for registration: 3 per hour per IP."""
    scope = 'register'


class VerificationCodeRateThrottle(AnonRateThrottle):
    """Rate limit for sending verification code: 5 per minute per IP."""
    scope = 'verification'


class PasswordResetRequestRateThrottle(AnonRateThrottle):
    """Rate limit for password reset request: 50 per hour per IP."""
    scope = 'password_reset'


class PasswordResetConfirmRateThrottle(AnonRateThrottle):
    """Rate limit for password reset confirmation: 50 per hour per IP."""
    scope = 'password_reset_confirm'


@api_view(["POST"])
@throttle_classes([VerificationCodeRateThrottle])
def send_verification_code(request):
    """
    Generate a verification code and store it in cache (TTL), then (in real life) send email.

    Body: { "email": string }
    """
    serializer = SendCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()

    try:
        result = auth_service.send_verification_code(request=request, email=email)
    except VerificationThrottleError:
        # Use i18n error code; frontend maps 429 to a localized message as well
        return Response(
            {"message": "auth.errorTooManyAttempts"},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return Response(
        {
            "success": True,
            "email": result.email,
            "resend_after_seconds": result.resend_after_seconds,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@throttle_classes([RegisterRateThrottle])
def register(request):
    """
    Validate code and create user + profile.

    Body: { nickname, email, verification_code, password }
    """
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    try:
        user = auth_service.register_user(
            nickname=data["nickname"],
            email=data["email"],
            code=data["verification_code"],
            password=data["password"],
        )
    except RegistrationError as e:
        if e.reason == "too_many_attempts":
            return Response(
                {"message": "validation.verificationCode.tooManyAttempts"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if e.reason == "invalid_or_expired":
            return Response(
                {"verification_code": ["validation.verificationCode.invalidOrExpired"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if e.reason == "email_already_registered":
            return Response(
                {"email": ["validation.email.alreadyRegistered"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Fallback generic error (should not normally happen)
        return Response({"message": "auth.errorGeneric"}, status=status.HTTP_400_BAD_REQUEST)

    # Log the user in to establish a server-side session
    django_login(request, user)
    return Response(
        {"success": True, "user": UserDetailSerializer(user).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@ensure_csrf_cookie
def csrf(request):
    """
    Ensure a CSRF cookie is set on the client.

    Django's CSRF middleware injects `Set-Cookie: csrftoken=...` here; the frontend
    later reads that cookie and sends it back as `X-CSRFToken` on POST/PATCH/etc.
    We don't return the header directly - only the cookie is issued.
    """
    return Response({"success": True})


@api_view(["POST"])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    """
    Simple username/password login.

    Body: { email, password }
    """
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()
    password = serializer.validated_data["password"]

    user = authenticate(username=email, password=password)
    if not user:
        return Response({"message": "auth.invalidCredentials"}, status=status.HTTP_400_BAD_REQUEST)

    # Check if the account is active
    try:
        profile = user.profile
    except Profile.DoesNotExist:
        profile = None
    if profile and not profile.is_account_active:
        return Response({
            "message": "auth.errorAccountDisabled",
            "account_disabled": True
        }, status=status.HTTP_403_FORBIDDEN)

    # Fetch user with optimized stats to avoid N+1 queries
    user_with_stats = get_user_with_stats(user.pk)
    if not user_with_stats:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    # Success; establish session and return profile payload.
    django_login(request, user)
    return Response({"success": True, "user": UserDetailSerializer(user_with_stats).data})


@api_view(["POST"])
def logout_view(request):
    django_logout(request)
    return Response({"success": True})


@api_view(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Fetch user with optimized stats to avoid N+1 queries
    user_with_stats = get_user_with_stats(request.user.pk)
    if not user_with_stats:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(UserDetailSerializer(user_with_stats).data)


@api_view(["PATCH"])
@transaction.atomic
def update_profile(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        # Delegate all business logic (nickname cooldown, avatar cleanup, etc.)
        user_with_stats = profile_service.update_profile(
            request=request,
            data=request.data,
        )
    except NicknameRateLimitError as e:
        return Response(
            {
                "message": (
                    "Nickname can only be updated once every 14 days. "
                    f"Please wait {e.days_remaining} more day(s)."
                ),
                "days_remaining": e.days_remaining,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if not user_with_stats:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True, "user": UserDetailSerializer(user_with_stats).data})


@api_view(["GET"])
def public_user(request, user_id):
    """Get public profile information for a specific user."""
    try:
        # Fetch user with optimized stats
        user_with_stats = get_user_with_stats(user_id)
        if not user_with_stats:
            return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(PublicUserSerializer(user_with_stats).data)
    except Exception as e:
        logger.error(f"Error fetching public user {user_id}: {e}")
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@throttle_classes([PasswordResetRequestRateThrottle])
def request_password_reset(request):
    """
    Request a password reset by email.
    
    Body: { "email": string }
    
    Always returns success to prevent user enumeration.
    If the email exists, a reset link is sent.
    """
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()

    try:
        password_reset_service.request_reset(request=request, email=email)
    except PasswordResetRequestError as e:
        if e.code == "too_many_requests":
            return Response(
                {"message": error_codes.AUTH_TOO_MANY_ATTEMPTS},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        return Response(
            {"message": "auth.errorGeneric"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Always return success to prevent user enumeration
    return Response({
        "success": True,
        "message": error_codes.PASSWORD_RESET_EMAIL_SENT
    }, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([PasswordResetConfirmRateThrottle])
@transaction.atomic
def confirm_password_reset(request):
    """
    Confirm password reset with token and set new password.
    
    Body: { "uid": string, "token": string, "new_password": string, "new_password_confirm": string }
    """
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    uid = serializer.validated_data["uid"]
    token = serializer.validated_data["token"]
    session_id = serializer.validated_data["session_id"]
    new_password = serializer.validated_data["new_password"]

    try:
        password_reset_service.confirm_reset(
            uid=uid,
            token=token,
            session_id=session_id,
            new_password=new_password,
        )
    except PasswordResetError as e:
        if e.code == "invalid_or_expired":
            return Response(
                {"message": error_codes.PASSWORD_RESET_INVALID_OR_EXPIRED},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if e.code == "weak_password":
            return Response(
                {"new_password": e.password_errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"message": error_codes.PASSWORD_RESET_INVALID_OR_EXPIRED},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "success": True,
            "message": error_codes.PASSWORD_RESET_SUCCESS,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """
    Allow an authenticated user to change their password by providing the
    current password and a new password.
    """
    serializer = PasswordChangeSerializer(
        data=request.data,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)

    user = serializer.save()
    update_session_auth_hash(request, user)

    return Response({"success": True}, status=status.HTTP_200_OK)

