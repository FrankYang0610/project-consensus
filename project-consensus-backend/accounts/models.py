from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils import timezone


User = get_user_model()


class Profile(models.Model):
    """User profile model.

    Notes:
    - One-to-one with the built-in Django User; adds nickname and avatar;
    - The frontend "Author" type (id/name/avatar) can be produced from this
      model or the related user.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    nickname = models.CharField(max_length=15, unique=True, help_text="Unique display name")
    avatar_url = models.URLField(blank=True, help_text="Avatar URL (optional)")
    pronouns = models.CharField(max_length=100, blank=True, help_text="Pronouns (optional)")
    show_forum_posts_publicly = models.BooleanField(default=True, help_text="Show my forum posts publicly")
    show_forum_post_comments_publicly = models.BooleanField(default=True, help_text="Show my forum comments publicly")
    show_course_reviews_publicly = models.BooleanField(default=True, help_text="Show my course reviews publicly")
    last_nickname_updated_at = models.DateTimeField(null=True, blank=True, help_text="Last nickname change time")
    is_account_active = models.BooleanField(default=True, help_text="Account is active (can log in)")
    forum_posts_count = models.PositiveIntegerField(default=0, help_text="Total forum posts created by the user")
    forum_post_comments_count = models.PositiveIntegerField(default=0, help_text="Total forum comments created by the user")
    course_reviews_count = models.PositiveIntegerField(default=0, help_text="Total course reviews created by the user")

    class Meta:
        verbose_name = "Profile"
        verbose_name_plural = "Profiles"
        indexes = [
            # Trigram GIN index to speed up search on nickname
            GinIndex(
                fields=["nickname"],
                name="profile_nickname_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - simple text representation
        return self.nickname or self.user.get_username()

    @property
    def author_payload(self) -> dict:
        """Return an Author-shaped dict: {"id","name","avatar"}.

        - id: uses user primary key
        - name: prefer nickname, fallback to Django username
        - avatar: use avatar_url (may be empty)
        """

        return {
            "id": str(self.user.pk),
            "name": self.nickname or self.user.get_username(),
            "avatar": self.avatar_url or None,
        }

    def days_until_nickname_update_allowed(self) -> int | None:
        """
        Return remaining days before the nickname can be changed again.

        Business rule:
        - Nickname can be updated at most once every 14 days.
        - Returns None when there is no active restriction.
        """
        if not self.last_nickname_updated_at:
            return None

        days_since_update = (timezone.now() - self.last_nickname_updated_at).days
        if days_since_update >= 14:
            return None
        return 14 - days_since_update

