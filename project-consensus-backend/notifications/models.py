from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    """Generic notification for user activities.

    Stored in the original accounts_notification table to preserve existing migrations.
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
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="triggered_notifications")
    type = models.CharField(max_length=50, choices=Type.choices)

    # Read/delete flags
    is_read = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    # Targets (SET_NULL to preserve notification rows after content deletion)
    forumpost = models.ForeignKey("forum.ForumPost", null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications")
    forumpostcomment = models.ForeignKey("forum.ForumPostComment", null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications")
    coursereview = models.ForeignKey("courses.CourseReview", null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications")
    coursereviewreply = models.ForeignKey("courses.CourseReviewReply", null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications")

    # Whether the actor should be displayed as Anonymous (for anonymous forum comments)
    actor_is_anonymous = models.BooleanField(default=False)
    
    # Content preview for better UX (e.g., first 100 chars of reply content)
    content_preview = models.TextField(blank=True)
    # Unified preview of the referenced content
    referenced_content_preview = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_read", "is_deleted", "created_at"]),
            models.Index(fields=["user", "is_read"]),
        ]
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self) -> str:  # pragma: no cover
        return f"notif:{self.id} -> {self.user_id} [{self.type}]"

