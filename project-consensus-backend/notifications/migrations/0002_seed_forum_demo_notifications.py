"""
Why seed notifications here (in notifications/0002) instead of inside forum/0002?

- Decoupling: Forum migrations should not depend on the notifications app. By
  placing the seeding here, notifications becomes an optional downstream
  consumer of forum data rather than a hard requirement of the forum app.
- Failure isolation: If notification seeding fails, forum data and migrations
  remain intact. This migration can be rolled back or re-run independently.
- Ownership: Notification schema and behavior live in this app, so changes to
  notification fields or types only require touching this migration.
- Ordered without reverse dependency: This migration depends on forum/0002 to
  ensure source data exists, but the forum app has no reverse dependency on
  notifications. That avoids cross-app tight coupling and future cycles.

This keeps forum migrations stable and allows environments to run without the
notifications app enabled, while still providing rich demo data when it is.
"""

from django.db import migrations


TITLE_MARKER = "Rossini's The Barber of Seville - What are your thoughts?"


def seed_forward(apps, schema_editor):
    Notification = apps.get_model("notifications", "Notification")
    ForumPost = apps.get_model("forum", "ForumPost")
    ForumPostComment = apps.get_model("forum", "ForumPostComment")

    # Locate the seeded forum post created by forum.0002
    main_post = ForumPost.objects.filter(title=TITLE_MARKER).first()
    if main_post is None:
        return

    # Top-level comments notify post author (skip self)
    main_comments = list(
        ForumPostComment.objects.filter(post=main_post, reply_to__isnull=True)
    )
    for c in main_comments:
        try:
            if c.author_id != main_post.author_id:
                Notification.objects.create(
                    recipient=main_post.author,
                    actor=c.author,
                    type="forumPostCommented",
                    created_at=c.created_at,
                    actor_is_anonymous=bool(getattr(c, "is_anonymous", False)),
                    content_preview=c.content,
                    referenced_content_preview=main_post.title,
                    target_app="forum",
                    target_model="ForumPostComment",
                    target_id=str(c.pk),
                    route=f"/post/{main_post.pk}#comment-{c.pk}",
                    metadata={
                        "forumPostId": str(main_post.pk),
                        "forumPostCommentId": str(c.pk),
                        "forumPostTitle": main_post.title,
                    },
                )
        except Exception:
            # Best-effort; do not break migration if notifications fail
            pass

    # Replies (including nested replies) notify the comment author; if reply_to is null, fallback to post author
    reply_comments = list(
        ForumPostComment.objects.filter(post=main_post, reply_to__isnull=False)
    )
    for c in reply_comments:
        try:
            target = c.reply_to.author if c.reply_to_id else main_post.author
            if target.pk != c.author_id:
                Notification.objects.create(
                    recipient=target,
                    actor=c.author,
                    type="forumPostCommentReplied",
                    created_at=c.created_at,
                    actor_is_anonymous=bool(getattr(c, "is_anonymous", False)),
                    content_preview=c.content,
                    referenced_content_preview=(c.reply_to.content if c.reply_to_id else main_post.title),
                    target_app="forum",
                    target_model="ForumPostComment",
                    target_id=str(c.pk),
                    route=f"/post/{main_post.pk}#comment-{c.pk}",
                    metadata={
                        "forumPostId": str(main_post.pk),
                        "forumPostCommentId": str(c.pk),
                        "forumPostTitle": main_post.title,
                    },
                )
        except Exception:
            # Best-effort only
            pass


def seed_reverse(apps, schema_editor):
    Notification = apps.get_model("notifications", "Notification")
    ForumPost = apps.get_model("forum", "ForumPost")
    ForumPostComment = apps.get_model("forum", "ForumPostComment")

    main_post = ForumPost.objects.filter(title=TITLE_MARKER).first()
    if main_post is None:
        return
    comment_ids = list(
        ForumPostComment.objects.filter(post=main_post).values_list("pk", flat=True)
    )
    comment_ids_str = [str(x) for x in comment_ids]
    if comment_ids_str:
        try:
            Notification.objects.filter(
                target_app="forum",
                target_model="ForumPostComment",
                target_id__in=comment_ids_str,
            ).delete()
        except Exception:
            pass


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0001_initial"),
        ("forum", "0002_seed_demo_forum_data"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_reverse),
    ]


