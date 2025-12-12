from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from typing import override

from accounts.services.privacy_service import (
    can_view_forum_comments,
    can_view_forum_posts,
)
from core.permissions import IsAuthorOrReadOnly
from core.views import BaseUserContentListView
from .models import ForumPost, ForumPostComment
from .serializers import ForumPostCommentSerializer, ForumPostSerializer
from .services.forum_like import (
    toggle_forum_post_like,
    toggle_forum_comment_like,
)
from .services.forum_miscellaneous import (
    delete_post_and_cleanup_images,
    soft_delete_comment_and_cleanup_images,
)
from .services.forum_post_comment_position import (
    CommentDoesNotBelongToPostError,
    compute_forum_post_comment_position,
)

logger = logging.getLogger(__name__)


class DefaultPageNumberPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 100


class ForumPostViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoints for posts.

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
        # Start from a DRY, well‑annotated queryset:
        # - with_details(): author/profile, comments, likes
        # - with_comments_count(): total number of comments
        # - with_user_interaction(): per-user is_liked flag
        qs = (
            ForumPost.objects.with_details()
            .with_comments_count()
            .with_user_interaction(getattr(self.request, "user", None))
        )

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

    @override
    def perform_destroy(self, instance: ForumPost):  # type: ignore[override]
        """Hard delete a forum post and cleanup related images (delegated)."""
        delete_post_and_cleanup_images(post=instance)

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
    """
    CRUD endpoints for comments (filter by postId/replyTo).

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
        # Base queryset with common eager-loading and annotations.
        qs = (
            ForumPostComment.objects.with_details()
            .with_replies_count()
            .with_user_interaction(getattr(self.request, "user", None))
        )

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
        return qs.order_by("created_at", "id")

    # Because forum post comments are not editable, we don't need to implement `perform_update`
    @override
    def update(self, request: Request, *args, **kwargs):  # type: ignore[override]
        return Response({"detail": "Comment editing is not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    # Because forum post comments are not editable, we don't need to implement `partial_update`
    @override
    def partial_update(self, request: Request, *args, **kwargs):  # type: ignore[override]
        return Response({"detail": "Comment editing is not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @override
    def perform_destroy(self, instance: ForumPostComment):  # type: ignore[override]
        """Soft delete a comment and cleanup embedded images (idempotent)."""
        # If the comment is already soft-deleted, do nothing so that the default
        # `destroy` implementation remains idempotent and still returns 204.
        if instance.is_deleted:
            return
        soft_delete_comment_and_cleanup_images(comment=instance)

    @action(detail=False, methods=["GET"], url_path="position", permission_classes=[permissions.AllowAny])
    def position(self, request: Request):
        """
        Compute the anchor position of a comment within its post feed.

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

        default_page_size = getattr(self.pagination_class, "page_size", 20) or 20
        max_page_size = getattr(self.pagination_class, "max_page_size", 100) or 100
        try:
            payload = compute_forum_post_comment_position(
                post_id=post_id,
                comment_id=comment_id,
                page_size_param=page_size_param,
                default_page_size=int(default_page_size),
                max_page_size=int(max_page_size),
            )
        except ForumPostComment.DoesNotExist:
            return Response({"detail": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        except CommentDoesNotBelongToPostError:
            return Response(
                {"detail": "commentId does not belong to the given postId"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ForumPost.DoesNotExist:
            return Response({"detail": "Post not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request: Request, pk: str | None = None):
        # Toggle like status for the comment. If not liked, creates like; if already liked, removes like.
        assert pk is not None
        comment = self.get_object()
        if comment.is_deleted:  # Disallow liking a deleted comment
            return Response({"detail": "Cannot like a deleted comment"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        try:
            toggle_forum_comment_like(user=user, comment=comment)
            comment = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(comment, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserPostsListView(BaseUserContentListView):
    """
    Unified handler for:
    - /api/accounts/my-posts/                 (current user's posts)
    - /api/accounts/users/<user_id>/posts/    (public posts of a specific user)

    This view lives in the forum app to avoid cross-app coupling in accounts.views.
    """

    serializer_class = ForumPostSerializer
    pagination_class = DefaultPageNumberPagination
    privacy_checker = staticmethod(can_view_forum_posts)

    def get_content_queryset(self, target_user):
        """
        Build base queryset with common annotations.
        """
        return (
            ForumPost.objects.with_details()
            .with_comments_count()
            .with_user_interaction(self.request.user)
            .filter(author=target_user)
            .order_by("-created_at")
        )


class UserCommentsListView(BaseUserContentListView):
    """
    Unified handler for:
    - /api/accounts/my-comments/                 (current user's comments)
    - /api/accounts/users/<user_id>/comments/    (public comments of a specific user)

    Also lives in the forum app to keep accounts/views.py focused on auth/profile only.
    """

    serializer_class = ForumPostCommentSerializer
    pagination_class = DefaultPageNumberPagination
    privacy_checker = staticmethod(can_view_forum_comments)

    def get_content_queryset(self, target_user):
        """
        Build base queryset with common annotations.
        """
        return (
            ForumPostComment.objects.with_details()
            .with_replies_count()
            .with_user_interaction(self.request.user)
            .filter(author=target_user, is_deleted=False)
            .order_by("-created_at")
        )
