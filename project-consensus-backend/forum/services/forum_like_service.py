from __future__ import annotations

from django.db import transaction

from notifications import NotificationType
from notifications.events import DomainEvent, emit

from ..models import ForumCommentLike, ForumPost, ForumPostComment, ForumPostLike


def toggle_forum_post_like(*, user, post: ForumPost) -> bool:
    """Toggle like for a post.

    Returns True if now liked, False if unliked.
    """
    with transaction.atomic():
        like, created = ForumPostLike.objects.get_or_create(post=post, user=user)
        if created:
            post.increment_like()
            if user.pk != post.author_id:
                emit(
                    DomainEvent(
                        type=NotificationType.FORUM_POST_LIKED,
                        recipient_id=post.author_id,
                        actor_id=user.pk,
                        target_app="forum",
                        target_model="ForumPost",
                        target_id=str(post.pk),
                        route=f"/post/{post.pk}",
                        metadata={
                            "forumPostId": str(post.pk),
                            "forumPostTitle": post.title,
                        },
                        referenced_content_preview=post.title,
                    )
                )
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
            if user.pk != comment.author_id:
                emit(
                    DomainEvent(
                        type=NotificationType.FORUM_POST_COMMENT_LIKED,
                        recipient_id=comment.author_id,
                        actor_id=user.pk,
                        target_app="forum",
                        target_model="ForumPostComment",
                        target_id=str(comment.pk),
                        route=f"/post/{comment.post_id}#comment-{comment.pk}",
                        metadata={
                            "forumPostId": str(comment.post_id),
                            "forumPostCommentId": str(comment.pk),
                            "forumPostTitle": comment.post.title,
                        },
                        referenced_content_preview=(comment.content if comment and comment.content else comment.post.title),
                    )
                )
            return True
        else:
            like.delete()
            comment.decrement_like()
            return False

