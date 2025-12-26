from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import Avg, Count

from ..models import CourseReview, CourseReviewReply, Course
from teachers.models import Teacher

from .course_image_cleanup import delete_review_images

logger = logging.getLogger(__name__)


def recompute_teacher_aggregates(teacher: Teacher) -> None:
    """Recompute and update teacher's rating metrics from all course reviews.
    """
    # Find all courses taught by this teacher, then get all reviews for those courses
    # Only count reviews with ratings (only_text=False)
    qs = CourseReview.objects.filter(
        course__teachers=teacher,
        only_text=False
    )
    
    agg = qs.aggregate(
        avg=Avg("overall_rating"),
        cnt=Count("id")
    )
    
    count = int(agg.get("cnt") or 0)
    avg = float(agg.get("avg") or 0.0)
    
    # Keep one decimal place as agreed (consistent with course rating)
    score = round(avg, 1) if count > 0 else None
    
    # Update teacher record atomically
    Teacher.objects.filter(pk=teacher.pk).update(
        rating_overall=score,
        rating_reviews_count=count,
    )


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


