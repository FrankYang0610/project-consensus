from __future__ import annotations

import logging
from django.db import transaction

from core.utils import (
    delete_images_in_html,
    extract_image_srcs_from_html,
    delete_storage_object_by_url,
)

from ..models import CourseReview, CourseReviewReply

logger = logging.getLogger(__name__)


# =============================================================================
# Image Cleanup Functions
# =============================================================================

def cleanup_removed_images_for_review(*, before_html: str, review_after_update: CourseReview) -> None:
    """Schedule cleanup for images removed during a review update via on_commit callback.

    This mirrors the forum app pattern to defer storage operations until the
    DB transaction commits successfully.
    """
    old_srcs = extract_image_srcs_from_html(before_html)
    new_srcs = extract_image_srcs_from_html(getattr(review_after_update, "content", ""))
    removed_srcs = old_srcs - new_srcs
    author_id = review_after_update.author_id
    review_pk = review_after_update.pk

    def _cleanup(removed=removed_srcs, owner_id=author_id, pk=review_pk):
        try:
            for src in removed:
                delete_storage_object_by_url(src, owner_user_id=owner_id)
        except Exception as e:
            logger.warning(
                f"Failed to delete removed images in course review {pk}: {e}",
                exc_info=True,
            )

    transaction.on_commit(_cleanup)


def cleanup_removed_images_for_reply(*, before_html: str, reply_after_update: CourseReviewReply) -> None:
    """Schedule cleanup for images removed during a reply update via on_commit callback.

    This follows the same pattern as review image cleanup.
    """
    old_srcs = extract_image_srcs_from_html(before_html)
    new_srcs = extract_image_srcs_from_html(getattr(reply_after_update, "content", ""))
    removed_srcs = old_srcs - new_srcs
    author_id = reply_after_update.author_id
    reply_pk = reply_after_update.pk

    def _cleanup(removed=removed_srcs, owner_id=author_id, pk=reply_pk):
        try:
            for src in removed:
                delete_storage_object_by_url(src, owner_user_id=owner_id)
        except Exception as e:
            logger.warning(
                f"Failed to delete removed images in course review reply {pk}: {e}",
                exc_info=True,
            )

    transaction.on_commit(_cleanup)


def delete_review_images(*, review: CourseReview) -> None:
    """Delete all images in a course review content.
    
    This is used when hard deleting a review.
    """
    try:
        delete_images_in_html(getattr(review, "content", ""), owner_user_id=review.author_id)
    except Exception as e:
        logger.warning(
            f"Failed to delete images in course review {review.pk}: {e}",
            exc_info=True,
        )


def delete_reply_images(*, reply: CourseReviewReply) -> None:
    """Delete all images in a course review reply content.
    
    This is used when soft deleting a reply.
    """
    try:
        delete_images_in_html(getattr(reply, "content", ""), owner_user_id=reply.author_id)
    except Exception as e:
        logger.warning(
            f"Failed to delete images in course review reply {reply.pk}: {e}",
            exc_info=True,
        )
