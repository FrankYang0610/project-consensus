from __future__ import annotations

from rest_framework import viewsets, permissions, filters, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request

from django.db.models import Count
from django.db import transaction
from django.db.models import F
from .models import ForumPost, ForumPostComment, ForumPostLike
from .serializers import ForumPostSerializer, ForumPostCommentSerializer


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
    def perform_create(self, serializer):  # type: ignore[override]
        # Force the author to the current user
        serializer.save(author=self.request.user)

    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "content", "tags"]
    pagination_class = DefaultPageNumberPagination

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
            post.refresh_from_db(fields=["likes_count"])
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
                    ForumPost.objects.filter(pk=post.pk, likes_count__gt=0).update(likes_count=F("likes_count") - 1)
            post.refresh_from_db(fields=["likes_count"])
            serializer = self.get_serializer(post, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ForumPostCommentViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for comments (filter by postId/parentId/mainCommentId).

    - GET /api/forum/comments/?postId=<uuid>          filter by post
    - GET /api/forum/comments/?parentId=<uuid>        filter by parent comment
    - POST /api/forum/comments/                        create
    - others same as standard REST actions
    """

    queryset = ForumPostComment.objects.select_related("author", "post", "reply_to_user", "parent", "main_comment")
    serializer_class = ForumPostCommentSerializer
    # Read-only for anonymous, write requires auth
    def get_permissions(self):  # type: ignore[override]
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        post_id = self.request.query_params.get("postId")
        parent_id = self.request.query_params.get("parentId")
        main_comment_id = self.request.query_params.get("mainCommentId")
        if post_id:
            qs = qs.filter(post_id=post_id)
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        if main_comment_id:
            qs = qs.filter(main_comment_id=main_comment_id)
        # Optional filter: only main comments (no parent)
        is_main = self.request.query_params.get("isMain")
        if is_main in {"1", "true", "True"}:
            qs = qs.filter(parent__isnull=True)
        # Annotate total number of replies under the same main thread, only for main comments
        qs = qs.annotate(
            replies_count_main=Count("all_replies", distinct=True),
        )
        # Consistent ordering: latest first
        return qs.order_by("-created_at")

    def perform_create(self, serializer):  # type: ignore[override]
        # Always set the author to current user; derive reply_to_user and main from parent if provided
        parent: ForumPostComment | None = serializer.validated_data.get("parent")
        reply_to_user = None
        main_comment = None
        if parent:
            reply_to_user = parent.author
            main_comment = parent if parent.parent_id is None else parent.main_comment
        serializer.save(author=self.request.user, reply_to_user=reply_to_user, main_comment=main_comment)
