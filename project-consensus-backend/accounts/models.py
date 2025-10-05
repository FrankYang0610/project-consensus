from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver


User = get_user_model()


class Profile(models.Model):
    """User profile model.

    Notes:
    - One-to-one with the built-in Django User; adds display name and avatar;
    - The frontend "Author" type (id/name/avatar) can be produced from this
      model or the related user.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=100, blank=True, help_text="展示昵称（不唯一）")
    avatar_url = models.URLField(blank=True, help_text="头像 URL，可为空")
    pronouns = models.CharField(max_length=100, blank=True, help_text="用户代词，可为空")
    show_forum_posts_publicly = models.BooleanField(default=True, help_text="是否公开展示自己发的forum posts")
    show_forum_post_comments_publicly = models.BooleanField(default=True, help_text="是否公开展示自己发的forum post comments")
    show_course_reviews_publicly = models.BooleanField(default=True, help_text="是否公开展示自己发的course reviews")

    class Meta:
        verbose_name = "Profile"
        verbose_name_plural = "Profiles"

    def __str__(self) -> str:  # pragma: no cover - simple text representation
        return self.display_name or self.user.get_username()

    @property
    def author_payload(self) -> dict:
        """Return an Author-shaped dict: {"id","name","avatar"}.

        - id: uses user primary key
        - name: prefer display_name, fallback to Django username
        - avatar: use avatar_url (may be empty)
        """

        return {
            "id": str(self.user.pk),
            "name": self.display_name or self.user.get_username(),
            "avatar": self.avatar_url or None,
        }


class Notification(models.Model):
    """Generic notification for user activities.

    Events covered (as required):
    - forumpost liked / replied
    - forumpostcomment liked / replied
    - coursereview liked / replied

    Use explicit FK field names (forumpost, forumpostcomment, coursereview, coursereviewreply)
    to avoid ambiguity.
    """

    class Type(models.TextChoices):
        FORUM_POST_LIKED = "forumPostLiked", "forumPostLiked"
        FORUM_POST_REPLIED = "forumPostReplied", "forumPostReplied"
        FORUM_POST_COMMENT_LIKED = "forumPostCommentLiked", "forumPostCommentLiked"
        FORUM_POST_COMMENT_REPLIED = "forumPostCommentReplied", "forumPostCommentReplied"
        COURSE_REVIEW_LIKED = "courseReviewLiked", "courseReviewLiked"
        COURSE_REVIEW_REPLIED = "courseReviewReplied", "courseReviewReplied"

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


# Lightweight pub/sub for SSE: publish unread count on create
try:
    from .notifications_runtime import publish  # local runtime bus (in-process)
except Exception:  # pragma: no cover - during migrations/import edge cases
    publish = None  # type: ignore


@receiver(post_save, sender=Notification)
def _on_notification_created(sender, instance: Notification, created: bool, **kwargs):  # pragma: no cover - small side effect
    if not created:
        return
    if publish is None:
        return
    # Compute unread count and push to subscribers of this user
    unread_count = Notification.objects.filter(user_id=instance.user_id, is_read=False, is_deleted=False).count()
    try:
        publish(str(instance.user_id), {"type": "notification", "unreadCount": unread_count})
    except Exception:
        # Best-effort only; never break main flow
        pass
