from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone


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
