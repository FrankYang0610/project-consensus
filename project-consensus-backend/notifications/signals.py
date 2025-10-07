from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification
from .runtime import publish


@receiver(post_save, sender=Notification)
def _on_notification_created(sender, instance: Notification, created: bool, **kwargs):  # pragma: no cover - small side effect
    if not created:
        return
    # Compute unread count and push to subscribers of this recipient
    unread_count = Notification.objects.filter(recipient_id=instance.recipient_id, is_read=False, is_deleted=False).count()
    try:
        publish(str(instance.recipient_id), {"type": "notification", "unreadCount": unread_count})
    except Exception:
        # Best-effort only; never break main flow
        pass


