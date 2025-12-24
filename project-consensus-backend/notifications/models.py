from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    """Generic notification for user activities.

    Stores notifications for user activities such as forum posts and course reviews.
    """

    class Type(models.TextChoices):
        # Forum post related notifications
        FORUM_POST_LIKED = "forumPostLiked", "forumPostLiked"
        FORUM_POST_COMMENTED = "forumPostCommented", "forumPostCommented"
        FORUM_POST_COMMENT_LIKED = "forumPostCommentLiked", "forumPostCommentLiked"
        FORUM_POST_COMMENT_REPLIED = "forumPostCommentReplied", "forumPostCommentReplied"
        # Course review related notifications
        COURSE_REVIEW_LIKED = "courseReviewLiked", "courseReviewLiked"
        COURSE_REVIEW_REPLIED = "courseReviewReplied", "courseReviewReplied"
        COURSE_REVIEW_REPLY_LIKED = "courseReviewReplyLiked", "courseReviewReplyLiked"
        COURSE_REVIEW_REPLY_REPLIED = "courseReviewReplyReplied", "courseReviewReplyReplied"

    id = models.BigAutoField(primary_key=True)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_notifications",
        db_column="user_id",
    )
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="triggered_notifications")
    type = models.CharField(max_length=50, choices=Type.choices)

    # Read/delete flags
    is_read = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    # Generic target and metadata (decoupled from other apps)
    # Optional description of the domain object this notification refers to.
    # This replaces hard foreign keys to other apps and allows cross-service portability.
    target_app = models.CharField(max_length=50, blank=True)
    target_model = models.CharField(max_length=50, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    # Suggested client route for navigation (e.g., "/post/{id}" or "/courses/{courseId}")
    route = models.CharField(max_length=200, blank=True)
    # Arbitrary key-value metadata to support client rendering without cross-app queries
    metadata = models.JSONField(default=dict, blank=True)

    # Whether the actor should be displayed as Anonymous (for anonymous forum comments)
    actor_is_anonymous = models.BooleanField(default=False)
    
    # Content preview for better UX (e.g., first 100 chars of reply content)
    content_preview = models.TextField(blank=True)
    # Unified preview of the referenced content
    referenced_content_preview = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["created_at"],
                name="notif_created_idx",
            ),
            models.Index(
                fields=["recipient", "is_read", "is_deleted", "created_at"],
                name="notif_rec_read_flags_crt_idx",
            ),
            models.Index(
                fields=["recipient", "is_read"],
                name="notif_rec_read_idx",
            ),
        ]
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self) -> str:  # pragma: no cover
        return f"notif:{self.id} -> {self.recipient_id} [{self.type}]"

