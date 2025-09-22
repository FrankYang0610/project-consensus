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
        verbose_name = "Post"
        verbose_name_plural = "Posts"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.title}"


class ForumComment(models.Model):
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
    content = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_comments")
    reply_to_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="forum_reply_targets")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_deleted = models.BooleanField(default=False)
    likes_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Comment"
        verbose_name_plural = "Comments"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.author_id} -> {self.post_id}"
