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
    Notification = apps.get_model("accounts", "Notification")
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
        likes_count=0,
    )

    # Create discussion with nested replies
    comments_data = [
        # Main comments
        {
            "content": "我最近都睇咗呢套歌剧！真係好正，特别係Figaro嘅出场，嗰首'Largo al factotum'真係好有气势！",
            "author": "bob@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=25),
        },
        {
            "content": "I completely agree! The overture is also fantastic - it's one of the most recognizable pieces in classical music. Rossini really knew how to write catchy melodies.",
            "author": "alice@connect.polyu.hk", 
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=24),
        },
        {
            "content": "我觉得Rosina这个角色很有意思，她虽然被监护人控制，但内心很聪明。",
            "author": "carol@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=23),
        },
        {
            "content": "The chemistry between the characters is amazing! I love how Figaro orchestrates everything - he's like the puppet master of the whole story.",
            "author": "dave@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=22),
        },
        {
            "content": "你哋有冇睇过现代版嘅制作？我睇过一个设定喺现代嘅版本，好有趣！",
            "author": "erin@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=21),
        },
        {
            "content": "Rossini的音乐真的很有感染力！我特别喜欢序曲中的那些重复乐段，让人印象深刻。",
            "author": "frank@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=20),
        },
        {
            "content": "The character development in this opera is incredible. Each character has such distinct personality traits that come through in the music.",
            "author": "grace@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=19),
        },
        {
            "content": "我睇过几个唔同嘅制作版本，每个导演都有自己嘅解读，真係好有趣！",
            "author": "heidi@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=18),
        },
        {
            "content": "The vocal demands on the singers are quite challenging. Rosina's coloratura passages are particularly impressive.",
            "author": "ivy@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=17),
        },
        {
            "content": "我觉得这部歌剧的喜剧效果处理得很好，不会让人觉得做作。",
            "author": "judy@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=16),
        },
        {
            "content": "Figaro's entrance aria is probably one of the most famous in all of opera. It's so energetic and memorable!",
            "author": "alice@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=15),
        },
        {
            "content": "你哋觉得边个角色最有趣？我觉得Bartolo嘅角色设定好搞笑！",
            "author": "bob@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=14),
        },
        {
            "content": "The orchestration is brilliant - Rossini really knew how to use the orchestra to enhance the drama and comedy.",
            "author": "dave@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=13),
        },
        {
            "content": "我最近在学习唱Rosina的咏叹调，真的很有挑战性！",
            "author": "carol@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=12),
        },
        {
            "content": "Modern productions can be really creative! I saw one set in a modern office building - very clever adaptation.",
            "author": "erin@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=11),
        },
        {
            "content": "Rossini嘅音乐节奏感真係好强，听咗会令人好兴奋！",
            "author": "frank@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=10),
        },
        {
            "content": "The ensemble numbers are fantastic - when all the characters sing together, it's pure magic!",
            "author": "grace@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=9),
        },
        {
            "content": "我特别钟意嗰个爱情故事嘅发展，虽然係喜剧但係都几浪漫！",
            "author": "heidi@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=8),
        },
        {
            "content": "The recitatives are also well-written - they advance the plot while maintaining the musical flow.",
            "author": "ivy@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=7),
        },
        {
            "content": "我觉得这部歌剧的服装设计也很重要，能帮助观众更好地理解角色。",
            "author": "judy@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=6),
        },
        {
            "content": "Figaro嘅机智真係令人佩服，佢知道点样利用每个人嘅弱点！",
            "author": "bob@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=5),
        },
        {
            "content": "The historical context is also interesting - it was written during a time of great social change in Europe.",
            "author": "alice@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=4),
        },
        {
            "content": "我睇过一个版本，导演把故事搬到了现代，但保持了原作的精神，很成功！",
            "author": "carol@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=3),
        },
        {
            "content": "Rossini's use of musical motifs to represent different characters is really clever.",
            "author": "dave@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=2),
        },
        {
            "content": "你哋有冇听过其他版本嘅录音？我推荐Ricciarelli同Alva嘅版本！",
            "author": "erin@connect.polyu.hk",
            "reply_to": None,
            "created_at": now - timezone.timedelta(days=1),
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
            is_anonymous=comment_data.get("is_anonymous", False),
        )
        main_comments.append(comment)

    # Create replies to main comments
    replies_data = [
        # Replies to Bob's comment (Cantonese) - The 1st main comment
        {
            "content": "係呀！我特别钟意嗰个音乐嘅节奏感，Rossini真係好厉害！",
            "author": "heidi@connect.polyu.hk",
            "reply_to": main_comments[0],
            "created_at": now - timezone.timedelta(days=24, hours=12),
        },
        {
            "content": "I love how the music builds up the excitement! The orchestration is brilliant.",
            "author": "grace@connect.polyu.hk",
            "reply_to": main_comments[0],
            "created_at": now - timezone.timedelta(days=24, hours=6),
        },
        {
            "content": "Figaro嘅出场真係好有戏剧性，音乐一响起就知道好戏要开始了！",
            "author": "frank@connect.polyu.hk",
            "reply_to": main_comments[0],
            "created_at": now - timezone.timedelta(days=23, hours=18),
        },
        # Replies to Alice's comment (English) - The 2nd main comment
        {
            "content": "Absolutely! The overture sets the perfect mood for the whole opera. It's so playful and energetic.",
            "author": "judy@connect.polyu.hk",
            "reply_to": main_comments[1],
            "created_at": now - timezone.timedelta(days=23, hours=12),
        },
        {
            "content": "我同意！序曲真的很有感染力，一聽就知道是喜劇。",
            "author": "frank@connect.polyu.hk",
            "reply_to": main_comments[1],
            "created_at": now - timezone.timedelta(days=23, hours=6),
        },
        {
            "content": "The melody is so catchy that I find myself humming it days after watching!",
            "author": "dave@connect.polyu.hk",
            "reply_to": main_comments[1],
            "created_at": now - timezone.timedelta(days=22, hours=20),
        },
        # Replies to Carol's comment (Mandarin) - The 3rd main comment
        {
            "content": "对！Rosina的'Una voce poco fa'那首咏叹调特别能展现她的性格。",
            "author": "ivy@connect.polyu.hk",
            "reply_to": main_comments[2],
            "created_at": now - timezone.timedelta(days=22, hours=12),
        },
        {
            "content": "Exactly! She's not just a passive character - she's actively participating in her own liberation.",
            "author": "alice@connect.polyu.hk",
            "reply_to": main_comments[2],
            "created_at": now - timezone.timedelta(days=22, hours=6),
        },
        {
            "content": "我觉得Rosina的才华在音乐中体现得淋漓尽致！",
            "author": "judy@connect.polyu.hk",
            "reply_to": main_comments[2],
            "created_at": now - timezone.timedelta(days=21, hours=18),
        },
        
        # Replies to Dave's comment (English) - The 4th main comment
        {
            "content": "Yes! Figaro is the perfect mastermind. His 'Largo al factotum' shows his confidence and wit perfectly.",
            "author": "grace@connect.polyu.hk",
            "reply_to": main_comments[3],
            "created_at": now - timezone.timedelta(days=21, hours=12),
        },
        {
            "content": "佢真係好聪明，知道点样利用每个人嘅弱点来达到自己嘅目的。",
            "author": "bob@connect.polyu.hk",
            "reply_to": main_comments[3],
            "created_at": now - timezone.timedelta(days=21, hours=6),
        },
        {
            "content": "The way he manipulates everyone is both hilarious and impressive!",
            "author": "erin@connect.polyu.hk",
            "reply_to": main_comments[3],
            "created_at": now - timezone.timedelta(days=20, hours=20),
        },
        # Replies to Erin's comment (Cantonese) - The 5th main comment
        {
            "content": "我睇过一个设定喺办公室嘅版本，Figaro变成咗一个发型师！好有创意！",
            "author": "dave@connect.polyu.hk",
            "reply_to": main_comments[4],
            "created_at": now - timezone.timedelta(days=20, hours=12),
        },
        {
            "content": "现代制作确实很有趣！我见过一个把故事搬到现代纽约的版本，Bartolo变成了一个富有的商人。",
            "author": "carol@connect.polyu.hk",
            "reply_to": main_comments[4],
            "created_at": now - timezone.timedelta(days=20, hours=6),
        },
        {
            "content": "我睇过一个版本，把故事设定喺现代嘅科技公司，好有创意！",
            "author": "heidi@connect.polyu.hk",
            "reply_to": main_comments[4],
            "created_at": now - timezone.timedelta(days=19, hours=18),
        },
        # Replies to Heidi's comment (Cantonese) - The 6th main comment
        {
            "content": "Rossini的音乐确实很有感染力！我特别喜欢那些重复的乐段。",
            "author": "alice@connect.polyu.hk",
            "reply_to": main_comments[5],
            "created_at": now - timezone.timedelta(days=19, hours=12),
        },
        {
            "content": "係呀！佢嘅音乐节奏感真係好强，听咗会令人好兴奋！",
            "author": "bob@connect.polyu.hk",
            "reply_to": main_comments[5],
            "created_at": now - timezone.timedelta(days=19, hours=6),
        },
        {
            "content": "The character development is indeed incredible! Each character has such depth.",
            "author": "judy@connect.polyu.hk",
            "reply_to": main_comments[6],
            "created_at": now - timezone.timedelta(days=18, hours=12),
        },
        {
            "content": "我同意！每个角色都有自己独特的音乐语言。",
            "author": "carol@connect.polyu.hk",
            "reply_to": main_comments[6],
            "created_at": now - timezone.timedelta(days=18, hours=6),
        },
        # Replies to Heidi's comment (Cantonese) - The 8th main comment
        {
            "content": "我睇过几个唔同嘅制作版本，每个导演都有自己嘅解读，真係好有趣！",
            "author": "frank@connect.polyu.hk",
            "reply_to": main_comments[7],
            "created_at": now - timezone.timedelta(days=17, hours=12),
        },
        {
            "content": "Different productions can really change how you see the story!",
            "author": "grace@connect.polyu.hk",
            "reply_to": main_comments[7],
            "created_at": now - timezone.timedelta(days=17, hours=6),
        },
        # Replies to Ivy's comment (English) - The 9th main comment
        {
            "content": "The vocal demands are indeed challenging! Rosina's coloratura is breathtaking.",
            "author": "alice@connect.polyu.hk",
            "reply_to": main_comments[8],
            "created_at": now - timezone.timedelta(days=16, hours=12),
        },
        {
            "content": "我最近在学习唱Rosina的咏叹调，真的很有挑战性！",
            "author": "judy@connect.polyu.hk",
            "reply_to": main_comments[8],
            "created_at": now - timezone.timedelta(days=16, hours=6),
        },
        # Replies to Judy's comment (Mandarin) - The 10th main comment
        {
            "content": "我觉得这部歌剧的喜剧效果处理得很好，不会让人觉得做作。",
            "author": "ivy@connect.polyu.hk",
            "reply_to": main_comments[9],
            "created_at": now - timezone.timedelta(days=15, hours=12),
        },
        {
            "content": "The comedy is so natural and well-integrated into the music!",
            "author": "dave@connect.polyu.hk",
            "reply_to": main_comments[9],
            "created_at": now - timezone.timedelta(days=15, hours=6),
        },
        # 最后五个回复回复第一个主评论，用于测试跳转功能
        # The last five replies replies to the first main comment, for testing jump function
        {
            "content": "[1] 回到最初嘅话题，我完全同意你嘅观点！Figaro嘅出场真係好有气势，Rossini嘅音乐真係令人难忘！",
            "author": "demo@connect.polyu.hk",
            "reply_to": main_comments[0],  # Replies to the first main comment
            "created_at": now - timezone.timedelta(hours=6),
            "is_anonymous": True,
        },
        {
            "content": "[2] 确实，Rossini嘅序曲真係经典！我特别钟意里面嘅弦乐部分，层次感好丰富。",
            "author": "demo@connect.polyu.hk",
            "reply_to": main_comments[0],  # Replies to the first main comment
            "created_at": now - timezone.timedelta(hours=5),
        },
        {
            "content": "[3] 我觉得呢部歌剧嘅喜剧效果处理得好好，唔会让人觉得做作。",
            "author": "demo@connect.polyu.hk",
            "reply_to": main_comments[0],  # Replies to the first main comment
            "created_at": now - timezone.timedelta(hours=4),
            "is_anonymous": True,
        },
        {
            "content": "[4] 同意！Rossini嘅音乐真係好有感染力，每次听都觉得好振奋人心。",
            "author": "demo@connect.polyu.hk",
            "reply_to": main_comments[0],  # Replies to the first main comment
            "created_at": now - timezone.timedelta(hours=3),
        },
        {
            "content": "[5] 呢部歌剧嘅剧情同音乐配合得好好，真係一部经典嘅作品！",
            "author": "demo@connect.polyu.hk",
            "reply_to": main_comments[0],  # Replies to the first main comment
            "created_at": now - timezone.timedelta(hours=2),
            "is_anonymous": True,
        },
    ]

    # Create replies object
    created_replies = []
    for reply_data in replies_data:
        author = User.objects.get(email=reply_data["author"])
        c = ForumPostComment.objects.create(
            post=main_post,
            content=reply_data["content"],
            author=author,
            reply_to=reply_data["reply_to"],
            created_at=reply_data["created_at"],
            is_anonymous=reply_data.get("is_anonymous", False),
        )
        created_replies.append(c)

    # Create some nested replies (replies to replies)
    nested_replies_data = [
        {
            "content": "係呀！我仲睇过一个版本，Figaro用咗现代嘅发型工具，好搞笑！",
            "author": "frank@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="发型师").first(),
            "created_at": now - timezone.timedelta(days=19, hours=18),
        },
        {
            "content": "That sounds hilarious! I love how directors can make these classic stories feel fresh and relevant.",
            "author": "judy@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="纽约").first(),
            "created_at": now - timezone.timedelta(days=19, hours=12),
        },
        {
            "content": "我覺得最重要的是保持原作的精神，即使換了時代背景。",
            "author": "ivy@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="纽约").first(),
            "created_at": now - timezone.timedelta(days=19, hours=6),
        },
        {
            "content": "我睇过一个版本，把Figaro设定成现代嘅发型师，用咗好多现代工具！",
            "author": "heidi@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="发型师").first(),
            "created_at": now - timezone.timedelta(days=18, hours=20),
        },
        {
            "content": "Modern adaptations can be really creative! I love how they keep the essence while making it relevant.",
            "author": "alice@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="纽约").first(),
            "created_at": now - timezone.timedelta(days=18, hours=14),
        },
        {
            "content": "我觉得最重要的是保持原作的精神，即使换了时代背景。",
            "author": "carol@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="纽约").first(),
            "created_at": now - timezone.timedelta(days=18, hours=8),
        },
        {
            "content": "係呀！我睇过一个版本，把故事设定喺现代嘅科技公司，好有创意！",
            "author": "bob@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="科技公司").first(),
            "created_at": now - timezone.timedelta(days=17, hours=20),
        },
        {
            "content": "The creativity in modern productions is amazing! Each director brings their own vision.",
            "author": "grace@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="科技公司").first(),
            "created_at": now - timezone.timedelta(days=17, hours=14),
        },
        {
            "content": "我特别钟意嗰个版本，把Figaro变成咗一个现代嘅发型师，好有创意！",
            "author": "erin@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="发型师").first(),
            "created_at": now - timezone.timedelta(days=16, hours=20),
        },
        {
            "content": "Modern productions really show how timeless these stories are!",
            "author": "dave@connect.polyu.hk",
            "reply_to": ForumPostComment.objects.filter(content__contains="纽约").first(),
            "created_at": now - timezone.timedelta(days=16, hours=14),
        },
    ]

    # Create nested replies
    created_nested_replies = []
    for nested_data in nested_replies_data:
        author = User.objects.get(email=nested_data["author"])
        reply_to_comment = nested_data["reply_to"]
        c = ForumPostComment.objects.create(
            post=main_post,
            content=nested_data["content"],
            author=author,
            reply_to=reply_to_comment,
            created_at=nested_data["created_at"],
            is_anonymous=nested_data.get("is_anonymous", False),
        )
        created_nested_replies.append(c)

    # Create notifications for top-level comments (notify post author) and replies (notify comment author)
    # Top-level comments -> notify post author
    for c in main_comments:
        try:
            if c.author_id != main_post.author_id:
                Notification.objects.create(
                    user=main_post.author,
                    actor=c.author,
                    type="forumPostCommented",
                    forumpost=main_post,
                    forumpostcomment=c,
                    created_at=c.created_at,
                    actor_is_anonymous=bool(getattr(c, "is_anonymous", False)),
                    content_preview=c.content,
                    referenced_content_preview=main_post.title,
                )
        except Exception:
            pass

    # Replies to comments -> notify target comment author
    for c in created_replies + created_nested_replies:
        try:
            target = c.reply_to.author if c.reply_to_id else main_post.author
            if target.pk != c.author_id:
                Notification.objects.create(
                    user=target,
                    actor=c.author,
                    type=("forumPostCommentReplied" if c.reply_to_id else "forumPostCommented"),
                    forumpost=main_post,
                    forumpostcomment=c,
                    created_at=c.created_at,
                    actor_is_anonymous=bool(getattr(c, "is_anonymous", False)),
                    content_preview=c.content,
                    referenced_content_preview=(
                        c.reply_to.content
                        if c.reply_to_id
                        else main_post.title
                    ),
                )
        except Exception:
            pass


def unseed_forum_data(apps, schema_editor):
    # Clear data generated by this migration script
    ForumPost = apps.get_model("forum", "ForumPost")
    ForumPostComment = apps.get_model("forum", "ForumPostComment")
    Notification = apps.get_model("accounts", "Notification")
    # Delete notifications referencing these forum objects first
    try:
        Notification.objects.filter(forumpostcomment__isnull=False).delete()
        Notification.objects.filter(forumpost__isnull=False).delete()
    except Exception:
        pass
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


