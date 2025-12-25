from __future__ import annotations

import logging
from django.db import transaction
from django.db.models import Count

from accounts.services import (
    decrement_forum_posts_count,
    decrement_forum_post_comments_count,
)
from core.utils import delete_images_in_html, delete_storage_object_by_url, extract_image_srcs_from_html

from ..models import ForumPost, ForumPostComment

logger = logging.getLogger(__name__)


def delete_post_and_cleanup_images(*, post: ForumPost) -> None:
    """Hard delete a forum post and cleanup related images."""
    author_id = post.author_id

    try:
        delete_images_in_html(post.content or "", owner_user_id=post.author_id)
    except Exception as e:
        logger.warning(f"Failed to delete images in forum post {post.pk}: {e}", exc_info=True)
    
    # Also cleanup images embedded in all comments (including replies) under this post
    try:
        for comment_content, comment_author_id in (
            ForumPostComment.objects
            .filter(post_id=post.pk)
            .values_list("content", "author_id")
            .iterator(chunk_size=1000)
        ):
            if comment_content and comment_author_id:
                try:
                    delete_images_in_html(comment_content, owner_user_id=comment_author_id)
                except Exception:
                    pass  # Best-effort per comment; continue on failure
    except Exception as e:
        logger.warning(
            f"Failed to cleanup images in comments for forum post {post.pk}: {e}",
            exc_info=True,
        )

    with transaction.atomic():
        ForumPost.objects.select_for_update().get(pk=post.pk)  # Lock the post row to prevent concurrent deletion.

        # Compute how many comments each author has under this post so that user stats can be updated after deletion.
        try:
            existed_comments = list(
                ForumPostComment.objects.filter(post_id=post.pk, is_deleted=False)
                .values("author_id")
                .annotate(count=Count("id"))
            )
        except Exception as e:  # pragma: no cover - defensive logging
            logger.warning("Failed to compute comment counts for forum post %s before delete: %s", post.pk, e, exc_info=True)
            existed_comments = []
    
        deleted_count, _ = post.delete()
        if deleted_count == 0:
            return

        if author_id:
            transaction.on_commit(lambda: decrement_forum_posts_count(user_id=author_id, delta=1))

        for comment in existed_comments:
            user_id = comment.get("author_id")
            count = comment.get("count") or 0
            if user_id and count > 0:
                transaction.on_commit(lambda author_id=user_id, delta=count: decrement_forum_post_comments_count(user_id=author_id, delta=delta))


def cleanup_removed_images_for_post(*, before_html: str, post_after_update: ForumPost) -> None:
    """Schedule cleanup for images removed during a post update via on_commit callback."""
    old_srcs = extract_image_srcs_from_html(before_html)
    new_srcs = extract_image_srcs_from_html(post_after_update.content or "")
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
    if comment.is_deleted:
        return
    try:
        delete_images_in_html(comment.content or "", owner_user_id=comment.author_id)
    except Exception as e:
        logger.warning(f"Failed to delete images in forum comment {comment.pk}: {e}", exc_info=True)
    with transaction.atomic():
        ForumPostComment.objects.filter(pk=comment.pk).update(is_deleted=True, content="")
        if comment.author_id:
            transaction.on_commit(lambda author_id=comment.author_id, delta=1: decrement_forum_post_comments_count(user_id=author_id, delta=delta))


def mark_post_edited_if_fields_changed(*, post: ForumPost, incoming_keys: set[str]) -> None:
    """
    Mark post as edited when editable fields are changed.

    Note: Only user-editable content fields should trigger the `edited` badge. 
    Admin-only flags like has_content_warning must NOT mark the post as edited.
    """
    editable_fields = {"title", "content", "tags", "is_anonymous"}
    if incoming_keys & editable_fields:
        # Set on the instance so a subsequent save() persists it without
        # being overwritten by instance state.
        post.is_edited = True


