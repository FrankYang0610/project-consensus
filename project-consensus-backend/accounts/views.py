from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout
from django.conf import settings
import logging
from django.db import transaction, models
from django.core.cache import cache
from django.db.models import Count, Exists, OuterRef
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.http import HttpRequest
from rest_framework.pagination import PageNumberPagination
from rest_framework import permissions

from .models import Profile
from core.utils import delete_storage_object_by_url
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


def get_user_with_stats(user_id):
    """Fetch a single user with optimized stats to avoid N+1 queries.
    
    获取单个用户及其统计数据，避免 N+1 查询
    
    Args:
        user_id: The primary key of the user to fetch
        
    Returns:
        User object with annotated stats, or None if not found
    """
    return annotate_user_stats(User.objects.filter(pk=user_id)).first()


def _build_base_user_payload(user):
    """Build the base user payload with common fields (internal helper).
    
    Args:
        user: User object to serialize
    
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
    
    # Calculate days until next nickname update is allowed
    # 计算距离下次可以更新昵称还剩多少天
    days_until_next_update = None
    last_updated = getattr(profile, "last_nickname_updated_at", None)
    if last_updated:
        from django.utils import timezone
        days_since_update = (timezone.now() - last_updated).days
        if days_since_update < 14:
            days_until_next_update = 14 - days_since_update
    
    return {
        "id": str(user.pk),
        "name": getattr(profile, "nickname", None) or user.get_username(),
        "avatar": (getattr(profile, "avatar_url", None) or None),
        "pronouns": getattr(profile, "pronouns", None) or "prefer_not_to_say",
        "showForumPostsPublicly": getattr(profile, "show_forum_posts_publicly", True),
        "showForumPostCommentsPublicly": getattr(profile, "show_forum_post_comments_publicly", True),
        "showCourseReviewsPublicly": getattr(profile, "show_course_reviews_publicly", True),
        "isAccountActive": getattr(profile, "is_account_active", True),
        "lastProfileUpdatedAt": last_updated.isoformat() if last_updated else None,
        "daysUntilNextUpdate": days_until_next_update,
        "stats": {
            "posts": posts_count,
            "comments": comments_count,
            "reviews": reviews_count,
            "joinedDays": joined_days,
        }
    }


def build_user_payload(user):
    """Return a serializable user payload for API responses with private information.
    
    This function includes private fields like email and is intended for returning
    the user's own profile data.
    
    Args:
        user: User object to serialize
        
    Returns:
        Dictionary with user data including email
    """
    payload = _build_base_user_payload(user)
    payload["email"] = user.email
    return payload


def build_public_user_payload(user):
    """Return a serializable public user payload for API responses.
    
    This function excludes private fields like email and is intended for returning
    public profile data to other users.
    
    Args:
        user: User object to serialize
        
    Returns:
        Dictionary with public user data (no email)
    """
    return _build_base_user_payload(user)

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
    # Default pronouns to 'not_specified' for new users
    Profile.objects.create(
        user=user,
        nickname=nickname,
        pronouns="not_specified",
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

    # Check if the account is active
    # 检查账户是否激活
    profile = getattr(user, 'profile', None)
    if profile and not profile.is_account_active:
        return Response({
            "message": "This account has been disabled. Please contact support for assistance.",
            "account_disabled": True
        }, status=status.HTTP_403_FORBIDDEN)

    # Fetch user with optimized stats to avoid N+1 queries
    # 获取用户时同时计算统计数据，避免 N+1 查询
    user_with_stats = get_user_with_stats(user.pk)
    if not user_with_stats:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    # success; establish session and return profile payload
    django_login(request, user)
    return Response({"success": True, "user": build_user_payload(user_with_stats)})


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
    user_with_stats = get_user_with_stats(request.user.pk)
    if not user_with_stats:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(build_user_payload(user_with_stats))


@api_view(["PATCH"])
@transaction.atomic
def update_profile(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    profile, _ = Profile.objects.get_or_create(user=request.user)
    
    # Check if user is trying to update nickname (has 14-day restriction)
    # 检查用户是否试图更新昵称（有14天限制）
    new_nickname = request.data.get('nickname')
    is_nickname_changed = (
        new_nickname is not None and 
        new_nickname != profile.nickname
    )
    
    # If changing nickname, check the 14-day restriction
    # 如果修改昵称（不同于当前昵称），检查14天限制
    if is_nickname_changed and profile.last_nickname_updated_at:
        from django.utils import timezone
        days_since_update = (timezone.now() - profile.last_nickname_updated_at).days
        if days_since_update < 14:
            days_remaining = 14 - days_since_update
            return Response({
                "message": f"Nickname can only be updated once every 14 days. Please wait {days_remaining} more day(s).",
                "days_remaining": days_remaining
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
    
    old_avatar_url = getattr(profile, 'avatar_url', '')
    serializer = ProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    try:
        new_avatar_url = getattr(profile, 'avatar_url', '')
        if old_avatar_url and old_avatar_url != new_avatar_url:
            delete_storage_object_by_url(old_avatar_url, owner_user_id=request.user.pk)
    except Exception as e:
        logger.warning(f"Failed to delete old avatar for user {request.user.pk}: {e}", exc_info=True)
    
    # Update last_nickname_updated_at if nickname was actually changed
    # 如果昵称确实被修改了，更新最后修改时间
    if is_nickname_changed:
        from django.utils import timezone
        profile.last_nickname_updated_at = timezone.now()
        profile.save(update_fields=['last_nickname_updated_at'])
    
    # Fetch user with optimized stats to avoid N+1 queries
    # 获取用户时同时计算统计数据，避免 N+1 查询
    user_with_stats = get_user_with_stats(request.user.pk)
    if not user_with_stats:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True, "user": build_user_payload(user_with_stats)})


@api_view(["GET"])
def my_posts(request):
    """Get the list of forum posts created by the current user."""
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    from forum.models import ForumPost, ForumPostLike
    from forum.serializers import ForumPostSerializer
    
    # Get user's posts with like status annotation
    posts = (
        ForumPost.objects
        .filter(author=request.user)
        .select_related("author", "author__profile")
        .prefetch_related("comments", "likes")
        .annotate(
            comments_count=Count("comments", distinct=True),
            is_liked=Exists(
                ForumPostLike.objects.filter(
                    post_id=OuterRef("id"),
                    user=request.user
                )
            )
        )
        .order_by("-created_at")
    )
    
    serializer = ForumPostSerializer(posts, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
def my_comments(request):
    """Get the list of forum comments created by the current user."""
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    from forum.models import ForumPostComment, ForumCommentLike
    from forum.serializers import ForumPostCommentSerializer
    
    # Get user's comments with related data
    comments = (
        ForumPostComment.objects
        .filter(author=request.user, is_deleted=False)
        .select_related("author", "author__profile", "post")
        .prefetch_related("likes")
        .annotate(
            replies_count=Count("replies", distinct=True),
            is_liked=Exists(
                ForumCommentLike.objects.filter(
                    comment_id=OuterRef("id"),
                    user=request.user
                )
            )
        )
        .order_by("-created_at")
    )
    
    serializer = ForumPostCommentSerializer(comments, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
def my_reviews(request):
    """Get the list of course reviews created by the current user."""
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    from courses.models import CourseReview, CourseReviewLike
    from courses.serializers import CourseReviewSerializer
    
    # Get user's reviews with like status annotation
    reviews = (
        CourseReview.objects
        .filter(author=request.user)
        .select_related("author", "author__profile", "course")
        .prefetch_related("likes")
        .annotate(
            is_liked=Exists(
                CourseReviewLike.objects.filter(
                    review_id=OuterRef("id"),
                    user=request.user
                )
            )
        )
        .order_by("-created_at")
    )
    
    serializer = CourseReviewSerializer(reviews, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
def public_user(request, user_id):
    """Get public profile information for a specific user."""
    try:
        # Fetch user with optimized stats
        user_with_stats = get_user_with_stats(user_id)
        if not user_with_stats:
            return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        
        return Response(build_public_user_payload(user_with_stats))
    except Exception as e:
        logger.error(f"Error fetching public user {user_id}: {e}")
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def public_user_posts(request, user_id):
    """Get the list of forum posts created by a specific user (if public)."""
    try:
        user = User.objects.select_related('profile').get(pk=user_id)
        profile = getattr(user, 'profile', None)
        
        # Check privacy settings
        if not getattr(profile, 'show_forum_posts_publicly', True):
            return Response({"message": "User's posts are private"}, status=status.HTTP_403_FORBIDDEN)
        
        from forum.models import ForumPost, ForumPostLike
        from forum.serializers import ForumPostSerializer
        
        posts = (
            ForumPost.objects
            .filter(author=user, is_anonymous=False)
            .select_related("author", "author__profile")
            .prefetch_related("comments", "likes")
            .annotate(comments_count=Count("comments", distinct=True))
        )
        
        # Annotate is_liked only for authenticated users
        if request.user.is_authenticated:
            posts = posts.annotate(
                is_liked=Exists(
                    ForumPostLike.objects.filter(
                        post_id=OuterRef("id"),
                        user=request.user
                    )
                )
            )
        else:
            posts = posts.annotate(is_liked=models.Value(False))
        
        posts = posts.order_by("-created_at")
        
        serializer = ForumPostSerializer(posts, many=True, context={"request": request})
        return Response(serializer.data)
    except User.DoesNotExist:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def public_user_comments(request, user_id):
    """Get the list of forum comments created by a specific user (if public)."""
    try:
        user = User.objects.select_related('profile').get(pk=user_id)
        profile = getattr(user, 'profile', None)
        
        # Check privacy settings
        if not getattr(profile, 'show_forum_post_comments_publicly', True):
            return Response({"message": "User's comments are private"}, status=status.HTTP_403_FORBIDDEN)
        
        from forum.models import ForumPostComment, ForumCommentLike
        from forum.serializers import ForumPostCommentSerializer
        
        comments = (
            ForumPostComment.objects
            .filter(author=user, is_anonymous=False, is_deleted=False)
            .select_related("author", "author__profile", "post")
            .prefetch_related("likes")
            .annotate(replies_count=Count("replies", distinct=True))
        )
        
        # Annotate is_liked only for authenticated users
        if request.user.is_authenticated:
            comments = comments.annotate(
                is_liked=Exists(
                    ForumCommentLike.objects.filter(
                        comment_id=OuterRef("id"),
                        user=request.user
                    )
                )
            )
        else:
            comments = comments.annotate(is_liked=models.Value(False))
        
        comments = comments.order_by("-created_at")
        
        serializer = ForumPostCommentSerializer(comments, many=True, context={"request": request})
        return Response(serializer.data)
    except User.DoesNotExist:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def public_user_reviews(request, user_id):
    """Get the list of course reviews created by a specific user (if public)."""
    try:
        user = User.objects.select_related('profile').get(pk=user_id)
        profile = getattr(user, 'profile', None)
        
        # Check privacy settings
        if not getattr(profile, 'show_course_reviews_publicly', True):
            return Response({"message": "User's reviews are private"}, status=status.HTTP_403_FORBIDDEN)
        
        from courses.models import CourseReview, CourseReviewLike
        from courses.serializers import CourseReviewSerializer
        
        reviews = (
            CourseReview.objects
            .filter(author=user, is_anonymous=False)
            .select_related("author", "author__profile", "course")
            .prefetch_related("likes")
        )
        
        # Annotate is_liked only for authenticated users
        if request.user.is_authenticated:
            reviews = reviews.annotate(
                is_liked=Exists(
                    CourseReviewLike.objects.filter(
                        review_id=OuterRef("id"),
                        user=request.user
                    )
                )
            )
        else:
            reviews = reviews.annotate(is_liked=models.Value(False))
        
        reviews = reviews.order_by("-created_at")
        
        serializer = CourseReviewSerializer(reviews, many=True, context={"request": request})
        return Response(serializer.data)
    except User.DoesNotExist:
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

