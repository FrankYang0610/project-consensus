from __future__ import annotations

from rest_framework import viewsets, permissions, filters
from rest_framework.response import Response

from .models import ForumPost, ForumComment
from .serializers import ForumPostSerializer, ForumCommentSerializer


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


class ForumCommentViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for comments (filter by postId/parentId).

    - GET /api/forum/comments/?postId=<uuid>          filter by post
    - GET /api/forum/comments/?parentId=<uuid>        filter by parent comment
    - POST /api/forum/comments/                        create
    - others same as standard REST actions
    """

    queryset = ForumComment.objects.select_related("author", "post", "reply_to_user", "parent")
    serializer_class = ForumCommentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        post_id = self.request.query_params.get("postId")
        parent_id = self.request.query_params.get("parentId")
        if post_id:
            qs = qs.filter(post_id=post_id)
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        return qs
