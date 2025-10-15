from __future__ import annotations

from django.db import transaction

from .forum_notification import emit_notification_for_post_like, emit_notification_for_comment_like

from ..models import ForumCommentLike, ForumPost, ForumPostComment, ForumPostLike


def toggle_forum_post_like(*, user, post: ForumPost) -> bool:
    """Toggle like for a post.

    Returns True if now liked, False if unliked.
    """
    with transaction.atomic():
        like, created = ForumPostLike.objects.get_or_create(post=post, user=user)
        if created:
            post.increment_like()
            emit_notification_for_post_like(post=post, user=user)
            return True
        else:
            like.delete()
            post.decrement_like()
            return False


def toggle_forum_comment_like(*, user, comment: ForumPostComment) -> bool:
    """Toggle like for a comment.

    Returns True if now liked, False if unliked.
    """
    with transaction.atomic():
        like, created = ForumCommentLike.objects.get_or_create(comment=comment, user=user)
        if created:
            comment.increment_like()
            emit_notification_for_comment_like(comment=comment, user=user)
            return True
        else:
            like.delete()
            comment.decrement_like()
            return False

