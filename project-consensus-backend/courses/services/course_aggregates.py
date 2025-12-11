from __future__ import annotations

import logging
from django.db import transaction

from ..models import CourseReview, CourseReviewReply, Course
from teachers.services import recompute_teacher_aggregates

from .course_image_cleanup import delete_review_images

logger = logging.getLogger(__name__)


def recompute_course_aggregates_after_review_change(*, course: Course) -> None:
    """Recompute course aggregates after review creation/update/deletion.
    
    This is a centralized function for all course aggregate updates.
    """
    with transaction.atomic():
        course.recompute_aggregates()
        recompute_teachers_aggregates(course)


def recompute_teachers_aggregates(course: Course) -> None:
    """Update rating aggregates for all teachers of the given course.

    This should be called after any course review is created, updated, or deleted
    to keep teacher ratings in sync with their course reviews.
    """

    for teacher in course.teachers.all():
        recompute_teacher_aggregates(teacher)


def recompute_review_replies_count(*, review: CourseReview) -> None:
    """Recompute replies count for a review.
    
    This is a centralized function for review replies count updates.
    """
    review.recompute_replies_count()


# =============================================================================
# Review Management Functions
# =============================================================================

def delete_review_and_cleanup_images_and_recompute_aggregates(*, review: CourseReview) -> None:
    """Hard delete a course review and cleanup related images.

    Also recomputes course and teacher aggregates inside the same transaction.
    """

    course: Course = review.course
    delete_review_images(review=review)
    with transaction.atomic():
        review.delete()
        course.recompute_aggregates()
        recompute_teachers_aggregates(course)


def soft_delete_reply_and_recompute_counts(*, reply: CourseReviewReply) -> None:
    """Soft delete a review reply and recompute parent review's replies_count.

    For parity with forum comments, we keep the row and clear content.
    """
    if reply.is_deleted:
        return
    review = reply.review
    with transaction.atomic():
        CourseReviewReply.objects.filter(pk=reply.pk).update(is_deleted=True, content="")
        review.recompute_replies_count()


