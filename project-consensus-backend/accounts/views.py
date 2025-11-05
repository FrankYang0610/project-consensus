from __future__ import annotations

import secrets
import hashlib
import hmac

from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.password_validation import validate_password as dj_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.sessions.models import Session
from django.conf import settings
import logging
from django.db import transaction, models
from django.core.cache import cache
from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import AnonRateThrottle
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.http import HttpRequest
from rest_framework.pagination import PageNumberPagination
from django.utils.translation import get_language_from_request
from rest_framework import permissions

from .models import Profile
from core.utils import delete_storage_object_by_url
from .serializers import (
    SendCodeSerializer, 
    RegisterSerializer, 
    LoginSerializer, 
    ProfileSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer
)
from .services.email_service import EmailService
from .tasks import send_verification_email_async, send_password_reset_email_async
from . import error_codes


User = get_user_model()
logger = logging.getLogger(__name__)


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


def annotate_user_stats(queryset):
    """Add user statistics annotations to a User queryset to avoid N+1 queries.
    
    Usage examples:
        # Single user
        user = annotate_user_stats(User.objects.filter(pk=user_id)).first()
        
        # Multiple users
        users = annotate_user_stats(User.objects.all())
    
    This function adds statistics fields to the user queryset to avoid N+1 queries.
    """
    return queryset.select_related('profile').annotate(
        posts_count=Count('forum_posts', distinct=True),
        comments_count=Count('forum_comments', distinct=True),
        reviews_count=Count('course_reviews', distinct=True)
    )


