"""
Seed demo forum posts and comments so frontend can fetch from backend.

This uses the demo user created by accounts.0002_create_demo_user.
"""

from django.conf import settings
from django.db import migrations
from django.utils import timezone
import uuid


def seed_forum_data(apps, schema_editor):
    # Get models via apps registry
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    ForumPost = apps.get_model("forum", "ForumPost")
    ForumPostComment = apps.get_model("forum", "ForumPostComment")

    # Find demo user as author
    author = User.objects.filter(email="demo@connect.polyu.hk").first()
    if author is None:
        return

    # If already seeded, be idempotent
    existing = ForumPost.objects.first()
    if existing:
        return

    base_time = timezone.now()

    posts = []
    for i in range(1, 100 + 1):
        posts.append(
            ForumPost(
                id=uuid.uuid4(),
                title=f"Demo Post {i}: Welcome to project-consensus",
                content=f"<p>This is demo post #{i} coming from backend seed.</p>",
                author=author,
                created_at=base_time - timezone.timedelta(hours=i),
                tags=(["General", "Study"] if i % 2 == 0 else ["Project", "Help"]),
                language=("English (Hong Kong)" if i % 3 == 0 else ("简体中文（普通话）" if i % 3 == 1 else "繁体中文（粵語）")),
                likes_count=(i * 2) % 37,
            )
        )

    ForumPost.objects.bulk_create(posts)

    # Add comments for the first post for pagination demonstration
    first_post = ForumPost.objects.order_by("-created_at").first()
    if first_post:
        comments = []
        for j in range(1, 30 + 1):
            comments.append(
                ForumPostComment(
                    id=uuid.uuid4(),
                    post=first_post,
                    content=f"This is backend-seeded main comment #{j} for demo.",
                    author=author,
                    created_at=base_time - timezone.timedelta(minutes=j),
                    likes_count=(j * 7) % 29,
                )
            )
        ForumPostComment.objects.bulk_create(comments)


def unseed_forum_data(apps, schema_editor):
    ForumPost = apps.get_model("forum", "ForumPost")
    ForumPostComment = apps.get_model("forum", "ForumPostComment")
    ForumPostComment.objects.all().delete()
    ForumPost.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_create_demo_user"),
        ("forum", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_forum_data, unseed_forum_data),
    ]


