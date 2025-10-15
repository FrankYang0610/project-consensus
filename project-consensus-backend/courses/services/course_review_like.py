from __future__ import annotations

import logging
from django.db import transaction
from django.db.models import F

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
            CourseReview.objects.filter(pk=review.pk, likes_count__gt=0).update(
                likes_count=F("likes_count") - 1
            )
            return False

        like = CourseReviewLike.objects.create(review=review, user=user)
        CourseReview.objects.filter(pk=review.pk).update(
            likes_count=F("likes_count") + 1
        )

        emit_notification_for_review_like(review=review, user=user, like=like)

        return True