def get_user_with_stats(user_id):
    """Fetch a single user with optimized stats to avoid N+1 queries.
    
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
        delta = timezone.now() - user.date_joined
        joined_days = delta.days
    
    # Calculate days until next nickname update is allowed
    days_until_next_update = None
    last_updated = getattr(profile, "last_nickname_updated_at", None)
    if last_updated:
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
@throttle_classes([VerificationCodeRateThrottle])
def send_verification_code(request):
    """
    Generate a verification code and store it in cache (TTL), then (in real life) send email.

    Body: { "email": string }
    """
    serializer = SendCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()

    # throttle: allow only one request per configured window per email
    request_interval = getattr(settings, "AUTH_VERIFICATION_REQUEST_INTERVAL_SECONDS", 90)
    throttle_key = f"accounts:verify:throttle:{email}"
    if cache.get(throttle_key):
        # Use i18n error code; frontend maps 429 to a localized message too
        return Response({"message": "auth.errorTooManyAttempts"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    # If the email is already registered, do not actually send an email.
    # Return a generic success response and set the throttle to avoid spam/enumeration.
    if User.objects.filter(email=email).exists():
        cache.set(throttle_key, True, timeout=request_interval)
        logger.info(
            "Verification code requested for existing account; suppressed sending",
            extra={"email": email}
        )
        return Response({
            "success": True,
            "email": email,
            "resend_after_seconds": request_interval,
        }, status=status.HTTP_200_OK)

    code = f"{secrets.randbelow(10**6):06d}"  # 6-digit numeric
    ttl_seconds = getattr(settings, "AUTH_VERIFICATION_CODE_TTL_SECONDS", 60 * 15)
    code_key = f"accounts:verify:code:{email}"
    cache.set(code_key, hashlib.sha256(code.encode('utf-8')).hexdigest(), timeout=ttl_seconds)
    cache.set(throttle_key, True, timeout=request_interval)
    # Reset attempt counter when issuing a new code
    attempt_key = f"accounts:verify:attempts:{email}"
    cache.delete(attempt_key)

    # Send verification code via email
    if getattr(settings, 'EMAIL_ENABLED', False):
        language = get_language_from_request(request)
        # Use Django's get_language_from_request to determine the user's language.
        # This follows Django's language negotiation conventions and is more robust than manual parsing of HTTP_ACCEPT_LANGUAGE.
        use_async = getattr(settings, 'EMAIL_USE_CELERY', False)
        
        if use_async:
            # Asynchronous sending via Celery (recommended for production)
            try:
                send_verification_email_async.delay(
                    email=email,
                    code=code,
                    language=language,
                    ttl_minutes=ttl_seconds // 60
                )
                logger.info(
                    "Verification email task queued successfully",
                    extra={"email": email, "async": True}
                )
            except Exception as e:
                # If Celery task queuing fails, log error but don't block user
                # The verification code is still stored in cache and valid
                logger.error(
                    "Failed to queue verification email task",
                    exc_info=True,
                    extra={"email": email, "error_type": type(e).__name__}
                )
                # Fallback: try synchronous send immediately so the user still receives the email
                try:
                    email_service = EmailService()
                    email_service.send_verification_code(
                        email=email,
                        code=code,
                        language=language,
                        ttl_minutes=ttl_seconds // 60
                    )
                    logger.info(
                        "Fallback to synchronous email succeeded",
                        extra={"email": email, "async": False, "fallback": True}
                    )
                except Exception as ee:
                    logger.error(
                        "Fallback synchronous email failed",
                        exc_info=True,
                        extra={"email": email, "error_type": type(ee).__name__}
                    )
        else:
            # Synchronous sending (fallback or development)
            try:
                email_service = EmailService()
                email_service.send_verification_code(
                    email=email,
                    code=code,
                    language=language,
                    ttl_minutes=ttl_seconds // 60
                )
                logger.info(
                    "Verification email sent successfully",
                    extra={"email": email, "async": False}
                )
            except Exception as e:
                # Log error but don't block the user flow
                # The verification code is still stored in cache and valid
                logger.error(
                    "Failed to send verification email",
                    exc_info=True,
                    extra={"email": email, "error_type": type(e).__name__}
                )
    else:
        # Development mode: log the code
        logger.warning(
            "[DEV MODE] Email disabled. Verification code for %s: %s",
            email, code
        )

    return Response({
        "success": True,
        "email": email,
        "resend_after_seconds": request_interval,
    }, status=status.HTTP_200_OK)


@api_view(["POST"])
@throttle_classes([RegisterRateThrottle])
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

    max_attempts = getattr(settings, "AUTH_VERIFICATION_MAX_ATTEMPTS", 5)
    attempt_key = f"accounts:verify:attempts:{email}"
    attempts = cache.get(attempt_key, 0)
    if attempts >= max_attempts:
        return Response({"message": "validation.verificationCode.tooManyAttempts"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    code_key = f"accounts:verify:code:{email}"
    expected_digest = cache.get(code_key)
    provided_digest = hashlib.sha256(code.encode('utf-8')).hexdigest()
    if not expected_digest or not hmac.compare_digest(str(expected_digest), str(provided_digest)):
        ttl_seconds = getattr(settings, "AUTH_VERIFICATION_CODE_TTL_SECONDS", 60 * 15)
        cache.set(attempt_key, attempts + 1, timeout=ttl_seconds)
        # DRF-style field error for better UX
        return Response({"verification_code": ["validation.verificationCode.invalidOrExpired"]}, status=status.HTTP_400_BAD_REQUEST)

    # Check if email already exists
    if User.objects.filter(email=email).exists():
        return Response({"email": ["validation.email.alreadyRegistered"]}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=email, email=email, password=password)
    # Default pronouns to 'not_specified' for new users
    Profile.objects.create(
        user=user,
        nickname=nickname,
        pronouns="not_specified",
    )

    # Invalidate the code to prevent reuse
    cache.delete(code_key)
    cache.delete(attempt_key)

    # Log the user in to establish a server-side session
    django_login(request, user)
    return Response({"success": True, "user": build_user_payload(user)}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@ensure_csrf_cookie
def csrf(request):
    """Ensure a CSRF cookie is set on the client."""
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
    profile = getattr(user, 'profile', None)
    if profile and not profile.is_account_active:
        return Response({
            "message": "auth.errorAccountDisabled",
            "account_disabled": True
        }, status=status.HTTP_403_FORBIDDEN)

    # Fetch user with optimized stats to avoid N+1 queries
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
    new_nickname = request.data.get('nickname')
    is_nickname_changed = (
        new_nickname is not None and 
        new_nickname != profile.nickname
    )
    
    # If changing nickname, check the 14-day restriction
    if is_nickname_changed and profile.last_nickname_updated_at:
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
    if is_nickname_changed:
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

    # Per-email throttle to mitigate abuse
    request_interval = getattr(settings, "PASSWORD_RESET_REQUEST_INTERVAL_SECONDS", 300)
    throttle_key = f"accounts:pwdreset:throttle:{email}"
    if cache.get(throttle_key):
        return Response({"message": error_codes.AUTH_TOO_MANY_ATTEMPTS}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    # Set throttle regardless of whether user exists to avoid enumeration timing
    cache.set(throttle_key, True, timeout=request_interval)
    
    # Get normalized language using Django negotiation
    language = get_language_from_request(request)
    
    # Check if user exists (but don't reveal this information to the client)
    try:
        user = User.objects.get(email=email)
        user_exists = True
    except User.DoesNotExist:
        user_exists = False
        # Log attempt for security monitoring
        logger.info(
            "Password reset requested for non-existent email",
            extra={"email": email}
        )
    
    # Send email only if user exists
    if user_exists:
        # Generate password reset token
        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # Build reset link (normalize base URL to avoid double slashes)
        frontend_base_url = getattr(settings, 'FRONTEND_BASE_URL', 'https://polyu.life').rstrip('/')
        reset_link = f"{frontend_base_url}/reset-password?uid={uid}&token={token}"
        
        # Calculate timeout in hours
        timeout_seconds = getattr(settings, 'PASSWORD_RESET_TIMEOUT', 3600)
        timeout_hours = timeout_seconds // 3600
        
        # Send password reset email
        if getattr(settings, 'EMAIL_ENABLED', False):
            use_async = getattr(settings, 'EMAIL_USE_CELERY', False)
            
            if use_async:
                # Asynchronous sending via Celery
                try:
                    send_password_reset_email_async.delay(
                        email=email,
                        reset_link=reset_link,
                        language=language,
                        timeout_hours=timeout_hours
                    )
                    logger.info(
                        "Password reset email task queued successfully",
                        extra={"email": email, "async": True}
                    )
                except Exception as e:
                    # Fallback to synchronous if Celery fails
                    logger.error(
                        "Failed to queue password reset email task",
                        exc_info=True,
                        extra={"email": email, "error_type": type(e).__name__}
                    )
                    try:
                        email_service = EmailService()
                        email_service.send_password_reset(
                            email=email,
                            reset_link=reset_link,
                            language=language,
                            timeout_hours=timeout_hours
                        )
                        logger.info(
                            "Fallback to synchronous password reset email succeeded",
                            extra={"email": email, "async": False, "fallback": True}
                        )
                    except Exception as ee:
                        logger.error(
                            "Fallback synchronous password reset email failed",
                            exc_info=True,
                            extra={"email": email, "error_type": type(ee).__name__}
                        )
            else:
                # Synchronous sending
                try:
                    email_service = EmailService()
                    email_service.send_password_reset(
                        email=email,
                        reset_link=reset_link,
                        language=language,
                        timeout_hours=timeout_hours
                    )
                    logger.info(
                        "Password reset email sent successfully",
                        extra={"email": email, "async": False}
                    )
                except Exception as e:
                    logger.error(
                        "Failed to send password reset email",
                        exc_info=True,
                        extra={"email": email, "error_type": type(e).__name__}
                    )
        else:
            # Development mode: log the reset link
            logger.warning(
                "[DEV MODE] Email disabled. Password reset link for %s: %s",
                email, reset_link
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
    new_password = serializer.validated_data["new_password"]
    
    # Decode user ID
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({
            "message": error_codes.PASSWORD_RESET_INVALID_OR_EXPIRED
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check token validity
    token_generator = PasswordResetTokenGenerator()
    if not token_generator.check_token(user, token):
        return Response({
            "message": error_codes.PASSWORD_RESET_INVALID_OR_EXPIRED
        }, status=status.HTTP_400_BAD_REQUEST)

    # Validate password strength again with user context (ensures similarity checks)
    try:
        dj_validate_password(new_password, user=user)
    except DjangoValidationError as e:
        error_codes_list = [error_codes.map_django_password_error(msg) for msg in e.messages]
        return Response({
            "new_password": error_codes_list
        }, status=status.HTTP_400_BAD_REQUEST)

    # Set new password
    user.set_password(new_password)
    user.save()

    # Invalidate existing sessions for this user only (security best practice)
    # This forces the user to log in again with the new password
    try:
        active_sessions = Session.objects.filter(expire_date__gte=timezone.now())
        for session in active_sessions:
            data = session.get_decoded()
            if str(data.get('_auth_user_id')) == str(user.pk):
                session.delete()
    except Exception as e:
        # Do not fail password reset if session cleanup encounters an error; log and continue
        logger.warning(
            "Failed to invalidate user sessions after password reset",
            extra={"user_id": user.pk, "error": str(e), "error_type": type(e).__name__},
            exc_info=True
        )

    logger.info(
        "Password reset successful",
        extra={"user_id": user.pk, "email": user.email}
    )
    
    return Response({
        "success": True,
        "message": error_codes.PASSWORD_RESET_SUCCESS
    }, status=status.HTTP_200_OK)

