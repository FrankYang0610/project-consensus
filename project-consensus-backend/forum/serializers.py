from __future__ import annotations

import logging

from django.db import transaction
from rest_framework import serializers
from typing import override

from .models import ForumPost, ForumPostComment
from .utils import generate_anonymous_id
from forum.security.html import sanitize_forum_html
from forum.presentation.author import build_forum_author_payload
from .services.forum_miscellaneous import cleanup_removed_images_for_post, mark_post_edited_if_fields_changed
from .services.forum_notification import emit_notifications_for_new_comment


logger = logging.getLogger(__name__)


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

    id = serializers.UUIDField(read_only=True)
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
            "id", "title", "content", "author", "createdAt",
            "tags", "likesCount", "commentsCount", "isLiked",
            "isAnonymous", "isEdited",
        ]
    
    @override
    def to_representation(self, instance):
        """Override to_representation to sanitize HTML content on output.
        
        This provides defense-in-depth: even if unsanitized content exists in the database
        (e.g., from data migration or manual database edits), it will be sanitized when read.
        """
        data = super().to_representation(instance)
        # Sanitize content field on output for security
        if 'content' in data and data['content']:
            data['content'] = sanitize_forum_html(data['content'])
        return data

    @override
    def create(self, validated_data):  # type: ignore[override]
        # Never trust author from payload/save(kwargs)
        validated_data.pop("author", None)

        request = self.context.get("request")
        user = request.user if request is not None else None
        if not user or not user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication required"})

        return ForumPost.objects.create(author=user, **validated_data)

    def get_author(self, obj: ForumPost) -> dict:
        if obj.is_anonymous:
            # Check if current user is the author of this anonymous post
            request = self.context.get("request")
            user = request.user if request is not None else None
            if user is not None and user.is_authenticated and user.pk == obj.author_id:
                # Current user is the author of this anonymous post, show real author info
                real_author = build_forum_author_payload(obj.author)
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
        return build_forum_author_payload(obj.author)

    def get_commentsCount(self, obj: ForumPost) -> int:
        # Prefer DB-annotated comments_count when available to avoid extra queries
        annotated = getattr(obj, "comments_count", None)
        if isinstance(annotated, int):
            return annotated
        return obj.comments.count()

    def get_isLiked(self, obj: ForumPost) -> bool:
        request = self.context.get("request")
        user = request.user if request is not None else None
        if not user or not user.is_authenticated:
            return False
        # Prefer annotated flag to avoid per-object queries
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        return obj.likes.filter(user=user).exists()

    @override
    def validate(self, attrs):  # type: ignore[override]
        """Validate and sanitize content and enforce admin-only fields."""
        # Sanitize content (always sanitize if provided)
        if "content" in attrs:
            raw = attrs.get("content")
            attrs["content"] = sanitize_forum_html(raw)

        # Enforce that `has_content_warning` can only be modified by admins.
        request = self.context.get("request")
        user = request.user if request is not None else None
        if not (user and (user.is_staff or user.is_superuser)):
            attrs.pop("has_content_warning", None)

        return attrs

    @override
    def update(self, instance: ForumPost, validated_data):  # type: ignore[override]
        incoming_keys = set(validated_data.keys())
        before_html = instance.content or ""

        with transaction.atomic():
            # Mark edited on the instance before saving so it persists in the same write
            mark_post_edited_if_fields_changed(post=instance, incoming_keys=incoming_keys)
            instance = super().update(instance, validated_data)
            cleanup_removed_images_for_post(before_html=before_html, post_after_update=instance)

        return instance


class ForumPostCommentSerializer(serializers.ModelSerializer):
    """Serializer for forum comments (flat; optional reply target).

    Exposes `replyTo` to let the frontend know if a comment is replying to another comment.
    
    Security note: HTML content is sanitized on both write (create/update) and read (to_representation)
    to provide defense-in-depth against XSS attacks.
    """

    id = serializers.UUIDField(read_only=True)
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
            "id", "content", "author", "createdAt", "likesCount",
            "isLiked", "isDeleted", "replyTo", "postId",
            "repliesCount", "isAnonymous",
        ]
        extra_kwargs = {}
    
    @override
    def to_representation(self, instance):
        """Override to_representation to sanitize HTML content on output.
        
        This provides defense-in-depth: even if unsanitized content exists in the database
        (e.g., from data migration or manual database edits), it will be sanitized when read.
        """
        data = super().to_representation(instance)
        # Sanitize content field on output for security
        if 'content' in data and data['content']:
            data['content'] = sanitize_forum_html(data['content'])
        return data

    def get_author(self, obj: ForumPostComment) -> dict:
        if obj.is_anonymous:
            # Check if current user is the author of this anonymous comment
            request = self.context.get("request")
            user = request.user if request is not None else None
            if user is not None and user.is_authenticated and user.pk == obj.author_id:
                # Current user is the author of this anonymous comment, show real author info
                real_author = build_forum_author_payload(obj.author)
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
        return build_forum_author_payload(obj.author)

    def get_isLiked(self, obj: ForumPostComment) -> bool:
        request = self.context.get("request")
        user = request.user if request is not None else None
        if not user or not user.is_authenticated:
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
            attrs["content"] = sanitize_forum_html(raw)

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
            if reply_to_obj.is_deleted:
                raise serializers.ValidationError({"replyTo": "reply target has been deleted"})
            # Ensure reply target belongs to the same post when post_id is present
            if post_id is not None and str(reply_to_obj.post_id) != str(post_id):
                raise serializers.ValidationError({"replyTo": "reply target does not belong to the given postId"})

        return attrs

    @override
    def create(self, validated_data):  # type: ignore[override]
        # Never trust author from payload/save(kwargs)
        validated_data.pop("author", None)

        request = self.context.get("request")
        user = request.user if request is not None else None
        if not user or not user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication required"})

        comment = ForumPostComment.objects.create(author=user, **validated_data)

        # Best-effort notification; errors should not block comment creation
        try:
            emit_notifications_for_new_comment(comment=comment, actor=user)
        except Exception:  # pragma: no cover
            logger.warning("Failed to emit notifications for new forum comment %s", comment.pk, exc_info=True)

        return comment

