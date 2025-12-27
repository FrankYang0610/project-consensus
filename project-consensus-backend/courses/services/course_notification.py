from __future__ import annotations

import logging
from django.utils import timezone

from notifications import NotificationType
from notifications.events import DomainEvent, emit

from ..models import CourseReview, CourseReviewReply

logger = logging.getLogger(__name__)


def emit_notifications_for_new_reply(*, reply: CourseReviewReply, actor) -> None:
    """Emit notifications for a new course review reply (best-effort).

    - If replying to a specific reply, notify that reply's author; otherwise notify the review author.
    - Skips when actor == recipient.
    """
    try:
        review = reply.review
        # Get the author of the reply being replied to, or the review author
        target = reply.reply_to.author if reply.reply_to else review.author
        if target.pk == actor.pk:
            return
        notification_type = (
            NotificationType.COURSE_REVIEW_REPLY_REPLIED
            if reply.reply_to
            else NotificationType.COURSE_REVIEW_REPLIED
        )
        emit(
            DomainEvent(
                type=notification_type,
                recipient_id=target.pk,
                actor_id=actor.pk,
                target_app="courses",
                target_model="CourseReviewReply",
                target_id=str(reply.pk),
                route=f"/courses/{review.course.course_id}#review-{review.pk}",
                metadata={
                    "courseId": str(review.course.course_id),
                    "courseReviewId": str(review.pk),
                    "courseReviewReplyId": str(reply.pk),
                    "courseTitle": f"{review.course.subject_code} {review.course.title}",
                },
                content_preview=reply.content,
                referenced_content_preview=review.content,
                created_at=reply.created_at,
            )
        )
    except Exception:
        # Best-effort; do not block business flow on notification failures
        logger.debug("Failed to emit new reply notification", exc_info=True)


def emit_notification_for_review_like(*, review: CourseReview, user, like) -> None:
    """Emit notification for a course review like."""
    if user.pk != review.author_id:
        try:
            emit(
                DomainEvent(
                    type=NotificationType.COURSE_REVIEW_LIKED,
                    recipient_id=review.author_id,
                    actor_id=user.pk,
                    target_app="courses",
                    target_model="CourseReview",
                    target_id=str(review.pk),
                    route=f"/courses/{review.course.course_id}#review-{review.pk}",
                    metadata={
                        "courseId": str(review.course.course_id),
                        "courseReviewId": str(review.pk),
                        "courseTitle": f"{review.course.subject_code} {review.course.title}",
                    },
                    referenced_content_preview=f"{review.course.subject_code} {review.course.title}",
                    created_at=like.created_at,
                )
            )
        except Exception:  # pragma: no cover - best effort
            logger.debug("Failed to emit review like notification", exc_info=True)


def emit_notification_for_reply_like(*, reply: CourseReviewReply, user, like) -> None:
    """Emit notification for a course review reply like."""
    if user.pk != reply.author_id:
        try:
            emit(
                DomainEvent(
                    type=NotificationType.COURSE_REVIEW_REPLY_LIKED,
                    recipient_id=reply.author_id,
                    actor_id=user.pk,
                    target_app="courses",
                    target_model="CourseReviewReply",
                    target_id=str(reply.pk),
                    route=f"/courses/{reply.review.course.course_id}#review-{reply.review.pk}",
                    metadata={
                        "courseId": str(reply.review.course.course_id),
                        "courseReviewId": str(reply.review.pk),
                        "courseReviewReplyId": str(reply.pk),
                        "courseTitle": f"{reply.review.course.subject_code} {reply.review.course.title}",
                    },
                    referenced_content_preview=reply.content,
                    created_at=like.created_at,
                )
            )
        except Exception:  # pragma: no cover - best effort
            logger.debug("Failed to emit review reply like notification", exc_info=True)
