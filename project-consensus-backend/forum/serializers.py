from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Profile
from accounts.serializers import AuthorSerializer
from .models import ForumPost, ForumPostComment


User = get_user_model()


def _author_payload_for(user) -> dict:
    """Build an Author dict compatible with the frontend type.

    Prefer Profile.display_name / avatar_url; fallback to username.
    """

    try:
        profile: Profile = user.profile  # type: ignore[attr-defined]
        return profile.author_payload
    except Profile.DoesNotExist:  # pragma: no cover - 正常线上用户会携带 Profile
        return {"id": str(user.pk), "name": user.get_username(), "avatar": None}


class ForumPostSerializer(serializers.ModelSerializer):
    """Serializer for forum posts.

    Extra fields:
    - author: nested Author payload
    - likes: integer from likes_count
    - comments: computed comment count
    - isLiked: session-related; fixed False here (can be wired to Like model)
    """

    author = serializers.SerializerMethodField()
    likes = serializers.IntegerField(source="likes_count", read_only=True)
    comments = serializers.SerializerMethodField()
    isLiked = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "content",
            "author",
            "createdAt",
            "tags",
            "likes",
            "comments",
            "isLiked",
            "language",
        ]
        read_only_fields = ["id", "createdAt", "author"]

    def get_author(self, obj: ForumPost) -> dict:
        return _author_payload_for(obj.author)

    def get_comments(self, obj: ForumPost) -> int:
        return obj.comments.count()

    def get_isLiked(self, obj: ForumPost) -> bool:  # session-level, default False
        return False


class ForumPostCommentSerializer(serializers.ModelSerializer):
    """Serializer for forum comments (compatible with frontend type)."""

    author = serializers.SerializerMethodField()
    replyToUser = serializers.SerializerMethodField()
    likes = serializers.IntegerField(source="likes_count", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    parentId = serializers.UUIDField(source="parent_id", allow_null=True, required=False)
    postId = serializers.UUIDField(source="post_id")
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)

    class Meta:
        model = ForumPostComment
        fields = [
            "id",
            "content",
            "author",
            "createdAt",
            "likes",
            "isDeleted",
            "parentId",
            "postId",
            "replyToUser",
        ]
        extra_kwargs = {}
        read_only_fields = ["id", "createdAt", "author", "replyToUser", "isDeleted", "likes"]

    def get_author(self, obj: ForumPostComment) -> dict:
        return _author_payload_for(obj.author)

    def get_replyToUser(self, obj: ForumPostComment):
        if obj.reply_to_user_id:
            return _author_payload_for(obj.reply_to_user)  # type: ignore[arg-type]
        return None
