from __future__ import annotations

import bleach
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Profile


User = get_user_model()


def validate_and_sanitize_display_name(value: str) -> str:
    """
    Validate and sanitize display name using bleach.
    
    This function provides defense against XSS attacks by:
    1. Stripping all HTML tags (display names should be plain text)
    2. Removing control characters
    3. Validating length constraints
    
    Rules:
    - Strip leading/trailing whitespace
    - Max length: 15 characters
    - No HTML tags allowed (bleach removes them)
    - At least 1 non-whitespace character
    
    校验和消毒显示名称（使用 bleach）。
    
    此函数通过以下方式防御 XSS 攻击：
    1. 去除所有 HTML 标签（显示名称应为纯文本）
    2. 移除控制字符
    3. 验证长度限制
    
    规则：
    - 去除首尾空格
    - 最长15个字符
    - 不允许HTML标签（bleach会移除）
    - 至少包含1个非空字符
    """
    if not value:
        raise serializers.ValidationError("Display name cannot be empty.")
    
    # First, use bleach to remove all HTML tags and sanitize
    # 首先，使用 bleach 移除所有 HTML 标签并消毒
    # Display names should be plain text, so no tags are allowed
    # 显示名称应为纯文本，因此不允许任何标签
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
        raise serializers.ValidationError("Display name cannot be empty or only whitespace.")
    
    # Check maximum length
    # 检查最大长度
    if len(sanitized) > 15:
        raise serializers.ValidationError("Display name must be 15 characters or less.")
    
    return sanitized


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
        fields = ["user_id", "display_name", "avatar_url", "pronouns", "show_forum_posts_publicly", "show_forum_post_comments_publicly", "show_course_reviews_publicly"]
    
    def validate_display_name(self, value):
        """Validate and sanitize display name field, check uniqueness."""
        if value is not None and value != '':
            # First, validate and sanitize the value
            # 首先，验证和消毒值
            sanitized_value = validate_and_sanitize_display_name(value)
            
            # Check uniqueness (exclude current user's profile)
            # 检查唯一性（排除当前用户的资料）
            current_user = self.context.get('request').user if self.context.get('request') else None
            if current_user:
                existing = Profile.objects.filter(display_name=sanitized_value).exclude(user=current_user).first()
                if existing:
                    raise serializers.ValidationError("This display name is already taken. Please choose another one.")
            
            return sanitized_value
        return value


class SendCodeSerializer(serializers.Serializer):
    """Request body for sending a verification code."""

    email = serializers.EmailField()


class RegisterSerializer(serializers.Serializer):
    """Request body for the register endpoint.

    Fields:
    - nickname: display name (max 15 characters after sanitization)
    - email: university email (frontend restricts to @connect.polyu.hk)
    - verification_code: email verification code
    - password: password
    """

    nickname = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    verification_code = serializers.CharField(max_length=16)
    password = serializers.CharField(write_only=True)
    
    def validate_nickname(self, value):
        """Validate and sanitize nickname (used as display name), check uniqueness."""
        # Validate and sanitize
        # 验证和消毒
        sanitized_value = validate_and_sanitize_display_name(value)
        
        # Check uniqueness for registration
        # 检查注册时的唯一性
        if Profile.objects.filter(display_name=sanitized_value).exists():
            raise serializers.ValidationError("This display name is already taken. Please choose another one.")
        
        return sanitized_value


class LoginSerializer(serializers.Serializer):
    """Request body for login endpoint.

    Fields:
    - email: user email
    - password: user password
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
