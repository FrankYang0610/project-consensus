from __future__ import annotations

import logging
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Value
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from typing import override

from core.permissions import IsAuthorOrReadOnly
from .models import ForumPost, ForumPostComment, ForumPostLike, ForumCommentLike
from .serializers import ForumPostCommentSerializer, ForumPostSerializer
from .services.forum_like_service import (
    toggle_forum_post_like,
    toggle_forum_comment_like,
)
from .services.forum_post_service import (
    cleanup_removed_images_for_post,
    delete_post_and_cleanup_images,
    emit_notifications_for_new_comment,
    mark_post_edited_if_fields_changed,
    soft_delete_comment_and_cleanup_images,
)

logger = logging.getLogger(__name__)


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 100


class ForumPostViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for posts.

    - GET /api/forum/posts/          list
    - POST /api/forum/posts/         create
    - GET /api/forum/posts/{id}/     retrieve
    - PATCH /api/forum/posts/{id}/   partial update
    - DELETE /api/forum/posts/{id}/  delete
    """

    queryset = ForumPost.objects.select_related("author").prefetch_related("comments")
    serializer_class = ForumPostSerializer
    permission_classes = [IsAuthorOrReadOnly]

    # Enable search and ordering
    # - Search: title, content, tags
    # - Ordering: by created_at (time), likes_count (likes), comments_count (computed)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "content", "tags"]
    ordering_fields = ["created_at", "likes_count", "comments_count", "id"]
    # Sensible default ordering for feeds without ML: newest first, break ties by engagement
    ordering = ["-created_at", "-likes_count", "-id"]
    pagination_class = DefaultPageNumberPagination

    @override
    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        # Annotate derived fields used by serializer and ordering
        # - comments_count: total number of comments on the post
        qs = qs.annotate(comments_count=Count("comments"))

        # Annotate is_liked for authenticated users to avoid N+1 queries
        if self.request.user.is_authenticated:
            qs = qs.annotate(
                is_liked=Exists(
                    ForumPostLike.objects.filter(
                        post_id=OuterRef("id"),
                        user=self.request.user
                    )
                )
            )
        else:
            qs = qs.annotate(is_liked=Value(False))

        # Filters
        params = self.request.query_params
        author_id = params.get("author")
        if author_id:
            qs = qs.filter(author_id=author_id)

        mine = params.get("mine")
        if mine and self.request.user.is_authenticated:
            qs = qs.filter(author_id=self.request.user.pk)

        # Tag filtering: accepts repeated ?tags=foo&tags=bar and matches posts containing ALL selected tags
        # Industry practice: tag filters usually narrow results; "all-of" semantics provide predictable filtering.
        tags = params.getlist("tags")
        if tags:
            # Normalize and deduplicate incoming tags while preserving order
            normalized_tags = [stripped for t in tags if (stripped := t.strip())]
            if normalized_tags:
                # Apply AND semantics by requiring all selected tags to be contained
                # Use a single JSON contains condition with the full unique tag list
                unique_tags = list(dict.fromkeys(normalized_tags))
                qs = qs.filter(tags__contains=unique_tags)

        return qs

    # DRF flow note:
    # ModelViewSet.create() calls perform_create(serializer).
    # serializer.save(author=...) invokes ModelSerializer.create(...) when no instance exists,
    # whose default implementation is Model.objects.create(**validated_data),
    # thus performing the actual INSERT. Passing author here enforces the current user.
    @override
    def perform_create(self, serializer):  # type: ignore[override]
        # Force the author to the current user
        serializer.save(author=self.request.user)

    @override
    def perform_destroy(self, instance: ForumPost):  # type: ignore[override]
        """Hard delete a forum post and cleanup related images (delegated)."""
        delete_post_and_cleanup_images(post=instance)

    @override
    def destroy(self, request: Request, *args, **kwargs):  # type: ignore[override]
        """Explicitly return 204 after performing destroy for clarity and consistency."""
        instance: ForumPost = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @override
    def perform_update(self, serializer):  # type: ignore[override]
        """Update a post, then delegate cleanup and edited marking to services."""
        instance: ForumPost = serializer.instance
        before_html = getattr(instance, "content", "")
        incoming_keys = set(serializer.validated_data.keys())

        with transaction.atomic():
            super().perform_update(serializer)
            instance.refresh_from_db(fields=["content", "is_edited"])  # ensure latest content
            cleanup_removed_images_for_post(before_html=before_html, post_after_update=instance)
            mark_post_edited_if_fields_changed(post=instance, incoming_keys=incoming_keys)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request: Request, pk: str | None = None):
        """Toggle like status for the post. If not liked, creates like; if already liked, removes like."""
        assert pk is not None
        post = self.get_object()
        user = request.user
        try:
            toggle_forum_post_like(user=user, post=post)
            post = self.get_queryset().get(pk=pk)  # refresh annotations
            serializer = self.get_serializer(post, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ForumPostCommentViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for comments (filter by postId/replyTo).

    - GET /api/forum/comments/?postId=<uuid>          filter by post
    - GET /api/forum/comments/?replyTo=<uuid>         filter by reply target (parent comment)
    - POST /api/forum/comments/                       create
    - others same as standard REST actions
    """

    queryset = ForumPostComment.objects.select_related("author", "post", "reply_to")
    serializer_class = ForumPostCommentSerializer
    permission_classes = [IsAuthorOrReadOnly]
    pagination_class = DefaultPageNumberPagination

    @override
    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        post_id = self.request.query_params.get("postId")
        reply_to_id = self.request.query_params.get("replyTo")
        if post_id:
            # Return 404 if the parent post is missing
            if not ForumPost.objects.filter(pk=post_id).exists():
                raise NotFound("Post not found")
            qs = qs.filter(post_id=post_id)
        if reply_to_id:
            qs = qs.filter(reply_to_id=reply_to_id)
        # Consistent ordering: oldest first (ascending)
        qs = qs.order_by("created_at", "id")
        # Annotate direct replies count (include soft-deleted replies)
        qs = qs.annotate(replies_count=Count("replies"))
        # Annotate is_liked for authenticated users to avoid N+1 queries
        if self.request.user.is_authenticated:
            qs = qs.annotate(
                is_liked=Exists(
                    ForumCommentLike.objects.filter(
                        comment_id=OuterRef("id"),
                        user=self.request.user
                    )
                )
            )
        else:
            qs = qs.annotate(is_liked=Value(False))
        return qs

    # Because forum post comments are not editable, we don't need to implement `perform_update`
    @override
    def update(self, request: Request, *args, **kwargs):  # type: ignore[override]
        return Response({"detail": "Comment editing is not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    # Because forum post comments are not editable, we don't need to implement `partial_update`
    @override
    def partial_update(self, request: Request, *args, **kwargs):  # type: ignore[override]
        return Response({"detail": "Comment editing is not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @override
    def perform_create(self, serializer):  # type: ignore[override]
        # Always set the author to current user; relation validation handled by serializer
        comment: ForumPostComment = serializer.save(author=self.request.user)
        emit_notifications_for_new_comment(comment=comment, actor=self.request.user)

    @override
    def perform_destroy(self, instance: ForumPostComment):  # type: ignore[override]
        """Soft delete a comment and cleanup embedded images (delegated)."""
        soft_delete_comment_and_cleanup_images(comment=instance)

    @override
    def destroy(self, request: Request, *args, **kwargs):  # type: ignore[override]
        """Soft delete comments and always return 204 (idempotent)."""
        instance: ForumPostComment = self.get_object()
        if getattr(instance, "is_deleted", False):
            return Response(status=status.HTTP_204_NO_CONTENT)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["GET"], url_path="position", permission_classes=[permissions.AllowAny])
    def position(self, request: Request):
        """Compute the anchor position of a comment within its post feed.

        Request query params:
        - postId: UUID of the post
        - commentId: UUID of the target comment
        - page_size: optional page size used by the client (defaults to paginator default)

        Returns JSON with the zero-based index, 1-based page, and convenience URLs for pages up to that anchor.
        """
        post_id = request.query_params.get("postId")
        comment_id = request.query_params.get("commentId")
        page_size_param = request.query_params.get("page_size")

        if not post_id or not comment_id:
            return Response(
                {"detail": "postId and commentId are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target = ForumPostComment.objects.only("id", "created_at", "post_id").get(pk=comment_id)
        except ForumPostComment.DoesNotExist:
            return Response({"detail": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)

        if str(target.post_id) != str(post_id):
            return Response(
                {"detail": "commentId does not belong to the given postId"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure the parent post exists
        if not ForumPost.objects.filter(pk=post_id).exists():
            return Response({"detail": "Post not found"}, status=status.HTTP_404_NOT_FOUND)

        base_qs = ForumPostComment.objects.filter(post_id=post_id)
        # Count of items strictly before the target by ordering (created_at asc, id asc)
        less_count = base_qs.filter(created_at__lt=target.created_at).count()
        tie_count = base_qs.filter(created_at=target.created_at, id__lte=target.id).count()
        index = max(less_count + tie_count - 1, 0)

        total_count = base_qs.count()

        # Determine page size
        default_page_size = getattr(self.pagination_class, "page_size", 20) or 20
        max_page_size = getattr(self.pagination_class, "max_page_size", 100) or 100
        try:
            page_size = int(page_size_param) if page_size_param else int(default_page_size)
        except (TypeError, ValueError):
            page_size = int(default_page_size)
        page_size = max(1, min(page_size, int(max_page_size)))

        page = index // page_size + 1
        pages_before = max(page - 1, 0)

        # Convenience URLs for pages 1..page (relative path)
        page_urls = [
            f"/api/forum/comments/?postId={post_id}&page={i}&page_size={page_size}"
            for i in range(1, page + 1)
        ]

        payload = {
            "index": index,
            "page": page,
            "pageSize": page_size,
            "countBefore": index,
            "pagesBefore": pages_before,
            "totalCount": total_count,
            "pageUrls": page_urls,
        }
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request: Request, pk: str | None = None):
        """Toggle like status for the comment. If not liked, creates like; if already liked, removes like."""
        assert pk is not None
        comment = self.get_object()
        # Disallow liking a deleted comment
        if getattr(comment, "is_deleted", False):
            return Response({"detail": "Cannot like a deleted comment"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        try:
            toggle_forum_comment_like(user=user, comment=comment)
            comment = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(comment, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
