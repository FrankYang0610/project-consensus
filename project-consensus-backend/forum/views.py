from __future__ import annotations

from rest_framework import viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import ForumPost, ForumPostComment
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
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "content", "tags"]
    pagination_class = DefaultPageNumberPagination


class ForumPostCommentViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for comments (filter by postId/parentId).

    - GET /api/forum/comments/?postId=<uuid>          filter by post
    - GET /api/forum/comments/?parentId=<uuid>        filter by parent comment
    - POST /api/forum/comments/                        create
    - others same as standard REST actions
    """

    queryset = ForumPostComment.objects.select_related("author", "post", "reply_to_user", "parent")
    serializer_class = ForumPostCommentSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        post_id = self.request.query_params.get("postId")
        parent_id = self.request.query_params.get("parentId")
        if post_id:
            qs = qs.filter(post_id=post_id)
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        # Optional filter: only main comments (no parent)
        is_main = self.request.query_params.get("isMain")
        if is_main in {"1", "true", "True"}:
            qs = qs.filter(parent__isnull=True)
        return qs
