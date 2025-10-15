from __future__ import annotations

import logging
from django.db import transaction
from django.contrib.auth import get_user_model

from ..models import CourseReview, CourseReviewReply
from ..security.html import sanitize_course_text_html
from .course_notification import emit_notifications_for_new_reply
from .course_exceptions import ReplyNotFoundError
from .course_aggregates import recompute_review_replies_count

User = get_user_model()

logger = logging.getLogger(__name__)


def find_reply_to_user(reply_to_user_id: str | None) -> User | None:
    """Find the user to reply to by ID.
    
    Args:
        reply_to_user_id: The ID of the user to reply to
        
    Returns:
        The user instance if found, None otherwise
        
    Raises:
        ReplyNotFoundError: If the user ID is provided but user not found
    """
    if not reply_to_user_id:
        return None
    
    try:
        return User.objects.get(pk=reply_to_user_id)
    except User.DoesNotExist:
        raise ReplyNotFoundError(f"User with ID {reply_to_user_id} not found")


def create_course_review_reply(user: User, review: CourseReview, payload: dict, reply_to_user_id: str | None = None) -> CourseReviewReply:
    """Create a new reply to a course review.
    
    Args:
        user: The user creating the reply
        review: The review being replied to
        payload: Reply data (content)
        reply_to_user_id: Optional ID of the user being replied to
        
    Returns:
        The created reply instance
        
    Raises:
        ReplyNotFoundError: If reply_to_user_id is provided but user not found
    """
    # Sanitize content
    if "content" in payload:
        payload["content"] = sanitize_course_text_html(payload["content"])
    
    reply_to_user = find_reply_to_user(reply_to_user_id)
    
    with transaction.atomic():
        instance = CourseReviewReply.objects.create(
            author=user,
            review=review,
            reply_to_user=reply_to_user,
            **payload
        )
        recompute_review_replies_count(review=review)
    
    emit_notifications_for_new_reply(reply=instance, actor=user)
    return instance
