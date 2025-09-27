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

    # 2) Create a main comment for each post
    #    为每个帖子创建一条主评论
    all_posts = list(ForumPost.objects.order_by("-created_at"))
    main_comments_by_post = {}
    for post in all_posts:
        main_comments = list(ForumPostComment.objects.filter(post=post, parent__isnull=True))
        if not main_comments:
            # Create a main comment for this post if none exists
            main_comment = ForumPostComment.objects.create(
                post=post,
                content="This is a main comment for the post",
                author=random.choice(authors),
                created_at=now,
            )
            main_comments = [main_comment]
        main_comments_by_post[post.id] = main_comments
    
    # 3) Randomly create 10,000 replies across posts using bulk_create in two passes
    #    第一批回复主评论，第二批再随机回复前一批生成的回复，以测试嵌套回复
    total_replies = 10000
    subreplies = 3000

    # 3a) First pass: replies to main comments / 第一批：回复主评论
    reply_objects = []
    for k in range(total_replies - subreplies):
        target_post = random.choice(all_posts)
        main_comment = random.choice(main_comments_by_post[target_post.id])
        reply_objects.append(
            ForumPostComment(
                post=target_post,
                parent=main_comment,
                main_comment=main_comment,
                content=f"Reply to the main comment #{k + 1}",
                author=random.choice(authors),
                reply_to_user=main_comment.author,
                created_at=main_comment.created_at + timezone.timedelta(seconds=k),
            )
        )
    ForumPostComment.objects.bulk_create(reply_objects)

    # Reload created replies to use as potential parents for nested replies
    existing_replies = list(ForumPostComment.objects.filter(parent__isnull=False))

    # 3b) Second pass: replies to existing replies / 第二批：回复已有回复
    subreply_objects = []
    for k in range(subreplies, total_replies):
        parent_reply = random.choice(existing_replies)
        root_main_comment = parent_reply.main_comment if parent_reply.main_comment_id else parent_reply
        subreply_objects.append(
            ForumPostComment(
                post=parent_reply.post,
                parent=parent_reply,
                main_comment=root_main_comment,
                content=f"Reply to an existing reply #{k + 1}",
                author=random.choice(authors),
                reply_to_user=parent_reply.author,
                created_at=parent_reply.created_at + timezone.timedelta(seconds=k),
            )
        )
    ForumPostComment.objects.bulk_create(subreply_objects)


def unseed_forum_data(apps, schema_editor):
    # 清除本迁移脚本生成的数据 / Clear data generated by this migration script
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


