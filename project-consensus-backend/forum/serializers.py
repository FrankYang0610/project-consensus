from __future__ import annotations

import uuid
from django.contrib.auth import get_user_model
import bleach
from rest_framework import serializers

from accounts.models import Profile
from accounts.serializers import AuthorSerializer
from .models import ForumPost, ForumPostComment


User = get_user_model()


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
    """Generate a unique anonymous ID for anonymous posts/comments.
    
    Uses UUID4 to ensure uniqueness across all anonymous content.
    """
    return f"anonymous_{uuid.uuid4().hex[:8]}"


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
    likes = serializers.IntegerField(source="likes_count", read_only=True)
    comments = serializers.SerializerMethodField()
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
            "likes",
            "comments",
            "isLiked",
            "isAnonymous",
            "isEdited",
        ]
        read_only_fields = ["id", "createdAt", "author", "isEdited"]
    
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

    def get_comments(self, obj: ForumPost) -> int:
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
    
    def validate(self, attrs):  # type: ignore[override]
        """Validate and sanitize content."""
        # Sanitize content (always sanitize if provided)
        if "content" in attrs:
            raw = attrs.get("content")
            attrs["content"] = _sanitize_html(raw)
        return attrs
    
    def create(self, validated_data):  # type: ignore[override]
        """Create a new forum post with sanitized content."""
        # Extract author from context if not provided
        author = validated_data.pop("author", None)
        if author is None:
            request = self.context.get("request")
            if request and hasattr(request, "user") and request.user.is_authenticated:
                author = request.user
        
        if author is None:
            raise serializers.ValidationError("author must be provided or user must be authenticated")
        
        # Sanitize HTML content (defense-in-depth)
        if "content" in validated_data:
            validated_data["content"] = _sanitize_html(validated_data.get("content", ""))
        
        instance = ForumPost.objects.create(author=author, **validated_data)
        return instance
    
    def update(self, instance: ForumPost, validated_data):  # type: ignore[override]
        """Update forum post with sanitized content and set is_edited flag."""
        # Track if any content-related fields changed
        content_changed = False
        
        # Update and sanitize content if provided
        if "content" in validated_data:
            new_content = _sanitize_html(validated_data["content"])
            if instance.content != new_content:
                instance.content = new_content
                content_changed = True
        
        # Update title if provided
        if "title" in validated_data:
            new_title = validated_data["title"]
            if instance.title != new_title:
                instance.title = new_title
                content_changed = True
        
        # Update tags if provided
        if "tags" in validated_data:
            instance.tags = validated_data["tags"]
        
        # Update is_anonymous if provided
        if "is_anonymous" in validated_data:
            instance.is_anonymous = validated_data["is_anonymous"]
        
        # Mark as edited if content or title changed
        if content_changed:
            instance.is_edited = True
        
        instance.save()
        return instance


class ForumPostCommentSerializer(serializers.ModelSerializer):
    """Serializer for forum comments (flat; optional reply target).

    Exposes `replyTo` to let the frontend know if a comment is replying to another comment.
    
    Security note: HTML content is sanitized on both write (create/update) and read (to_representation)
    to provide defense-in-depth against XSS attacks.
    """

    author = serializers.SerializerMethodField()
    likes = serializers.IntegerField(source="likes_count", read_only=True)
    isLiked = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    replyTo = serializers.UUIDField(source="reply_to_id", allow_null=True, required=False)
    postId = serializers.UUIDField(source="post_id")
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)
    replies = serializers.IntegerField(source="replies_count", read_only=True)
    isAnonymous = serializers.BooleanField(source="is_anonymous", required=False)
    canDelete = serializers.SerializerMethodField()

    class Meta:
        model = ForumPostComment
        fields = [
            "id",
            "content",
            "author",
            "createdAt",
            "likes",
            "isLiked",
            "isDeleted",
            "replyTo",
            "postId",
            "replies",
            "isAnonymous",
            "canDelete",
        ]
        extra_kwargs = {}
        read_only_fields = ["id", "createdAt", "author", "isDeleted", "likes", "isLiked"]
    
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

    def get_canDelete(self, obj: ForumPostComment) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return user.pk == obj.author_id
        return False

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
    
    def validate(self, attrs):  # type: ignore[override]
        """Validate and sanitize content."""
        # Sanitize content (always sanitize if provided)
        if "content" in attrs:
            raw = attrs.get("content")
            attrs["content"] = _sanitize_html(raw)
        return attrs
    
    def create(self, validated_data):  # type: ignore[override]
        """Create a new comment with sanitized content."""
        # Extract author from context if not provided
        author = validated_data.pop("author", None)
        if author is None:
            request = self.context.get("request")
            if request and hasattr(request, "user") and request.user.is_authenticated:
                author = request.user
        
        if author is None:
            raise serializers.ValidationError("author must be provided or user must be authenticated")
        
        # Sanitize HTML content (defense-in-depth)
        if "content" in validated_data:
            validated_data["content"] = _sanitize_html(validated_data.get("content", ""))
        
        # Extract post and reply_to if needed
        post = validated_data.pop("post", None)
        reply_to = validated_data.pop("reply_to", None)
        
        # Handle post_id from payload
        if post is None and "post_id" in validated_data:
            post_id = validated_data.pop("post_id")
            try:
                post = ForumPost.objects.get(pk=post_id)
            except ForumPost.DoesNotExist:
                raise serializers.ValidationError({"postId": "invalid post id"})
        
        # Handle reply_to_id from payload
        if reply_to is None and "reply_to_id" in validated_data:
            reply_to_id = validated_data.pop("reply_to_id")
            if reply_to_id is not None:
                try:
                    reply_to = ForumPostComment.objects.get(pk=reply_to_id)
                except ForumPostComment.DoesNotExist:
                    raise serializers.ValidationError({"replyTo": "invalid reply target id"})
        
        if post is None:
            raise serializers.ValidationError("post must be provided")
        
        instance = ForumPostComment.objects.create(
            post=post,
            author=author,
            reply_to=reply_to,
            **validated_data
        )
        return instance
    
    def update(self, instance: ForumPostComment, validated_data):  # type: ignore[override]
        """Update comment with sanitized content."""
        # Sanitize and update content if provided
        if "content" in validated_data:
            instance.content = _sanitize_html(validated_data["content"])
        
        instance.save()
        return instance
