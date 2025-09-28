"""
Forum demo data for "The Barber of Seville" discussion
- Create 1 main post about the opera
- Add realistic discussion with replies in Cantonese, English, and Mandarin
- Create nested conversation structure

Keep code simple for readability
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

    # Create sample users and profiles / 创建示例用户和个人资料
    sample_users_data = [
        ("alice@connect.polyu.hk", "Alice", "English"),
        ("bob@connect.polyu.hk", "Bob", "繁體中文（粵語）"),
        ("carol@connect.polyu.hk", "Carol", "简体中文（普通话）"),
        ("dave@connect.polyu.hk", "Dave", "English"),
        ("erin@connect.polyu.hk", "Erin", "繁體中文（粵語）"),
        ("frank@connect.polyu.hk", "Frank", "简体中文（普通话）"),
        ("grace@connect.polyu.hk", "Grace", "English"),
        ("heidi@connect.polyu.hk", "Heidi", "繁體中文（粵語）"),
        ("ivy@connect.polyu.hk", "Ivy", "简体中文（普通话）"),
        ("judy@connect.polyu.hk", "Judy", "English"),
    ]

    authors = [demo]
    for email, name, lang in sample_users_data:
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(username=email, email=email, password="Demo1234!")
        profile = Profile.objects.filter(user=user).first()
        if profile is None:
            Profile.objects.create(user=user, display_name=name)
        authors.append(user)

    # Create the main post about "The Barber of Seville" / 创建关于塞维利亚理发师的主帖
    main_post = ForumPost.objects.create(
        title="Rossini's The Barber of Seville - What are your thoughts?",
        content="""<p>I recently watched Rossini's <em>The Barber of Seville</em> and was absolutely blown away by the music and comedy! The famous "Largo al factotum" aria is just incredible - Figaro's entrance is so energetic and memorable.</p>
        
        <p>What I found most interesting was how Rossini managed to balance the comedic elements with the romantic plot. The characters are so well-developed, especially Figaro himself. His wit and charm really make the story work.</p>
        
        <p>I'm curious about your thoughts on:</p>
        <ul>
        <li>Your favorite arias or musical moments</li>
        <li>How the opera compares to other Rossini works</li>
        <li>Modern productions vs. traditional stagings</li>
        <li>The character dynamics, especially between Figaro, Almaviva, and Rosina</li>
        </ul>
        
        <p>Let's discuss!</p>""",
        author=demo,
        created_at=now - timezone.timedelta(days=20),
        tags=["opera", "rossini", "classical-music", "comedy", "barber-of-seville"],
        language="English",
        likes_count=0,
    )

    # Create realistic discussion with nested replies / 创建真实的嵌套讨论
    comments_data = [
        # Main comments
        {
            "content": "我最近都睇咗呢套歌剧！真係好正，特别係Figaro嘅出场，嗰首'Largo al factotum'真係好有气势！",
            "author": "bob@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=15),
        },
        {
            "content": "I completely agree! The overture is also fantastic - it's one of the most recognizable pieces in classical music. Rossini really knew how to write catchy melodies.",
            "author": "alice@connect.polyu.hk", 
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=13),
        },
        {
            "content": "我觉得Rosina这个角色很有意思，她虽然被监护人控制，但内心很聪明。",
            "author": "carol@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=11),
        },
        {
            "content": "The chemistry between the characters is amazing! I love how Figaro orchestrates everything - he's like the puppet master of the whole story.",
            "author": "dave@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=9),
        },
        {
            "content": "你哋有冇睇过现代版嘅制作？我睇过一个设定喺现代嘅版本，好有趣！",
            "author": "erin@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=7),
        },
    ]

    # Create main comments
    main_comments = []
    for comment_data in comments_data:
        author = User.objects.get(email=comment_data["author"])
        comment = ForumPostComment.objects.create(
            post=main_post,
            content=comment_data["content"],
            author=author,
            created_at=comment_data["created_at"],
        )
        main_comments.append(comment)

    # Create replies to main comments
    replies_data = [
        # Replies to Bob's comment (Cantonese)
        {
            "content": "係呀！我特别钟意嗰个音乐嘅节奏感，Rossini真係好厉害！",
            "author": "heidi@connect.polyu.hk",
            "reply_to": main_comments[0],
            "created_at": now - timezone.timedelta(days=14),
        },
        {
            "content": "I love how the music builds up the excitement! The orchestration is brilliant.",
            "author": "grace@connect.polyu.hk",
            "reply_to": main_comments[0],
            "created_at": now - timezone.timedelta(days=12),
        },
        
        # Replies to Alice's comment (English)
        {
            "content": "Absolutely! The overture sets the perfect mood for the whole opera. It's so playful and energetic.",
            "author": "judy@connect.polyu.hk",
            "reply_to": main_comments[1],
            "created_at": now - timezone.timedelta(days=10),
        },
        {
            "content": "我同意！序曲真的很有感染力，一聽就知道是喜劇。",
            "author": "frank@connect.polyu.hk",
            "reply_to": main_comments[1],
            "created_at": now - timezone.timedelta(days=8),
        },
        
        # Replies to Carol's comment (Mandarin)
        {
            "content": "对！Rosina的'Una voce poco fa'那首咏叹调特别能展现她的性格。",
            "author": "ivy@connect.polyu.hk",
            "reply_to": main_comments[2],
            "created_at": now - timezone.timedelta(days=6),
        },
        {
            "content": "Exactly! She's not just a passive character - she's actively participating in her own liberation.",
            "author": "alice@connect.polyu.hk",
            "reply_to": main_comments[2],
            "created_at": now - timezone.timedelta(days=4),
        },
        
        # Replies to Dave's comment (English)
        {
            "content": "Yes! Figaro is the perfect mastermind. His 'Largo al factotum' shows his confidence and wit perfectly.",
            "author": "grace@connect.polyu.hk",
            "reply_to": main_comments[3],
            "created_at": now - timezone.timedelta(days=2),
        },
        {
            "content": "佢真係好聪明，知道点样利用每个人嘅弱点来达到自己嘅目的。",
            "author": "bob@connect.polyu.hk",
            "reply_to": main_comments[3],
            "created_at": now - timezone.timedelta(days=1),
        },
        
        # Replies to Erin's comment (Cantonese)
        {
            "content": "我睇过一个设定喺办公室嘅版本，Figaro变成咗一个发型师！好有创意！",
            "author": "dave@connect.polyu.hk",
            "reply_to": main_comments[4],
            "created_at": now - timezone.timedelta(days=5),
        },
        {
            "content": "现代制作确实很有趣！我见过一个把故事搬到现代纽约的版本，Bartolo变成了一个富有的商人。",
            "author": "carol@connect.polyu.hk",
            "reply_to": main_comments[4],
            "created_at": now - timezone.timedelta(days=3),
        },
    ]

    # Create replies
    for reply_data in replies_data:
        author = User.objects.get(email=reply_data["author"])
        ForumPostComment.objects.create(
            post=main_post,
            content=reply_data["content"],
            author=author,
            reply_to=reply_data["reply_to"],
            created_at=reply_data["created_at"],
        )

    # Create some nested replies (replies to replies)
    nested_replies_data = [
        {
            "content": "係呀！我仲睇过一个版本，Figaro用咗现代嘅发型工具，好搞笑！",
            "author": "frank@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="发型师").first(),
            "created_at": now - timezone.timedelta(days=4),
        },
        {
            "content": "That sounds hilarious! I love how directors can make these classic stories feel fresh and relevant.",
            "author": "judy@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="纽约").first(),
            "created_at": now - timezone.timedelta(days=2),
        },
        {
            "content": "我覺得最重要的是保持原作的精神，即使換了時代背景。",
            "author": "ivy@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="纽约").first(),
            "created_at": now - timezone.timedelta(days=1),
        },
    ]

    # Create nested replies
    for nested_data in nested_replies_data:
        author = User.objects.get(email=nested_data["author"])
        reply_to_comment = nested_data["reply_to"]
        ForumPostComment.objects.create(
            post=main_post,
            content=nested_data["content"],
            author=author,
            reply_to=reply_to_comment,
            created_at=nested_data["created_at"],
        )


def unseed_forum_data(apps, schema_editor):
    # Clear data generated by this migration script
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


