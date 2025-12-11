from __future__ import annotations

import logging

from notifications import NotificationType
from notifications.events import DomainEvent, emit

from ..models import ForumPostComment

logger = logging.getLogger(__name__)


def emit_notifications_for_new_comment(*, comment: ForumPostComment, actor) -> None:
    """Emit notifications for a new comment or reply. Best-effort, non-blocking."""
    try:
        if comment.reply_to_id:
            target_user = comment.reply_to.author
            if target_user.pk != actor.pk:
                emit(
                    DomainEvent(
                        type=NotificationType.FORUM_POST_COMMENT_REPLIED,
                        recipient_id=target_user.pk,
                        actor_id=actor.pk,
                        target_app="forum",
                        target_model="ForumPostComment",
                        target_id=str(comment.pk),
                        route=f"/post/{comment.post_id}#comment-{comment.pk}",
                        metadata={
                            "forumPostId": str(comment.post_id),
                            "forumPostCommentId": str(comment.pk),
                            "forumPostTitle": comment.post.title,
                        },
                        actor_is_anonymous=comment.is_anonymous,
                        content_preview=comment.content,
                        referenced_content_preview=(comment.reply_to.content if comment.reply_to and comment.reply_to.content else comment.post.title),
                        created_at=comment.created_at,
                    )
                )
        else:
            target_user = comment.post.author
            if target_user.pk != actor.pk:
                emit(
                    DomainEvent(
                        type=NotificationType.FORUM_POST_COMMENTED,
                        recipient_id=target_user.pk,
                        actor_id=actor.pk,
                        target_app="forum",
                        target_model="ForumPostComment",
                        target_id=str(comment.pk),
                        route=f"/post/{comment.post_id}#comment-{comment.pk}",
                        metadata={
                            "forumPostId": str(comment.post_id),
                            "forumPostCommentId": str(comment.pk),
                            "forumPostTitle": comment.post.title,
                        },
                        actor_is_anonymous=comment.is_anonymous,
                        content_preview=comment.content,
                        referenced_content_preview=comment.post.title,
                        created_at=comment.created_at,
                    )
                )
    except Exception:
        # Best-effort; don't block on notification errors
        pass


def emit_notification_for_post_like(*, post, user) -> None:
    """Emit notification for a forum post like."""
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


def emit_notification_for_comment_like(*, comment, user) -> None:
    """Emit notification for a forum comment like."""
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
