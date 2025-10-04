from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Profile


User = get_user_model()


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
        fields = ["user_id", "display_name", "avatar_url", "pronouns", "pronouns_shared", "show_forum_posts_publicly", "show_forum_post_comments_publicly", "show_course_reviews_publicly"]


class SendCodeSerializer(serializers.Serializer):
    """Request body for sending a verification code."""

    email = serializers.EmailField()


class RegisterSerializer(serializers.Serializer):
    """Request body for the register endpoint.

    Fields:
    - nickname: display name
    - email: university email (frontend restricts to @connect.polyu.hk)
    - verification_code: email verification code
    - password: password
    """

    nickname = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    verification_code = serializers.CharField(max_length=16)
    password = serializers.CharField(write_only=True)


class LoginSerializer(serializers.Serializer):
    """Request body for login endpoint.

    Fields:
    - email: user email
    - password: user password
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
