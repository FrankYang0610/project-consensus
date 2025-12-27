from __future__ import annotations

from django.contrib.auth import get_user_model

from ..models import CourseReviewReply
from ..presentation.author import get_course_review_reply_author_display
from .course_exceptions import ReviewNotFoundError

User = get_user_model()


def prepare_course_review_reply_for_serialization(reply: CourseReviewReply, request_user: User | None = None) -> CourseReviewReply:
    """Prepare a reply instance for serialization by adding computed fields.
    
    Args:
        reply: The reply instance
        request_user: Current request user (for author display logic)
        
    Returns:
        The reply instance with added computed fields
    """
    reply._author_display = get_course_review_reply_author_display(reply, request_user)
    return reply


def find_review_for_reply_id(reply_id: str) -> dict:
    """Find review and course information for a given reply ID.
    
    Args:
        reply_id: The UUID of the reply
        
    Returns:
        Dictionary containing replyId, reviewId, and courseId
        
    Raises:
        ReviewNotFoundError: If reply not found or is deleted
    """
    try:
        reply = (
            CourseReviewReply.objects
            .select_related("review__course")
            .filter(pk=reply_id, is_deleted=False)
            .get()
        )
        return {
            "replyId": str(reply.id),
            "reviewId": str(reply.review.id),
            "courseId": str(reply.review.course.course_id),
        }
    except CourseReviewReply.DoesNotExist:
        raise ReviewNotFoundError(f"Reply with ID {reply_id} not found")


