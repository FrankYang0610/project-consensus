from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout
from django.conf import settings
import logging
from django.db import transaction
from django.core.cache import cache
from django.db.models import Count
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token

from .models import Profile
from .serializers import SendCodeSerializer, RegisterSerializer, LoginSerializer, ProfileSerializer


User = get_user_model()
logger = logging.getLogger(__name__)


def annotate_user_stats(queryset):
    """Add user statistics annotations to a User queryset to avoid N+1 queries.
    
    使用方法 / Usage:
        # Single user
        user = annotate_user_stats(User.objects.filter(pk=user_id)).first()
        
        # Multiple users
        users = annotate_user_stats(User.objects.all())
    
    此函数为用户查询集添加统计字段，避免 N+1 查询问题
    """
    return queryset.select_related('profile').annotate(
        posts_count=Count('forum_posts', distinct=True),
        comments_count=Count('forum_comments', distinct=True),
        reviews_count=Count('course_reviews', distinct=True)
    )


def build_user_payload(user):
    """Return a minimal, serializable user payload for API responses.
    
    Note: For optimal performance, when querying users, use annotate_user_stats() 
    to pre-calculate statistics and avoid N+1 queries:
    
        user = User.objects.select_related('profile').annotate(
            posts_count=Count('forum_posts', distinct=True),
            comments_count=Count('forum_comments', distinct=True),
            reviews_count=Count('course_reviews', distinct=True)
        ).get(pk=user_id)
    """
    profile = getattr(user, "profile", None)
    
    # Use pre-calculated statistics if available (from annotate), otherwise query
    # 优先使用预先计算的统计数据（通过 annotate），否则执行查询
    posts_count = getattr(user, 'posts_count', None)
    if posts_count is None:
        posts_count = user.forum_posts.count()
    
    comments_count = getattr(user, 'comments_count', None)
    if comments_count is None:
        comments_count = user.forum_comments.count()
    
    reviews_count = getattr(user, 'reviews_count', None)
    if reviews_count is None:
        reviews_count = user.course_reviews.count()
    
    # Calculate days since joining
    joined_days = 0
    if user.date_joined:
        from django.utils import timezone
        delta = timezone.now() - user.date_joined
        joined_days = delta.days
    
    return {
        "id": str(user.pk),
        "email": user.email,
        "name": getattr(profile, "display_name", None) or user.get_username(),
        "avatar": getattr(profile, "avatar_url", None) or None,
        "pronouns": getattr(profile, "pronouns", None) if getattr(profile, "pronouns_shared", False) else "",
        "pronounsShared": getattr(profile, "pronouns_shared", False),
        "stats": {
            "posts": posts_count,
            "comments": comments_count,
            "reviews": reviews_count,
            "joinedDays": joined_days,
        }
    }

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
    # Default pronouns to 'not_specified' and do not share by default for new users
    Profile.objects.create(
        user=user,
        display_name=nickname,
        pronouns="not_specified",
        pronouns_shared=False,
    )

    # Invalidate the code to prevent reuse
    cache.delete(code_key)

    # Log the user in to establish a server-side session
    django_login(request, user)
    return Response({"success": True, "user": build_user_payload(user)}, status=status.HTTP_201_CREATED)


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

    # Fetch user with optimized stats to avoid N+1 queries
    # 获取用户时同时计算统计数据，避免 N+1 查询
    user = annotate_user_stats(User.objects.filter(pk=user.pk)).first()

    # success; establish session and return profile payload
    django_login(request, user)
    return Response({"success": True, "user": build_user_payload(user)})


@api_view(["POST"])
def logout_view(request):
    django_logout(request)
    return Response({"success": True})


@api_view(["GET"])
def me(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Fetch user with optimized stats to avoid N+1 queries
    # 获取用户时同时计算统计数据，避免 N+1 查询
    user = annotate_user_stats(User.objects.filter(pk=request.user.pk)).first()
    return Response(build_user_payload(user))


@api_view(["PATCH"])
@transaction.atomic
def update_profile(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    profile, _ = Profile.objects.get_or_create(user=request.user)
    serializer = ProfileSerializer(profile, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    
    # Fetch user with optimized stats to avoid N+1 queries
    # 获取用户时同时计算统计数据，避免 N+1 查询
    user = annotate_user_stats(User.objects.filter(pk=request.user.pk)).first()
    return Response({"success": True, "user": build_user_payload(user)})

