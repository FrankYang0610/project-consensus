from __future__ import annotations

import logging
from django.db import transaction, IntegrityError
from django.contrib.auth import get_user_model

from ..models import CourseReview, Course
from ..security.html import sanitize_course_review_html
from .course_exceptions import AlreadyReviewedError
from .course_aggregates import recompute_course_aggregates_after_review_change
from .course_review_utils import _is_constraint_violation
from .course_review_read import prepare_course_review_for_serialization

User = get_user_model()

logger = logging.getLogger(__name__)


def create_course_review(user: User, course: Course, payload: dict) -> CourseReview:
    """Create a new course review with business logic.
    
    Args:
        user: The user creating the review
        course: The course being reviewed
        payload: Review data (content, rating, attributes, etc.)
        
    Returns:
        The created review instance
        
    Raises:
        AlreadyReviewedError: If user has already reviewed this course
    """
    # Fast path pre-check
    if CourseReview.objects.filter(author=user, course=course).exists():
        raise AlreadyReviewedError("You have already reviewed this course.")
    
    # Sanitize content
    if "content" in payload:
        payload["content"] = sanitize_course_review_html(payload["content"])
    
    try:
        with transaction.atomic():
            instance = CourseReview.objects.create(
                author=user,
                course=course,
                **payload
            )
            recompute_course_aggregates_after_review_change(course=course)
            # Prepare for serialization (add presentation fields)
            return prepare_course_review_for_serialization(instance, user)
    except IntegrityError as e:
        if _is_constraint_violation(e, "unique_course_review_per_user"):
            raise AlreadyReviewedError("You have already reviewed this course.")
        raise


