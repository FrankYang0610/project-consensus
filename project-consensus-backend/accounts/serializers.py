from __future__ import annotations

import bleach
from django.contrib.auth import get_user_model
from rest_framework import serializers
from core.validators import validate_https_url_in_allowed_hosts

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
        raise serializers.ValidationError("Nickname cannot be empty.")
    
    # First, use bleach to remove all HTML tags and sanitize
    # Nicknames should be plain text, so no tags are allowed
    sanitized = bleach.clean(
        value,
        tags=[],  # No HTML tags allowed / 不允许任何 HTML 标签
        attributes={},  # No attributes allowed / 不允许任何属性
        protocols=[],  # No protocols needed / 不需要任何协议
        strip=True  # Strip disallowed tags / 去除不允许的标签
    )
    
    # Strip whitespace after bleach cleaning
    # bleach 清理后去除首尾空格
    sanitized = sanitized.strip()
    
    # Check minimum length (after sanitization)
    # 检查最小长度（消毒后）
    if not sanitized:
        raise serializers.ValidationError("Nickname cannot be empty or only whitespace.")
    
    # Check maximum length
    # 检查最大长度
    if len(sanitized) > 15:
        raise serializers.ValidationError("Nickname must be 15 characters or less.")
    
    return sanitized


def validate_polyu_email(value: str) -> str:
    """
    Validate that email is from PolyU domain.
    
    Rules:
    - Must end with @connect.polyu.hk
    - Returns lowercase version for consistency
    
    校验邮箱是否来自理大域名。
    
    规则：
    - 必须以 @connect.polyu.hk 结尾
    - 返回小写版本以保持一致性
    """
    if not value.lower().endswith('@connect.polyu.hk'):
        raise serializers.ValidationError(
            "Only PolyU email addresses (@connect.polyu.hk) are allowed."
        )
    return value.lower()


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
        if value is not None and value != '':
            # First, validate and sanitize the value
            # 首先，验证和消毒值
            sanitized_value = validate_and_sanitize_nickname(value)
            
            # Check uniqueness (exclude current user's profile)
            # 检查唯一性（排除当前用户的资料）
            request = self.context.get('request')
            if not request:
                raise serializers.ValidationError("Request context is required for nickname validation.")
            
            current_user = request.user
            if not current_user or not current_user.is_authenticated:
                raise serializers.ValidationError("Authentication is required to update nickname.")
            
            existing = Profile.objects.filter(nickname=sanitized_value).exclude(user=current_user).first()
            if existing:
                raise serializers.ValidationError("This nickname is already taken. Please choose another one.")
            
            return sanitized_value
        return value


class SendCodeSerializer(serializers.Serializer):
    """Request body for sending a verification code."""

    email = serializers.EmailField()
    
    def validate_email(self, value):
        """Validate that email is from PolyU domain."""
        return validate_polyu_email(value)


class RegisterSerializer(serializers.Serializer):
    """Request body for the register endpoint.

    Fields:
    - nickname: nickname (max 15 characters after sanitization)
    - email: university email (must be @connect.polyu.hk)
    - verification_code: email verification code
    - password: password
    """

    nickname = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    verification_code = serializers.CharField(max_length=16)
    password = serializers.CharField(write_only=True)
    
    def validate_email(self, value):
        """Validate that email is from PolyU domain."""
        return validate_polyu_email(value)
    
    def validate_nickname(self, value):
        """Validate and sanitize nickname, check uniqueness."""
        # Validate and sanitize
        # 验证和消毒
        sanitized_value = validate_and_sanitize_nickname(value)
        
        # Check uniqueness for registration
        # 检查注册时的唯一性
        if Profile.objects.filter(nickname=sanitized_value).exists():
            raise serializers.ValidationError("This nickname is already taken. Please choose another one.")
        
        return sanitized_value


class LoginSerializer(serializers.Serializer):
    """Request body for login endpoint.

    Fields:
    - email: user email (must be @connect.polyu.hk)
    - password: user password
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate_email(self, value):
        """Validate that email is from PolyU domain."""
        return validate_polyu_email(value)
