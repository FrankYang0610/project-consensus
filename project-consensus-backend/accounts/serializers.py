from __future__ import annotations

import bleach
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as dj_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from core.validators import validate_https_url_in_allowed_hosts
from accounts import error_codes
from .models import Profile


User = get_user_model()


def validate_and_sanitize_nickname(value: str) -> str:
    """
    Validate and sanitize nickname using bleach.
    
    This function provides defense against XSS attacks by:
    1. Stripping all HTML tags (nicknames should be plain text)
    2. Removing control characters
    3. Validating length constraints
    
    Rules:
    - Strip leading/trailing whitespace
    - Max length: 15 characters
    - No HTML tags allowed (bleach removes them)
    - At least 1 non-whitespace character
    """
    if not value:
        raise serializers.ValidationError(error_codes.NICKNAME_REQUIRED)
    
    # First, use bleach to remove all HTML tags and sanitize
    # Nicknames should be plain text, so no tags are allowed
    sanitized = bleach.clean(
        value,
        tags=[],            # No HTML tags allowed
        attributes={},      # No attributes allowed
        protocols=[],       # No protocols needed
        strip=True          # Strip disallowed tags
    )
    
    # Strip whitespace after bleach cleaning
    sanitized = sanitized.strip()
    
    # Check minimum length (after sanitization)
    if not sanitized:
        raise serializers.ValidationError(error_codes.NICKNAME_REQUIRED)
    
    # Check maximum length
    if len(sanitized) > 15:
        raise serializers.ValidationError(error_codes.NICKNAME_TOO_LONG)
    
    return sanitized


def validate_password_with_django(value: str) -> str:
    """
    Validate password strength using Django's validators and map errors
    to API-level i18n error codes.
    """
    try:
        dj_validate_password(value)
    except DjangoValidationError as e:
        error_codes_list = [error_codes.map_django_password_error(msg) for msg in e.messages]
        raise serializers.ValidationError(error_codes_list)
    return value


class AuthorSerializer(serializers.Serializer):
    """Generic serializer for the frontend Author type.

    Fields:
    - id: str
    - name: str
    - avatar: str | null
    """

    id = serializers.CharField()
    name = serializers.CharField()
    avatar = serializers.CharField(allow_null=True, allow_blank=True, required=False)


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for the Profile model (for user profile APIs)."""

    # Allow empty string for avatar_url so users can clear it
    # and avoid validation errors when only updating pronouns.
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Profile
        fields = ["user_id", "nickname", "avatar_url", "pronouns", "show_forum_posts_publicly", "show_forum_post_comments_publicly", "show_course_reviews_publicly"]
    
    def validate_avatar_url(self, value: str) -> str:
        return validate_https_url_in_allowed_hosts(value)

    def validate_nickname(self, value):
        """Validate and sanitize nickname field, check uniqueness."""
        # Always sanitize and validate when field is present in input.
        sanitized_value = validate_and_sanitize_nickname(value)

        # Check uniqueness (exclude current user's profile)
        # 检查唯一性（排除当前用户的资料）
        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError(error_codes.AUTHENTICATION_REQUIRED)

        current_user = request.user
        if not current_user or not current_user.is_authenticated:
            raise serializers.ValidationError(error_codes.AUTHENTICATION_REQUIRED)

        existing = Profile.objects.filter(nickname=sanitized_value).exclude(user=current_user).first()
        if existing:
            raise serializers.ValidationError(error_codes.NICKNAME_ALREADY_TAKEN)

        return sanitized_value


class SendCodeSerializer(serializers.Serializer):
    """Request body for sending a verification code."""

    email = serializers.EmailField(
        error_messages={
            "invalid": error_codes.EMAIL_INVALID,
            "required": error_codes.EMAIL_REQUIRED,
        }
    )


class RegisterSerializer(serializers.Serializer):
    """Request body for the register endpoint.

    Fields:
    - nickname: nickname (max 15 characters after sanitization)
    - email: email address
    - verification_code: email verification code
    - password: password
    """

    nickname = serializers.CharField(max_length=100, required=True)
    email = serializers.EmailField(
        required=True,
        error_messages={
            "invalid": error_codes.EMAIL_INVALID,
            "required": error_codes.EMAIL_REQUIRED,
        },
    )
    verification_code = serializers.RegexField(regex=r'^\d{6}$', max_length=6, min_length=6, required=True)
    password = serializers.CharField(write_only=True, required=True)
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    def validate_nickname(self, value):
        """Validate and sanitize nickname, check uniqueness."""
        # Validate and sanitize
        sanitized_value = validate_and_sanitize_nickname(value)
        
        # Check uniqueness for registration
        if Profile.objects.filter(nickname=sanitized_value).exists():
            raise serializers.ValidationError(error_codes.NICKNAME_ALREADY_TAKEN)
        
        return sanitized_value

    def validate_password(self, value):
        """Validate password strength using Django's password validators."""
        return validate_password_with_django(value)

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')
        if password_confirm != password:
            raise serializers.ValidationError({"password_confirm": error_codes.PASSWORD_MISMATCH})
        return attrs


