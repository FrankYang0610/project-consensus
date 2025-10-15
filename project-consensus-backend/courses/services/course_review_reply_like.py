from __future__ import annotations

import logging
from django.db import transaction

from .course_notification import emit_notification_for_reply_like

from ..models import (
    CourseReviewReply,
    CourseReviewReplyLike,
)


logger = logging.getLogger(__name__)


def toggle_course_review_reply_like(*, user, reply: CourseReviewReply) -> bool:
    """Toggle like for a course review reply.

    Returns True if now liked, False if unliked.
    Also emits a notification on like (best-effort, non-blocking) to the reply author.
    """
    with transaction.atomic():
        existing = CourseReviewReplyLike.objects.filter(reply=reply, user=user).first()
        if existing:
            existing.delete()
            reply.decrement_like()
            return False

        like = CourseReviewReplyLike.objects.create(reply=reply, user=user)
        reply.increment_like()

        emit_notification_for_reply_like(reply=reply, user=user, like=like)
        return True
