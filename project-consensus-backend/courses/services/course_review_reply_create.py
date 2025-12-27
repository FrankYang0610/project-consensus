from __future__ import annotations

import logging
from django.db import transaction
from django.contrib.auth import get_user_model

from ..models import CourseReview, CourseReviewReply
from ..security.html import sanitize_course_text_html
from .course_notification import emit_notifications_for_new_reply
from .course_aggregates import recompute_review_replies_count
from .course_review_reply_read import prepare_course_review_reply_for_serialization

User = get_user_model()

logger = logging.getLogger(__name__)


def create_course_review_reply(user: User, review: CourseReview, payload: dict) -> CourseReviewReply:
    """Create a new reply to a course review.
    
    Args:
        user: The user creating the reply
        review: The review being replied to
        payload: Reply data (content, reply_to_id, is_anonymous)
        
    Returns:
        The created reply instance
    """
    # Sanitize content
    if "content" in payload:
        payload["content"] = sanitize_course_text_html(payload["content"])
    
    with transaction.atomic():
        instance = CourseReviewReply.objects.create(
            author=user,
            review=review,
            **payload
        )
        recompute_review_replies_count(review=review)
    
    emit_notifications_for_new_reply(reply=instance, actor=user)
    return prepare_course_review_reply_for_serialization(instance, user)