class LoginSerializer(serializers.Serializer):
    """Request body for login endpoint.

    Fields:
    - email: user email
    - password: user password
    """

    email = serializers.EmailField(
        error_messages={
            "invalid": error_codes.EMAIL_INVALID,
            "required": error_codes.EMAIL_REQUIRED,
        }
    )
    password = serializers.CharField(write_only=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    """Request body for password reset request endpoint.
    
    Fields:
    - email: user email
    
    Note: This serializer does not check if the email exists in the database
    to prevent user enumeration attacks. The view will handle this silently.
    """
    
    email = serializers.EmailField(
        required=True,
        error_messages={
            "invalid": error_codes.EMAIL_INVALID,
            "required": error_codes.EMAIL_REQUIRED,
        },
    )


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Request body for password reset confirmation endpoint.
    
    Fields:
    - uid: base64 encoded user ID
    - token: password reset token
    - session_id: per-request session identifier from the reset email link
    - new_password: new password
    - new_password_confirm: password confirmation
    """
    
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    session_id = serializers.CharField(required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)
    
    def validate_new_password(self, value):
        """Validate password strength using Django's password validators."""
        return validate_password_with_django(value)
    
    def validate(self, attrs):
        """Validate that both passwords match."""
        new_password = attrs.get('new_password')
        new_password_confirm = attrs.get('new_password_confirm')
        
        if new_password != new_password_confirm:
            raise serializers.ValidationError({
                "new_password_confirm": error_codes.PASSWORD_MISMATCH
            })
        
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    """
    Request body for authenticated password change endpoint.
    
    Fields:
    - current_password: user's existing password (for verification)
    - new_password: new password
    - new_password_confirm: password confirmation
    """

    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)

    def validate_current_password(self, value: str) -> str:
        """
        Ensure the provided current password matches the authenticated user.
        """
        request = self.context.get("request")
        user = request.user if request is not None else None

        if not user or not user.is_authenticated:
            raise serializers.ValidationError(error_codes.AUTHENTICATION_REQUIRED)

        if not user.check_password(value):
            # Reuse existing i18n key for invalid credentials.
            raise serializers.ValidationError("auth.invalidCredentials")

        return value

    def validate_new_password(self, value: str) -> str:
        """
        Defer password strength validation to `validate`.

        We intentionally do NOT run Django's password validators here so that
        strength checks (too short / too common / entirely numeric, etc.)
        only execute after the current password has been verified as correct.
        """
        return value

    def validate(self, attrs):
        """
        Combined validation for new password fields.

        This method is only called after all field-level validation has
        succeeded (including `validate_current_password`). That means if the
        current password is incorrect, we short‑circuit and *do not* perform
        any new password checks.

        Responsibilities:
        - Ensure `new_password` and `new_password_confirm` match.
        - Ensure the new password is not identical to the current password.
        - Run Django's password validators and surface *all* mapped i18n
          error codes (tooShort / tooCommon / entirelyNumeric / tooSimilar).
        """
        request = self.context.get("request")
        user = request.user if request is not None else None

        new_password = attrs.get("new_password")
        new_password_confirm = attrs.get("new_password_confirm")

        errors: dict[str, list[str]] = {}

        # Ensure the confirmation matches
        if new_password != new_password_confirm:
            errors.setdefault("new_password_confirm", []).append(
                error_codes.PASSWORD_MISMATCH
            )

        # Prevent reusing the same password
        if user and user.is_authenticated and new_password and user.check_password(new_password):
            errors.setdefault("new_password", []).append(
                error_codes.PASSWORD_SAME_AS_OLD
            )

        # Run Django's password validators to collect strength errors
        if new_password:
            try:
                validate_password_with_django(new_password)
            except serializers.ValidationError as exc:
                detail = exc.detail
                if isinstance(detail, (list, tuple)):
                    errors.setdefault("new_password", []).extend(
                        [str(code) for code in detail]
                    )
                else:
                    errors.setdefault("new_password", []).append(str(detail))

        if errors:
            # Raise all collected errors at once so the frontend can display
            # every relevant password rule violation together.
            raise serializers.ValidationError(errors)

        return attrs

    def save(self, **kwargs):
        """
        Persist the new password for the authenticated user.

        The view layer is responsible for enforcing authentication via
        DRF permission classes; this method focuses purely on data changes.
        """
        request = self.context.get("request")
        user = request.user if request is not None else None

        if not user or not user.is_authenticated:
            # Defensive guard; normally enforced by IsAuthenticated on the view.
            raise serializers.ValidationError(error_codes.AUTHENTICATION_REQUIRED)

        user.set_password(self.validated_data["new_password"])
        user.save()
        return user


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for the current user, matching the frontend `User` type.
    Produces the same shape as the previous `build_user_payload` helper.
    """

    id = serializers.CharField(source="pk", read_only=True)
    name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    pronouns = serializers.SerializerMethodField()
    showForumPostsPublicly = serializers.SerializerMethodField()
    showForumPostCommentsPublicly = serializers.SerializerMethodField()
    showCourseReviewsPublicly = serializers.SerializerMethodField()
    isAccountActive = serializers.SerializerMethodField()
    lastProfileUpdatedAt = serializers.SerializerMethodField()
    daysUntilNextUpdate = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "avatar", "pronouns",
            "showForumPostsPublicly", "showForumPostCommentsPublicly",
            "showCourseReviewsPublicly", "isAccountActive",
            "lastProfileUpdatedAt", "daysUntilNextUpdate", "stats",
        ]
        read_only_fields = fields

    def _get_profile(self, obj: User) -> Profile | None:
        """Return related profile if present, otherwise None."""
        try:
            return obj.profile
        except Profile.DoesNotExist:
            return None

    def get_name(self, obj: User) -> str:
        profile = self._get_profile(obj)
        if profile and profile.nickname:
            return profile.nickname
        return obj.get_username()

    def get_avatar(self, obj: User) -> str | None:
        profile = self._get_profile(obj)
        if not profile:
            return None
        return profile.avatar_url or None

    def get_pronouns(self, obj: User) -> str:
        """Return pronouns, defaulting to 'prefer_not_to_say' when empty."""
        profile = self._get_profile(obj)
        pronouns = profile.pronouns if profile else None
        return pronouns or "prefer_not_to_say"

    def get_showForumPostsPublicly(self, obj: User) -> bool:
        profile = self._get_profile(obj)
        return profile.show_forum_posts_publicly if profile else True

    def get_showForumPostCommentsPublicly(self, obj: User) -> bool:
        profile = self._get_profile(obj)
        return profile.show_forum_post_comments_publicly if profile else True

    def get_showCourseReviewsPublicly(self, obj: User) -> bool:
        profile = self._get_profile(obj)
        return profile.show_course_reviews_publicly if profile else True

    def get_isAccountActive(self, obj: User) -> bool:
        profile = self._get_profile(obj)
        return profile.is_account_active if profile else True

    def get_lastProfileUpdatedAt(self, obj: User) -> str | None:
        profile = self._get_profile(obj)
        last_updated = profile.last_nickname_updated_at if profile else None
        return last_updated.isoformat() if last_updated else None

    def get_daysUntilNextUpdate(self, obj: User) -> int | None:
        """
        Return remaining days before nickname can be updated again.
        Mirrors the cooldown rule previously implemented in the view.
        """
        profile = self._get_profile(obj)
        if not profile:
            return None

        return profile.days_until_nickname_update_allowed()
    
    def get_stats(self, obj: User) -> dict:
        """
        Return per-user activity stats from the profile.
        """
        profile = self._get_profile(obj)
        forum_posts_count = profile.forum_posts_count if profile else 0
        forum_post_comments_count = profile.forum_post_comments_count if profile else 0
        course_reviews_count = profile.course_reviews_count if profile else 0

        joined_days = 0
        if obj.date_joined:
            joined_days = (timezone.now() - obj.date_joined).days

        return {
            "forumPostsCount": forum_posts_count,
            "forumPostCommentsCount": forum_post_comments_count,
            "courseReviewsCount": course_reviews_count,
            "joinedDays": joined_days,
        }


class PublicUserSerializer(UserDetailSerializer):
    """
    Read-only serializer for public user profile responses.
    Same as `UserDetailSerializer` but without the email field.
    """

    class Meta(UserDetailSerializer.Meta):
        model = User
        fields = [
            "id", "name", "avatar", "pronouns",
            "showForumPostsPublicly", "showForumPostCommentsPublicly",
            "showCourseReviewsPublicly", "isAccountActive",
            "lastProfileUpdatedAt", "daysUntilNextUpdate", "stats",
        ]
        read_only_fields = fields
