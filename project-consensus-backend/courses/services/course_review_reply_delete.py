from __future__ import annotations

from django.contrib.auth import get_user_model

from ..models import CourseReviewReply
from .course_aggregates import soft_delete_reply_and_recompute_counts

User = get_user_model()


def delete_course_review_reply(user: User, reply: CourseReviewReply) -> None:
    """Soft delete a course review reply.
    
    Args:
        user: The user deleting the reply
        reply: The reply to delete
        
    Raises:
        PermissionError: If user is not the author
    """
    # Check permissions
    if reply.author != user:
        raise PermissionError("You can only delete your own replies")
    
    # If already soft-deleted, do nothing (idempotent)
    if reply.is_deleted:
        return
    
    soft_delete_reply_and_recompute_counts(reply=reply)
