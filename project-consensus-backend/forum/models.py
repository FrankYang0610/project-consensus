from __future__ import annotations

import uuid
from django.conf import settings
from django.db import models
from django.db.models import (
    BooleanField,
    Case,
    Count,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Value,
    When,
)
from django.utils import timezone
 
class ForumPostQuerySet(models.QuerySet):
    """
    Custom queryset for ForumPost to encapsulate common select/annotate patterns.

    This keeps list/detail/user-activity views DRY and ensures that any future
    changes to the eager-loading strategy only need to be updated in one place.
    """

    def with_details(self) -> "ForumPostQuerySet":
        """
        Attach common related objects used by serializers and views:
        - author and author.profile
        - comments and likes relations
        """
        return (
            self.select_related("author", "author__profile")
            .prefetch_related("comments", "likes")
        )

    def with_comments_count(self) -> "ForumPostQuerySet":
        """Annotate total comments_count for each post."""
        return self.annotate(comments_count=Count("comments", distinct=True))

    def with_user_interaction(self, user) -> "ForumPostQuerySet":
        """
        Annotate is_liked for a given user.

        - For authenticated users: exists subquery on ForumPostLike
        - For anonymous users: constant False (BooleanField)
        """
        if user is not None and getattr(user, "is_authenticated", False):
            return self.annotate(
                is_liked=Exists(
                    ForumPostLike.objects.filter(
                        post_id=OuterRef("id"),
                        user=user,
                    )
                )
            )
        return self.annotate(is_liked=Value(False, output_field=BooleanField()))


class ForumPost(models.Model):
    """Forum post model.

    Field mapping to frontend ForumPost type:
    - id: UUID primary key
    - title: post title
    - content: HTML body
    - author: FK to user (frontend expects nested Author derived from Profile)
    - created_at: creation timestamp
    - tags: list of strings (JSON)
    - likes_count: integer like count (isLiked is session-level, not stored)
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_posts")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    tags = models.JSONField(default=list, blank=True)
    likes_count = models.PositiveIntegerField(default=0)
    is_anonymous = models.BooleanField(default=False) # Whether the post should display the author as Anonymous on the client
    is_edited = models.BooleanField(default=False)  # Whether the post has been edited after creation

    objects: ForumPostQuerySet = ForumPostQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "ForumPost"
        verbose_name_plural = "ForumPosts"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.title}"

    def increment_like(self) -> None:
        """Atomically increment likes_count for this post."""
        ForumPost.objects.filter(pk=self.pk).update(likes_count=F("likes_count") + 1)

    def decrement_like(self) -> None:
        """Atomically decrement likes_count for this post without going below zero."""
        ForumPost.objects.filter(pk=self.pk).update(
            likes_count=Case(
                When(likes_count__gt=0, then=F("likes_count") - 1),
                default=Value(0),
                output_field=IntegerField(),
            )
        )
class ForumPostCommentQuerySet(models.QuerySet):
    """
    Custom queryset for ForumPostComment to share common eager-loading
    and per-user interaction annotations.
    """

    def with_details(self) -> "ForumPostCommentQuerySet":
        """
        Attach common related objects used by serializers:
        - author, author.profile
        - post
        - likes
        """
        return (
            self.select_related("author", "author__profile", "post", "reply_to")
            .prefetch_related("likes")
        )

    def with_replies_count(self) -> "ForumPostCommentQuerySet":
        """Annotate direct replies_count (including soft-deleted replies)."""
        return self.annotate(replies_count=Count("replies", distinct=True))

    def with_user_interaction(self, user) -> "ForumPostCommentQuerySet":
        """
        Annotate is_liked for a given user.

        - For authenticated users: exists subquery on ForumCommentLike
        - For anonymous users: constant False (BooleanField)
        """
        if user is not None and getattr(user, "is_authenticated", False):
            return self.annotate(
                is_liked=Exists(
                    ForumCommentLike.objects.filter(
                        comment_id=OuterRef("id"),
                        user=user,
                    )
                )
            )
        return self.annotate(is_liked=Value(False, output_field=BooleanField()))


class ForumPostComment(models.Model):
    """Forum comment model (flat with optional reply target).

    Conventions:
    - reply_to is null: comment replying to the post
    - reply_to is not null: comment replying to another comment
    - is_deleted: soft deletion flag
    - likes_count: integer like count
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name="comments")
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    content = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_comments")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_deleted = models.BooleanField(default=False)
    likes_count = models.PositiveIntegerField(default=0)
    is_anonymous = models.BooleanField(default=False)  # Whether the comment should display the author as Anonymous on the client

    objects: ForumPostCommentQuerySet = ForumPostCommentQuerySet.as_manager()

    class Meta:
        # Default to oldest-first for comments / 评论按时间正序（最早在前）
        ordering = ["created_at", "id"]
        verbose_name = "ForumPostComment"
        verbose_name_plural = "ForumPostComments"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.author_id} -> {self.post_id}"

    def increment_like(self) -> None:
        """Atomically increment likes_count for this comment."""
        ForumPostComment.objects.filter(pk=self.pk).update(likes_count=F("likes_count") + 1)

    def decrement_like(self) -> None:
        """Atomically decrement likes_count for this comment without going below zero."""
        ForumPostComment.objects.filter(pk=self.pk).update(
            likes_count=Case(
                When(likes_count__gt=0, then=F("likes_count") - 1),
                default=Value(0),
                output_field=IntegerField(),
            )
        )


class ForumPostLike(models.Model):
    """Forum post like relation

    - Internal relation table; its primary key is not exposed to the frontend.
    - Uses BigAutoField as a surrogate PK for smaller/faster indexes than UUID.
      Row-level uniqueness is enforced by (post, user) unique constraint.

    - 仅作为内部关联表使用，主键不对外暴露。
    - 主键采用 BigAutoField（自增整型），索引更小、查询更快；
      行唯一性通过 (post, user) 唯一约束保证。
    """

    # Surrogate primary key; lighter than UUID and sufficient for internal use only
    # 内部用的替代主键；比 UUID 更轻量，足以满足需求
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
        return f"{self.user_id} liked {self.post_id}"


class ForumCommentLike(models.Model):
    """Forum comment like relation

    - Internal relation table; its primary key is not exposed to the frontend.
    - Uses BigAutoField as a surrogate PK; row-level uniqueness via (comment, user).

    - 仅作为内部关联表使用，主键不对外暴露。
    - 主键采用 BigAutoField（自增整型），索引更小、查询更快；
      行唯一性通过 (comment, user) 唯一约束保证。
    """

    id = models.BigAutoField(primary_key=True)
    comment = models.ForeignKey(ForumPostComment, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_comment_likes")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        unique_together = ("comment", "user")
        indexes = [
            models.Index(fields=["comment", "user"]),
        ]
        verbose_name = "ForumCommentLike"
        verbose_name_plural = "ForumCommentLikes"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.user_id} liked {self.comment_id}"
