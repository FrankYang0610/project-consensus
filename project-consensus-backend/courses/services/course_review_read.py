from __future__ import annotations

from django.contrib.auth import get_user_model

from ..models import CourseReview
from ..presentation.author import get_course_review_author_display

User = get_user_model()


def prepare_course_review_for_serialization(review: CourseReview, request_user: User | None = None) -> CourseReview:
    """Prepare a review instance for serialization by adding computed fields.
    
    Args:
        review: The review instance
        request_user: Current request user (for author display logic)
        
    Returns:
        The review instance with added computed fields
    """
    # Add author display logic
    review._author_display = get_course_review_author_display(review, request_user)
    return review

