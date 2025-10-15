from __future__ import annotations

from django.db import transaction
from django.contrib.auth import get_user_model

from ..models import CourseReview
from ..security.html import sanitize_course_review_html
from .course_aggregates import (
    recompute_course_aggregates_after_review_change,
)
from .course_image_cleanup import (
    cleanup_removed_images_for_review,
)
from .course_review_read import prepare_course_review_for_serialization

User = get_user_model()


def mark_review_edited_if_fields_changed(*, review: CourseReview, incoming_keys: set[str]) -> None:
    """Mark review as edited when editable fields are changed.

    Editable fields include textual content, anonymity, onlyText flag, rating,
    attribute fields, and term fields.
    """
    editable_fields = {
        "content",
        "is_anonymous",
        "only_text",
        "overall_rating",
        "attr_difficulty",
        "attr_workload",
        "attr_grading",
        "attr_gain",
        "term_year",
        "term_semester",
    }
    if incoming_keys & editable_fields:
        CourseReview.objects.filter(pk=review.pk).update(is_edited=True)


def update_course_review(user: User, review: CourseReview, payload: dict) -> CourseReview:
    """Update an existing course review with business logic.
    
    Args:
        user: The user updating the review
        review: The review to update
        payload: Updated review data
        
    Returns:
        The updated review instance
    """
    # Check permissions
    if review.author != user:
        raise PermissionError("You can only update your own reviews")
    
    # Sanitize content if provided
    if "content" in payload:
        payload["content"] = sanitize_course_review_html(payload["content"])
    
    before_html = review.content
    
    with transaction.atomic():
        # Update fields
        for key, value in payload.items():
            setattr(review, key, value)
        
        review.is_edited = True
        review.save()
        
        # Handle side effects
        cleanup_removed_images_for_review(before_html=before_html, review_after_update=review)
        recompute_course_aggregates_after_review_change(course=review.course)
    
    return prepare_course_review_for_serialization(review, user)
