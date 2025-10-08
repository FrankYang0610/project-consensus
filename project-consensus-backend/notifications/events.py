from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from django.utils import timezone

from .models import Notification


@dataclass
class DomainEvent:
    type: str
    recipient_id: int
    actor_id: Optional[int] = None
    # Suggested navigation. Example: "/post/{id}" or "/courses/{courseId}"
    route: str = ""
    # Generic target reference for auditing/observability
    target_app: str = ""
    target_model: str = ""
    target_id: str = ""
    # Arbitrary metadata for client rendering
    metadata: Dict[str, Any] = field(default_factory=dict)
    content_preview: str = ""
    referenced_content_preview: str = ""
    # Whether to show actor as anonymous (forum anonymous comments)
    actor_is_anonymous: bool = False
    created_at: Optional[Any] = None


def emit(event: DomainEvent) -> Notification:
    """
    Persist a Notification row decoupled from domain models.
    Best-effort only; upstream callers should not depend on return value for main flow.
    """
    created_at = event.created_at or timezone.now()
    return Notification.objects.create(
        recipient_id=event.recipient_id,
        actor_id=event.actor_id,
        type=event.type,
        created_at=created_at,
        actor_is_anonymous=bool(event.actor_is_anonymous),
        content_preview=event.content_preview or "",
        referenced_content_preview=event.referenced_content_preview or "",
        target_app=event.target_app or "",
        target_model=event.target_model or "",
        target_id=str(event.target_id or ""),
        route=event.route or "",
        metadata=event.metadata or {},
    )


