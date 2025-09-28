from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout
from django.conf import settings
import logging
from django.db import transaction
from django.core.cache import cache
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Profile
from .serializers import SendCodeSerializer, RegisterSerializer, LoginSerializer


User = get_user_model()
logger = logging.getLogger(__name__)


@api_view(["POST"])
def send_verification_code(request):
    """
    Generate a verification code and store it in cache (TTL), then (in real life) send email.

    Body: { "email": string }
    """
    serializer = SendCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()

    # throttle: allow only one request per configured window per email
    request_interval = getattr(settings, "AUTH_VERIFICATION_REQUEST_INTERVAL_SECONDS", 60)
    throttle_key = f"accounts:verify:throttle:{email}"
    if cache.get(throttle_key):
        return Response({"message": "Please wait before requesting another code."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    code = f"{secrets.randbelow(999999):06d}"  # 6-digit numeric
    ttl_seconds = getattr(settings, "AUTH_VERIFICATION_CODE_TTL_SECONDS", 60 * 15)
    code_key = f"accounts:verify:code:{email}"
    cache.set(code_key, code, timeout=ttl_seconds)
    cache.set(throttle_key, True, timeout=request_interval)

    logger.warning("[PLEASE REMOVE THIS WHEN DONE WITH DEVELOPMENT] Email verification code for %s: %s", email, code)

    # TODO: integrate email provider; for now return ok without exposing code
    return Response({"success": True}, status=status.HTTP_200_OK)


@api_view(["POST"])
@transaction.atomic
def register(request):
    """
    Validate code and create user + profile.

    Body: { nickname, email, verification_code, password }
    """
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    nickname = serializer.validated_data["nickname"]
    email = serializer.validated_data["email"].lower()
    code = serializer.validated_data["verification_code"]
    password = serializer.validated_data["password"]

    # Validate code from cache (must match and be within TTL)
    code_key = f"accounts:verify:code:{email}"
    expected_code = cache.get(code_key)
    if not expected_code or expected_code != code:
        return Response({"message": "Invalid or expired verification code."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"message": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=email, email=email, password=password)
    Profile.objects.create(user=user, display_name=nickname)

    # Invalidate the code to prevent reuse
    cache.delete(code_key)

    # Log the user in to establish a server-side session
    django_login(request, user)
    return Response(
        {
            "success": True,
            "user": {"id": str(user.pk), "email": user.email, "name": nickname},
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@ensure_csrf_cookie
def csrf(request):
    """Ensure a CSRF cookie is set on the client."""
    return Response({"success": True})


@api_view(["POST"])
def login_view(request):
    """
    Simple username/password login returning a demo token.

    Body: { email, password }
    """
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()
    password = serializer.validated_data["password"]

    user = authenticate(username=email, password=password)
    if not user:
        return Response({"message": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)

    # success; establish session and return profile payload
    django_login(request, user)
    display_name = getattr(getattr(user, "profile", None), "display_name", None) or user.get_username()
    return Response(
        {
            "success": True,
            "user": {"id": str(user.pk), "email": user.email, "name": display_name},
        }
    )


@api_view(["POST"])
def logout_view(request):
    django_logout(request)
    return Response({"success": True})


@api_view(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    display_name = getattr(getattr(request.user, "profile", None), "display_name", None) or request.user.get_username()
    return Response({
        "id": str(request.user.pk),
        "email": request.user.email,
        "name": display_name,
    })

