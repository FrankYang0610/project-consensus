from __future__ import annotations

import bleach
from rest_framework import serializers
from typing import override

from accounts.models import Profile
from .models import ForumPost, ForumPostComment
from .utils import generate_anonymous_id


# Forum-specific allowlist: more permissive than courses to support richer content
# 论坛专用白名单：比课程评论更宽松，支持更丰富的内容
ALLOWED_TAGS = [
    # Basic formatting (same as courses)
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'code', 'pre', 'blockquote',
    # Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    # Additional formatting for forum posts
    'div', 'span', 'hr', 'del', 'ins', 'u', 's', 'sub', 'sup',
    # Links and images (forum-specific)
    'a', 'img',
]

ALLOWED_ATTRS: dict[str, list[str]] = {
    # Table attributes
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align'],
    # Code syntax highlighting
    'code': ['class'],
    'pre': ['class'],
    # Ordered list
    'ol': ['start'],
    # Links (forum-specific)
    'a': ['href', 'title', 'target', 'rel'],
    # Images (forum-specific)
    'img': ['src', 'alt', 'title', 'width', 'height'],
    # Alignment and styling (limited)
    'div': ['class'],
    'span': ['class'],
}

ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']


def _sanitize_html(html: str) -> str:
    """Sanitize HTML content using bleach with forum-specific allowlist.
    
    This function provides defense against XSS attacks by only allowing
    safe HTML tags and attributes defined in the allowlist above.
    
    Args:
        html: Raw HTML string from user input
        
    Returns:
        Sanitized HTML string safe for rendering
    """
    if not isinstance(html, str):
        return ""
    return bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True
    )


def _author_payload_for(user) -> dict:
    """Build an Author dict compatible with the frontend type.

    Prefer Profile.nickname / avatar_url; fallback to username.
    """

    try:
        profile: Profile = user.profile  # type: ignore[attr-defined]
        return profile.author_payload
    except Profile.DoesNotExist:  # pragma: no cover - 正常线上用户会携带 Profile
        return {"id": str(user.pk), "name": user.get_username(), "avatar": None}


def _generate_anonymous_id() -> str:
    """Backwards-compatible wrapper for generating anonymous ids."""
    return generate_anonymous_id()


class ForumPostSerializer(serializers.ModelSerializer):
    """Serializer for forum posts.

    Extra fields:
    - author: nested Author payload
    - likes: integer from likes_count
    - comments: computed comment count
    - isLiked: session-related; fixed False here (can be wired to Like model)
    
    Security note: HTML content is sanitized on both write (create/update) and read (to_representation)
    to provide defense-in-depth against XSS attacks.
    """

    author = serializers.SerializerMethodField()
    likesCount = serializers.IntegerField(source="likes_count", read_only=True)
    commentsCount = serializers.SerializerMethodField()
    isLiked = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    isAnonymous = serializers.BooleanField(source="is_anonymous", required=False)
    isEdited = serializers.BooleanField(source="is_edited", read_only=True)

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "content",
            "author",
            "createdAt",
            "tags",
            "likesCount",
            "commentsCount",
            "isLiked",
            "isAnonymous",
            "isEdited",
        ]
        read_only_fields = ["id", "createdAt", "author", "isEdited"]
    
    @override
    def to_representation(self, instance):
        """Override to_representation to sanitize HTML content on output.
        
        This provides defense-in-depth: even if unsanitized content exists in the database
        (e.g., from data migration or manual database edits), it will be sanitized when read.
        """
        data = super().to_representation(instance)
        # Sanitize content field on output for security
        if 'content' in data and data['content']:
            data['content'] = _sanitize_html(data['content'])
        return data

    def get_author(self, obj: ForumPost) -> dict:
        if getattr(obj, "is_anonymous", False):
            # Check if current user is the author of this anonymous post
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False) and user.pk == obj.author_id:
                # Current user is the author of this anonymous post, show real author info
                real_author = _author_payload_for(obj.author)
                return {
                    **real_author,
                }
            else:
                # Mask author information when anonymous for other users
                return {
                    "id": _generate_anonymous_id(),
                    "name": "Anonymous", 
                    "avatar": None,
                }
        return _author_payload_for(obj.author)

    def get_commentsCount(self, obj: ForumPost) -> int:
        # Prefer DB-annotated comments_count when available to avoid extra queries
        annotated = getattr(obj, "comments_count", None)
        if isinstance(annotated, int):
            return annotated
        return obj.comments.count()

    def get_isLiked(self, obj: ForumPost) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        # Prefer annotated flag to avoid per-object queries
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        return obj.likes.filter(user=user).exists()

    @override
    def validate(self, attrs):  # type: ignore[override]
        """Validate and sanitize content."""
        # Sanitize content (always sanitize if provided)
        if "content" in attrs:
            raw = attrs.get("content")
            attrs["content"] = _sanitize_html(raw)
        return attrs

    @override
    def update(self, instance: ForumPost, validated_data):  # type: ignore[override]
        """Update post fields only; editing side-effects handled in services/views."""
        return super().update(instance, validated_data)


