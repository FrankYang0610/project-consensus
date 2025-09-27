"""
Simple forum demo data / 简单论坛演示数据：
- Create 100 posts
- Add 100 top-level comments to the first post
- Randomly pick posts and create 100 replies (to main comments)

Keep code simple for readability / 使用基础写法，便于阅读与维护。
"""

from django.conf import settings
from django.db import migrations
from django.utils import timezone
import random


def seed_forum_data(apps, schema_editor):
    # Get models / 获取模型
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    Profile = apps.get_model("accounts", "Profile")
    ForumPost = apps.get_model("forum", "ForumPost")
    ForumPostComment = apps.get_model("forum", "ForumPostComment")

    # Find demo user / 获取 demo 用户
    demo = User.objects.filter(email="demo@connect.polyu.hk").first()
    if demo is None:
        return

    # Idempotent: skip if posts already exist / 幂等：若已有帖子则跳过
    if ForumPost.objects.exists():
        return

    now = timezone.now()
    random.seed(42)
    # Language options for demo posts
    LANG_OPTIONS = [
        "简体中文（普通话）",
        "繁體中文（粵語）",
        "繁體中文（國語）",
        "English",
        "Not Specified",
        "Others",
    ]

    # Create several sample users and profiles / 创建一些示例用户和个人资料
    sample_users_data = [
        ("alice@connect.polyu.hk", "Alice"),
        ("bob@connect.polyu.hk", "Bob"),
        ("carol@connect.polyu.hk", "Carol"),
        ("dave@connect.polyu.hk", "Dave"),
        ("erin@connect.polyu.hk", "Erin"),
        ("frank@connect.polyu.hk", "Frank"),
        ("grace@connect.polyu.hk", "Grace"),
        ("heidi@connect.polyu.hk", "Heidi"),
        ("ivy@connect.polyu.hk", "Ivy"),
        ("judy@connect.polyu.hk", "Judy"),
    ]

    authors = [demo]
    for email, name in sample_users_data:
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(username=email, email=email, password="Demo1234!")
        profile = Profile.objects.filter(user=user).first()
        if profile is None:
            Profile.objects.create(user=user, display_name=name)
        authors.append(user)

    # 1) Create 100 posts with random authors
    #    生成 100 个帖子，作者从上面用户中随机选择
    post_rows = []
    for i in range(100):
        author = random.choice(authors)
        post_rows.append(
            ForumPost(
                title=f"Demo Post {i + 1}",
                content=f"<p>Seeded post #{i + 1}</p>",
                author=author,
                created_at=now - timezone.timedelta(hours=i),
                tags=[],
                language=random.choice(LANG_OPTIONS),
                likes_count=0,
            )
        )
    ForumPost.objects.bulk_create(post_rows)

    # Get the first post by time desc / 取“第 1 个帖子”（按创建时间倒序）
    first_post = ForumPost.objects.order_by("-created_at").first()
    if first_post is None:
        return

    # 2) Add 100 main comments to the first post (random authors)
    #    第一个帖子下创建 100 条主评论（作者随机）
    comment_rows = []
    for j in range(100):
        comment_rows.append(
            ForumPostComment(
                post=first_post,
                content=f"Comment #{j + 1} on first post",
                author=random.choice(authors),
                created_at=now - timezone.timedelta(minutes=j),
            )
        )
    ForumPostComment.objects.bulk_create(comment_rows)

    # 3) Randomly create 100 replies across posts
    #    随机挑选帖子并合计创建 100 条回复（回复到主评论）
    all_posts = list(ForumPost.objects.order_by("-created_at"))
    for k in range(10000):
        target_post = random.choice(all_posts)

        # Ensure a main comment exists (random author) / 若无主评论则先补一条（作者随机）
        main_list = list(ForumPostComment.objects.filter(post=target_post, parent__isnull=True))
        if not main_list:
            main = ForumPostComment.objects.create(
                post=target_post,
                content="Auto main comment for replies",
                author=random.choice(authors),
                created_at=now,
            )
        else:
            main = random.choice(main_list)

        # Create reply under the main comment (random author) / 在主评论下创建回复（作者随机）
        ForumPostComment.objects.create(
            post=target_post,
            parent=main,
            main_comment=main,
            content=f"Reply #{k + 1}",
            author=random.choice(authors),
            reply_to_user=main.author,
            created_at=main.created_at + timezone.timedelta(seconds=k),
        )


def unseed_forum_data(apps, schema_editor):
    # 清除本迁移脚本生成的数据
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


