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


class EmailVerification(models.Model):
    """Email verification record for the demo register flow.

    Used by:
    - send_verification_code: create (email, code)
    - register: validate code within TTL and unused, then create user/profile

    Production: integrate a real email provider and add guardrails
    (rate limiting / deny lists / bounce handling, etc.).
    """

    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=16)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["email", "created_at"]),
        ]
        verbose_name = "Email verification"
        verbose_name_plural = "Email verifications"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.email} / {self.code} / used={self.is_used}"
