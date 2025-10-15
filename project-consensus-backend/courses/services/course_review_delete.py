from __future__ import annotations

from django.contrib.auth import get_user_model

from ..models import CourseReview
from .course_aggregates import delete_review_and_cleanup_images

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
    
    delete_review_and_cleanup_images(review=review)


