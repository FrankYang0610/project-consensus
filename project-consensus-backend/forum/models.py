from __future__ import annotations

import uuid

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import (
    BooleanField,
    Case,
    Count,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Q,
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
        if user is not None and user.is_authenticated:
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
    created_at = models.DateTimeField(default=timezone.now)
    tags = models.JSONField(default=list, blank=True)
    likes_count = models.PositiveIntegerField(default=0)
    is_anonymous = models.BooleanField(default=False) # Whether the post should display the author as Anonymous on the client
    is_edited = models.BooleanField(default=False)  # Whether the post has been edited after creation
    has_content_warning = models.BooleanField(default=False)  # Whether the post is marked with a content warning (e.g. misleading or uncomfortable)

    objects: ForumPostQuerySet = ForumPostQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "ForumPost"
        verbose_name_plural = "ForumPosts"
        indexes = [
            # Trigram GIN indexes for full-text-like search on title/content
            GinIndex(
                fields=["title"],
                name="forumpost_title_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
            GinIndex(
                fields=["content"],
                name="forumpost_content_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
            models.Index(
                fields=["created_at"],
                name="forumpost_created_idx",
            ),
        ]

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
        if user is not None and user.is_authenticated:
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
    created_at = models.DateTimeField(default=timezone.now)
    is_deleted = models.BooleanField(default=False)
    likes_count = models.PositiveIntegerField(default=0)
    is_anonymous = models.BooleanField(default=False)  # Whether the comment should display the author as Anonymous on the client

    objects: ForumPostCommentQuerySet = ForumPostCommentQuerySet.as_manager()

    class Meta:
        # Default to oldest-first for comments
        ordering = ["created_at", "id"]
        verbose_name = "ForumPostComment"
        verbose_name_plural = "ForumPostComments"
        indexes = [
            models.Index(
                fields=["is_deleted", "created_at"],
                name="forumcmt_del_created_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="forumcmt_created_idx",
            ),
            GinIndex(
                fields=["content"],
                name="forumcomment_content_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]
        constraints = [
            models.CheckConstraint(  # - Deleted comments must have empty content
                condition=Q(is_deleted=False) | Q(content=""),
                name="forumcomment_deleted_content_empty",
            ),
        ]

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
    """

    # Surrogate primary key; lighter than UUID and sufficient for internal use only
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_post_likes")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(
                fields=["post", "user"],
                name="forumpostlike_post_user_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="forumpostlike_created_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["post", "user"],
                name="forumpostlike_post_user_unique",
            ),
        ]
        verbose_name = "ForumPostLike"
        verbose_name_plural = "ForumPostLikes"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.user_id} liked {self.post_id}"


class ForumCommentLike(models.Model):
    """Forum comment like relation

    - Internal relation table; its primary key is not exposed to the frontend.
    - Uses BigAutoField as a surrogate PK; row-level uniqueness via (comment, user).
    """

    id = models.BigAutoField(primary_key=True)
    comment = models.ForeignKey(ForumPostComment, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_comment_likes")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(
                fields=["comment", "user"],
                name="forumcmtlike_comment_user_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="forumcmtlike_created_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user"],
                name="forumcommentlike_comment_user_unique",
            ),
        ]
        verbose_name = "ForumCommentLike"
        verbose_name_plural = "ForumCommentLikes"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.user_id} liked {self.comment_id}"


class ForumCommentContentBackup(models.Model):
    """
    Admin-only model for backing up comment content before soft deletion.
    This enables restore functionality in the admin interface.
    """
    comment_id = models.UUIDField(primary_key=True)
    content = models.TextField()
    deleted_at = models.DateTimeField(default=timezone.now)
    deleted_by = models.CharField(max_length=150, blank=True)  # Admin username

    class Meta:
        db_table = "forum_comment_content_backup"
        verbose_name = "Comment Content Backup"
        verbose_name_plural = "Comment Content Backups"

    def __str__(self) -> str:  # pragma: no cover
        return f"Backup for comment {self.comment_id}"
