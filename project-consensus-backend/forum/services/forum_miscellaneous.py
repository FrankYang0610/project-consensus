from __future__ import annotations

import logging
from django.db import transaction

from core.utils import delete_images_in_html, delete_storage_object_by_url, extract_image_srcs_from_html

from ..models import ForumPost, ForumPostComment

logger = logging.getLogger(__name__)


def delete_post_and_cleanup_images(*, post: ForumPost) -> None:
    """Hard delete a forum post and cleanup related images."""
    try:
        delete_images_in_html(getattr(post, "content", ""), owner_user_id=post.author_id)
    except Exception as e:
        logger.warning(f"Failed to delete images in forum post {post.pk}: {e}", exc_info=True)
    with transaction.atomic():
        post.delete()


def cleanup_removed_images_for_post(*, before_html: str, post_after_update: ForumPost) -> None:
    """Schedule cleanup for images removed during a post update via on_commit callback."""
    old_srcs = extract_image_srcs_from_html(before_html)
    new_srcs = extract_image_srcs_from_html(getattr(post_after_update, "content", ""))
    removed_srcs = old_srcs - new_srcs
    author_id = post_after_update.author_id
    post_pk = post_after_update.pk

    def _cleanup(removed=removed_srcs, owner_id=author_id, pk=post_pk):
        try:
            for src in removed:
                delete_storage_object_by_url(src, owner_user_id=owner_id)
        except Exception as e:
            logger.warning(f"Failed to delete removed images in forum post {pk}: {e}", exc_info=True)

    transaction.on_commit(_cleanup)


def soft_delete_comment_and_cleanup_images(*, comment: ForumPostComment) -> None:
    """Soft delete a comment and cleanup embedded images."""
    if getattr(comment, "is_deleted", False):
        return
    try:
        delete_images_in_html(getattr(comment, "content", ""), owner_user_id=comment.author_id)
    except Exception as e:
        logger.warning(f"Failed to delete images in forum comment {comment.pk}: {e}", exc_info=True)
    with transaction.atomic():
        ForumPostComment.objects.filter(pk=comment.pk).update(is_deleted=True, content="")


def mark_post_edited_if_fields_changed(*, post: ForumPost, incoming_keys: set[str]) -> None:
    """Mark post as edited when editable fields are changed."""
    editable_fields = {"title", "content", "tags", "is_anonymous"}
    if incoming_keys & editable_fields:
        post.mark_edited()