class ForumPostCommentSerializer(serializers.ModelSerializer):
    """Serializer for forum comments (flat; optional reply target).

    Exposes `replyTo` to let the frontend know if a comment is replying to another comment.
    
    Security note: HTML content is sanitized on both write (create/update) and read (to_representation)
    to provide defense-in-depth against XSS attacks.
    """

    author = serializers.SerializerMethodField()
    likesCount = serializers.IntegerField(source="likes_count", read_only=True)
    isLiked = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    replyTo = serializers.UUIDField(source="reply_to_id", allow_null=True, required=False)
    postId = serializers.UUIDField(source="post_id")
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)
    repliesCount = serializers.IntegerField(source="replies_count", read_only=True)
    isAnonymous = serializers.BooleanField(source="is_anonymous", required=False)

    class Meta:
        model = ForumPostComment
        fields = [
            "id",
            "content",
            "author",
            "createdAt",
            "likesCount",
            "isLiked",
            "isDeleted",
            "replyTo",
            "postId",
            "repliesCount",
            "isAnonymous",
        ]
        extra_kwargs = {}
        read_only_fields = ["id", "createdAt", "author", "isDeleted", "likesCount", "isLiked"]
    
    @override
    def to_representation(self, instance):
        """Override to_representation to sanitize HTML content on output.
        
        This provides defense-in-depth: even if unsanitized content exists in the database
        (e.g., from data migration or manual database edits), it will be sanitized when read.
        """
        data = super().to_representation(instance)
        # Sanitize content field on output for security
        if 'content' in data and data['content']:
            data['content'] = _sanitize_html(data['content'])
        return data

    def get_author(self, obj: ForumPostComment) -> dict:
        if getattr(obj, "is_anonymous", False):
            # Check if current user is the author of this anonymous comment
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False) and user.pk == obj.author_id:
                # Current user is the author of this anonymous comment, show real author info
                real_author = _author_payload_for(obj.author)
                return {
                    **real_author,
                }
            else:
                # Mask author information when anonymous for other users
                return {
                    "id": _generate_anonymous_id(),
                    "name": "Anonymous",
                    "avatar": None,
                }
        return _author_payload_for(obj.author)

    def get_isLiked(self, obj: ForumPostComment) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        # Prefer annotated flag to avoid per-object queries
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        return obj.likes.filter(user=user).exists()
    
    @override
    def validate(self, attrs):  # type: ignore[override]
        """Validate content and relations (postId, replyTo)."""
        # Sanitize content (always sanitize if provided)
        if "content" in attrs:
            raw = attrs.get("content")
            attrs["content"] = _sanitize_html(raw)

        # Validate parent post existence when provided (required at field level on create)
        post_id = attrs.get("post_id")
        if post_id is not None and not ForumPost.objects.filter(pk=post_id).exists():
            raise serializers.ValidationError({"postId": "invalid post id"})

        # Validate reply target if provided
        reply_to_id = attrs.get("reply_to_id")
        if reply_to_id is not None:
            try:
                reply_to_obj = ForumPostComment.objects.get(pk=reply_to_id)
            except ForumPostComment.DoesNotExist:
                raise serializers.ValidationError({"replyTo": "invalid reply target id"})
            if getattr(reply_to_obj, "is_deleted", False):
                raise serializers.ValidationError({"replyTo": "reply target has been deleted"})
            # Ensure reply target belongs to the same post when post_id is present
            if post_id is not None and str(reply_to_obj.post_id) != str(post_id):
                raise serializers.ValidationError({"replyTo": "reply target does not belong to the given postId"})

        return attrs
    
