from __future__ import annotations

import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
 


class ForumPost(models.Model):
    """Forum post model.

    Field mapping to frontend ForumPost type:
    - id: UUID primary key
    - title: post title
    - content: HTML body
    - author: FK to user (frontend expects nested Author derived from Profile)
    - created_at: creation timestamp
    - tags: list of strings (JSON)
    - language: display language label
    - likes_count: integer like count (isLiked is session-level, not stored)
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_posts")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    tags = models.JSONField(default=list, blank=True)
    language = models.CharField(max_length=50, default="")
    likes_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "ForumPost"
        verbose_name_plural = "ForumPosts"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.title}"


class ForumPostComment(models.Model):
    """Forum comment model (two-level: main + reply).

    Conventions:
    - parent is null: main comment (reply to post)
    - parent is not null: reply comment (reply to a main or another reply);
      the field `reply_to_user` indicates the target user being replied to
    - is_deleted: soft deletion flag
    - likes_count: integer like count
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    # Reference to the main (top-level) comment this reply belongs to.
    # For top-level comments, this is null. For replies (any depth), this points to the top-level comment.
    main_comment = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="all_replies")
    content = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_comments")
    reply_to_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="forum_reply_targets")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_deleted = models.BooleanField(default=False)
    likes_count = models.PositiveIntegerField(default=0)

    class Meta:
        # Default to newest-first for comments / 评论按时间倒序（最新在前）
        ordering = ["-created_at"]
        verbose_name = "ForumPostComment"
        verbose_name_plural = "ForumPostComments"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.author_id} -> {self.post_id}"


class ForumPostLike(models.Model):
    """Forum post like relation / 论坛帖子点赞关系

    EN:
    - Internal relation table; its primary key is not exposed to the frontend.
    - Uses BigAutoField as a surrogate PK for smaller/faster indexes than UUID.
      Row-level uniqueness is enforced by (post, user) unique constraint.

    中文：
    - 仅作为内部关联表使用，主键不对外暴露。
    - 主键采用 BigAutoField（自增整型），索引更小、查询更快；
      行唯一性通过 (post, user) 唯一约束保证。
    """

    # EN: Surrogate primary key; lighter than UUID and sufficient for internal use only
    # 中文：内部用的替代主键；比 UUID 更轻量，足以满足需求
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_post_likes")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        unique_together = ("post", "user")
        indexes = [
            models.Index(fields=["post", "user"]),
        ]
        verbose_name = "ForumPostLike"
        verbose_name_plural = "ForumPostLikes"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.user_id} ❤ {self.post_id}"
