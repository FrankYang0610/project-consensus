from __future__ import annotations

from rest_framework import viewsets, permissions, filters, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request

from django.db import transaction, models
from django.db.models import F, Count, Q, Case, When, Value, IntegerField, Exists, OuterRef
from .models import ForumPost, ForumPostComment, ForumPostLike, ForumCommentLike
from .serializers import ForumPostSerializer, ForumPostCommentSerializer
from accounts.models import Notification


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
    # Read-only for anonymous, write requires auth
    def get_permissions(self):  # type: ignore[override]
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
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
        return qs

    def perform_create(self, serializer):  # type: ignore[override]
        # Force the author to the current user
        serializer.save(author=self.request.user)

    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "content", "tags"]
    pagination_class = DefaultPageNumberPagination

    def destroy(self, request: Request, *args, **kwargs):  # type: ignore[override]
        """Only the author can delete their own post."""
        post = self.get_object()
        if request.user != post.author:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request: Request, *args, **kwargs):  # type: ignore[override]
        """Allow only the author to update their post.

        On successful update, mark the post as edited when any editable field is present.
        """
        partial = kwargs.pop("partial", False)
        instance: ForumPost = self.get_object()
        if request.user != instance.author:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        # Determine if incoming data modifies any editable fields
        editable_fields = {"title", "content", "tags", "is_anonymous"}
        incoming_keys = set(serializer.validated_data.keys())

        self.perform_update(serializer)

        # Mark as edited if client attempted to update any editable fields
        if incoming_keys & editable_fields:
            ForumPost.objects.filter(pk=instance.pk).update(is_edited=True)
            instance.refresh_from_db(fields=["is_edited"])  # keep instance in sync

        return Response(serializer.data)

    def partial_update(self, request: Request, *args, **kwargs):  # type: ignore[override]
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

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
                    if str(user.pk) != str(post.author_id):
                        Notification.objects.create(
                            user=post.author,
                            actor=user,
                            type=Notification.Type.FORUM_POST_LIKED,
                            forumpost=post,
                            created_at=getattr(like, "created_at", None) or None,
                        )
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
    # Read-only for anonymous, write requires auth
    def get_permissions(self):  # type: ignore[override]
        if self.action in ["list", "retrieve", "position"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        post_id = self.request.query_params.get("postId")
        reply_to_id = self.request.query_params.get("replyTo")
        if post_id:
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

    def perform_create(self, serializer):  # type: ignore[override]
        # Always set the author to current user; no main thread tracking in flat model
        comment: ForumPostComment = serializer.save(author=self.request.user)
        # Create notifications based on whether it's a reply to post or to comment
        try:
            actor = self.request.user
            if comment.reply_to_id:
                # Reply to a comment -> notify that comment's author
                target_user = comment.reply_to.author
                if str(target_user.pk) != str(actor.pk):
                    Notification.objects.create(
                        user=target_user,
                        actor=actor,
                        type=Notification.Type.FORUM_POST_COMMENT_REPLIED,
                        forumpostcomment=comment,
                        forumpost=comment.post,
                        created_at=comment.created_at,
                        actor_is_anonymous=bool(getattr(comment, "is_anonymous", False)),
                        content_preview=comment.content[:100] + ("..." if len(comment.content) > 100 else ""),
                    )
            else:
                # Top-level comment -> notify post author
                target_user = comment.post.author
                if str(target_user.pk) != str(actor.pk):
                    Notification.objects.create(
                        user=target_user,
                        actor=actor,
                        type=Notification.Type.FORUM_POST_REPLIED,
                        forumpostcomment=comment,
                        forumpost=comment.post,
                        created_at=comment.created_at,
                        actor_is_anonymous=bool(getattr(comment, "is_anonymous", False)),
                        content_preview=comment.content[:100] + ("..." if len(comment.content) > 100 else ""),
                    )
        except Exception:
            # Best-effort; don't block comment creation on notification errors
            pass

    def destroy(self, request: Request, *args, **kwargs):  # type: ignore[override]
        """Soft delete a comment: only the author may delete.

        Behavior:
        - Mark is_deleted=True
        - Clear content (set to empty string)
        - Keep the row to preserve thread structure
        """
        comment = self.get_object()
        if request.user != comment.author:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # If already soft-deleted, return current state
        if getattr(comment, "is_deleted", False):
            serializer = self.get_serializer(comment, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        with transaction.atomic():
            # Soft delete and clear content
            ForumPostComment.objects.filter(pk=comment.pk).update(is_deleted=True, content="")
        comment.refresh_from_db(fields=["is_deleted", "content"]) 
        serializer = self.get_serializer(comment, context={"request": request})
        # 200 with updated payload helps clients update state; DELETE 204 would also be acceptable
        return Response(serializer.data, status=status.HTTP_200_OK)

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
        user = request.user
        try:
            with transaction.atomic():
                like, created = ForumCommentLike.objects.get_or_create(comment=comment, user=user)
                if created:
                    ForumPostComment.objects.filter(pk=comment.pk).update(likes_count=F("likes_count") + 1)
                    # Notify comment author (exclude self)
                    if str(user.pk) != str(comment.author_id):
                        Notification.objects.create(
                            user=comment.author,
                            actor=user,
                            type=Notification.Type.FORUM_POST_COMMENT_LIKED,
                            forumpostcomment=comment,
                            forumpost=comment.post,
                            created_at=getattr(like, "created_at", None) or None,
                        )
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
