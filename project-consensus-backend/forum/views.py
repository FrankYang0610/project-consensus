from __future__ import annotations

import logging
from django.db import transaction
from django.db.models import Case, Count, Exists, F, IntegerField, OuterRef, Q, Value, When
from django.utils import timezone
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from typing import override

from core.permissions import IsAuthorOrReadOnly
from core.utils import delete_images_in_html, delete_storage_object_by_url, extract_image_srcs_from_html
from notifications import NotificationType
from notifications.events import DomainEvent, emit
from .models import ForumCommentLike, ForumPost, ForumPostComment, ForumPostLike
from .serializers import ForumPostCommentSerializer, ForumPostSerializer

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
        """Hard delete a forum post and cleanup related images."""
        try:
            delete_images_in_html(getattr(instance, "content", ""), owner_user_id=instance.author_id)
        except Exception as e:
            logger.warning(f"Failed to delete images in forum post {instance.pk}: {e}", exc_info=True)
        with transaction.atomic():
            instance.delete()

    @override
    def perform_update(self, serializer):  # type: ignore[override]
        """Update a post, cleanup removed images, and mark as edited when fields change."""
        instance: ForumPost = serializer.instance
        old_srcs = extract_image_srcs_from_html(getattr(instance, "content", ""))
        editable_fields = {"title", "content", "tags", "is_anonymous"}
        incoming_keys = set(serializer.validated_data.keys())

        with transaction.atomic():
            super().perform_update(serializer)
            instance.refresh_from_db(fields=["content"])
            new_srcs = extract_image_srcs_from_html(getattr(instance, "content", ""))
            removed_srcs = old_srcs - new_srcs
            author_id = instance.author_id
            post_pk = instance.pk
            # Capture variables explicitly using default arguments to avoid closure issues
            def _cleanup(removed_srcs=removed_srcs, owner_id=author_id, pk=post_pk):
                try:
                    for src in removed_srcs:
                        delete_storage_object_by_url(src, owner_user_id=owner_id)
                except Exception as e:
                    logger.warning(f"Failed to delete removed images in forum post {pk}: {e}", exc_info=True)
            transaction.on_commit(_cleanup)

            if incoming_keys & editable_fields:
                ForumPost.objects.filter(pk=instance.pk).update(is_edited=True)
                instance.refresh_from_db(fields=["is_edited"])  # keep instance in sync

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def like(self, request: Request, pk: str | None = None):
        """Current user likes the post. Idempotent: multiple calls have no additional effect."""
        assert pk is not None
        post = self.get_object()
        user = request.user
        try:
            with transaction.atomic():
                created = False
                like, created = ForumPostLike.objects.get_or_create(post=post, user=user)
                if created:
                    ForumPost.objects.filter(pk=post.pk).update(likes_count=F("likes_count") + 1)
                    # Notify post author (exclude self-notify)
                    if user.pk != post.author_id:
                        emit(DomainEvent(
                            type=NotificationType.FORUM_POST_LIKED,
                            recipient_id=post.author_id,
                            actor_id=user.pk,
                            target_app="forum",
                            target_model="ForumPost",
                            target_id=str(post.pk),
                            route=f"/post/{post.pk}",
                            metadata={
                                "forumPostId": str(post.pk),
                                "forumPostTitle": post.title,
                            },
                            referenced_content_preview=post.title,
                            created_at=getattr(like, "created_at", timezone.now()),
                        ))
            # Re-fetch to get fresh data and annotations (is_liked)
            post = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(post, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def unlike(self, request: Request, pk: str | None = None):
        """Current user unlikes the post. Idempotent: if not liked, no change."""
        assert pk is not None
        post = self.get_object()
        user = request.user
        try:
            with transaction.atomic():
                deleted, _ = ForumPostLike.objects.filter(post=post, user=user).delete()
                if deleted:
                    ForumPost.objects.filter(pk=post.pk).update(
                        likes_count=Case(
                            When(likes_count__gt=0, then=F("likes_count") - 1),
                            default=Value(0),
                            output_field=IntegerField(),
                        )
                    )
            # Re-fetch to get fresh data and annotations (is_liked)
            post = self.get_queryset().get(pk=pk)
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
        # Always set the author to current user; no main thread tracking in flat model
        comment: ForumPostComment = serializer.save(author=self.request.user)
        # Create notifications based on whether it's a reply to post or to comment
        try:
            actor = self.request.user
            if comment.reply_to_id:
                # Reply to a comment -> notify that comment's author
                target_user = comment.reply_to.author
                if target_user.pk != actor.pk:
                    emit(DomainEvent(
                        type=NotificationType.FORUM_POST_COMMENT_REPLIED,
                        recipient_id=target_user.pk,
                        actor_id=actor.pk,
                        target_app="forum",
                        target_model="ForumPostComment",
                        target_id=str(comment.pk),
                        route=f"/post/{comment.post_id}#comment-{comment.pk}",
                        metadata={
                            "forumPostId": str(comment.post_id),
                            "forumPostCommentId": str(comment.pk),
                            "forumPostTitle": comment.post.title,
                        },
                        actor_is_anonymous=bool(getattr(comment, "is_anonymous", False)),
                        content_preview=comment.content,
                        referenced_content_preview=(comment.reply_to.content if comment.reply_to and comment.reply_to.content else comment.post.title),
                        created_at=comment.created_at,
                    ))
            else:
                # Top-level comment -> notify post author
                target_user = comment.post.author
                if target_user.pk != actor.pk:
                    emit(DomainEvent(
                        type=NotificationType.FORUM_POST_COMMENTED,
                        recipient_id=target_user.pk,
                        actor_id=actor.pk,
                        target_app="forum",
                        target_model="ForumPostComment",
                        target_id=str(comment.pk),
                        route=f"/post/{comment.post_id}#comment-{comment.pk}",
                        metadata={
                            "forumPostId": str(comment.post_id),
                            "forumPostCommentId": str(comment.pk),
                            "forumPostTitle": comment.post.title,
                        },
                        actor_is_anonymous=bool(getattr(comment, "is_anonymous", False)),
                        content_preview=comment.content,
                        referenced_content_preview=comment.post.title,
                        created_at=comment.created_at,
                    ))
        except Exception:
            # Best-effort; don't block comment creation on notification errors
            pass

    @override
    def perform_destroy(self, instance: ForumPostComment):  # type: ignore[override]
        """Soft delete a comment and cleanup embedded images."""
        if getattr(instance, "is_deleted", False):
            return
        try:
            delete_images_in_html(getattr(instance, "content", ""), owner_user_id=instance.author_id)
        except Exception as e:
            logger.warning(f"Failed to delete images in forum comment {instance.pk}: {e}", exc_info=True)
        with transaction.atomic():
            ForumPostComment.objects.filter(pk=instance.pk).update(is_deleted=True, content="")

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
    def like(self, request: Request, pk: str | None = None):
        """Current user likes the comment. Idempotent: multiple calls have no additional effect."""
        assert pk is not None
        comment = self.get_object()
        # Disallow liking a deleted comment
        if getattr(comment, "is_deleted", False):
            return Response({"detail": "Cannot like a deleted comment"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        try:
            with transaction.atomic():
                like, created = ForumCommentLike.objects.get_or_create(comment=comment, user=user)
                if created:
                    ForumPostComment.objects.filter(pk=comment.pk).update(likes_count=F("likes_count") + 1)
                    # Notify comment author (exclude self)
                    if user.pk != comment.author_id:
                        emit(DomainEvent(
                            type=NotificationType.FORUM_POST_COMMENT_LIKED,
                            recipient_id=comment.author_id,
                            actor_id=user.pk,
                            target_app="forum",
                            target_model="ForumPostComment",
                            target_id=str(comment.pk),
                            route=f"/post/{comment.post_id}#comment-{comment.pk}",
                            metadata={
                                "forumPostId": str(comment.post_id),
                                "forumPostCommentId": str(comment.pk),
                                "forumPostTitle": comment.post.title,
                            },
                            referenced_content_preview=(comment.content if comment and comment.content else comment.post.title),
                            created_at=getattr(like, "created_at", timezone.now()),
                        ))
            # Re-fetch to get fresh data and annotations (is_liked, replies_count)
            comment = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(comment, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def unlike(self, request: Request, pk: str | None = None):
        """Current user unlikes the comment. Idempotent: if not liked, no change."""
        assert pk is not None
        comment = self.get_object()
        # Disallow unliking a deleted comment (no-op)
        if getattr(comment, "is_deleted", False):
            serializer = self.get_serializer(comment, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        user = request.user
        try:
            with transaction.atomic():
                deleted, _ = ForumCommentLike.objects.filter(comment=comment, user=user).delete()
                if deleted:
                    ForumPostComment.objects.filter(pk=comment.pk).update(
                        likes_count=Case(
                            When(likes_count__gt=0, then=F("likes_count") - 1),
                            default=Value(0),
                            output_field=IntegerField(),
                        )
                    )
            # Re-fetch to get fresh data and annotations (is_liked, replies_count)
            comment = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(comment, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
