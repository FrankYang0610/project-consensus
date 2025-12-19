from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from ..models import CourseReview
from .course_aggregates import recompute_course_aggregates_after_review_change
from .course_image_cleanup import delete_review_images

User = get_user_model()


def delete_course_review(user: User, review: CourseReview) -> None:
    """Delete a course review with business logic.
    
    Args:
        user: The user deleting the review
        review: The review to delete
        
    Raises:
        PermissionError: If user is not the author
    """
    # Check permissions
    if review.author != user:
        raise PermissionError("You can only delete your own reviews")

    course = review.course
    delete_review_images(review=review)

    with transaction.atomic():
        # Ensure we only increment the deleted reviews counter when this call
        # actually removes the review row from the database (i.e. transition
        # from existing -> non‑existing).
        deleted_count, _ = review.delete()
        if deleted_count == 0:
            # Already deleted or does not exist – no-op: do not increment
            # counters or recompute aggregates.
            return

        course.increment_deleted_reviews_count()
        recompute_course_aggregates_after_review_change(course=course)


