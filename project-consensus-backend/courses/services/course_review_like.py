from __future__ import annotations

import logging
from django.db import transaction

from .course_notification import emit_notification_for_review_like

from ..models import (
    CourseReview,
    CourseReviewLike,
)


logger = logging.getLogger(__name__)


def toggle_course_review_like(*, user, review: CourseReview) -> bool:
    """Toggle like for a course review.

    Returns True if now liked, False if unliked.
    Also emits a notification on like (best-effort, non-blocking) to the review author.
    """
    with transaction.atomic():
        existing = CourseReviewLike.objects.filter(review=review, user=user).first()
        if existing:
            existing.delete()
            review.decrement_like()
            return False

        like = CourseReviewLike.objects.create(review=review, user=user)
        review.increment_like()

        emit_notification_for_review_like(review=review, user=user, like=like)

        return True
