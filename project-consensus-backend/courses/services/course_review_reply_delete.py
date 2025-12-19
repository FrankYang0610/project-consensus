from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from ..models import CourseReviewReply
from .course_aggregates import recompute_review_replies_count

User = get_user_model()


def delete_course_review_reply(user: User, reply: CourseReviewReply) -> None:
    """
    Soft delete a course review reply.

    Behavior:
    - Only the author can delete their reply.
    - Idempotent: if already soft-deleted, do nothing.
    - Marks is_deleted=True, clears content, and recomputes the parent review's replies_count within the same transaction.
    """
    if reply.author != user:
        raise PermissionError("You can only delete your own replies")

    if reply.is_deleted:
        return

    review = reply.review
    with transaction.atomic():
        CourseReviewReply.objects.filter(pk=reply.pk).update(is_deleted=True, content="")
        recompute_review_replies_count(review=review)

