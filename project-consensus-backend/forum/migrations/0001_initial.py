import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),  # Ensure pg_trgm extension is available
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ForumPost',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=200)),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('likes_count', models.PositiveIntegerField(default=0)),
                ('is_anonymous', models.BooleanField(default=False)),
                ('is_edited', models.BooleanField(default=False)),
                ('has_content_warning', models.BooleanField(default=False)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='forum_posts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'ForumPost',
                'verbose_name_plural': 'ForumPosts',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ForumPostComment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('is_deleted', models.BooleanField(default=False)),
                ('likes_count', models.PositiveIntegerField(default=0)),
                ('is_anonymous', models.BooleanField(default=False)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='forum_comments', to=settings.AUTH_USER_MODEL)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='forum.forumpost')),
                ('reply_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='replies', to='forum.forumpostcomment')),
            ],
            options={
                'verbose_name': 'ForumPostComment',
                'verbose_name_plural': 'ForumPostComments',
                'ordering': ['created_at', 'id'],
            },
        ),
        migrations.CreateModel(
            name='ForumCommentLike',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='forum_comment_likes', to=settings.AUTH_USER_MODEL)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='likes', to='forum.forumpostcomment')),
            ],
            options={
                'verbose_name': 'ForumCommentLike',
                'verbose_name_plural': 'ForumCommentLikes',
                'indexes': [models.Index(fields=['comment', 'user'], name='forumcmtlike_comment_user_idx')],
            },
        ),
        migrations.CreateModel(
            name='ForumPostLike',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='likes', to='forum.forumpost')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='forum_post_likes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'ForumPostLike',
                'verbose_name_plural': 'ForumPostLikes',
                'indexes': [models.Index(fields=['post', 'user'], name='forumpostlike_post_user_idx')],
            },
        ),
        migrations.CreateModel(
            name='ForumCommentContentBackup',
            fields=[
                ('comment_id', models.UUIDField(primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('deleted_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('deleted_by', models.CharField(blank=True, max_length=150)),
            ],
            options={
                'verbose_name': 'Comment Content Backup',
                'verbose_name_plural': 'Comment Content Backups',
                'db_table': 'forum_comment_content_backup',
            },
        ),

        migrations.AddIndex(
            model_name='forumpost',
            index=models.Index(fields=['created_at'], name='forumpost_created_idx'),
        ),
        # Add trigram indexes for better search performance
        migrations.AddIndex(
            model_name='forumpost',
            index=GinIndex(fields=['title'], name='forumpost_title_trgm_idx', opclasses=['gin_trgm_ops']),
        ),
        migrations.AddIndex(
            model_name='forumpost',
            index=GinIndex(fields=['content'], name='forumpost_content_trgm_idx', opclasses=['gin_trgm_ops']),
        ),

        migrations.AddIndex(
            model_name='forumpostcomment',
            index=models.Index(fields=['is_deleted', 'created_at'], name='forumcmt_del_created_idx'),
        ),
        migrations.AddIndex(
            model_name='forumpostcomment',
            index=models.Index(fields=['created_at'], name='forumcmt_created_idx'),
        ),
        migrations.AddIndex(
            model_name='forumpostcomment',
            index=GinIndex(fields=['content'], name='forumcomment_content_trgm_idx', opclasses=['gin_trgm_ops']),
        ),
        migrations.AddConstraint(
            model_name='forumpostcomment',
            constraint=models.CheckConstraint(
                condition=Q(is_deleted=False) | Q(content=''),
                name='forumcomment_deleted_content_empty',
            ),
        ),


        migrations.AddIndex(
            model_name='forumpostlike',
            index=models.Index(fields=['created_at'], name='forumpostlike_created_idx'),
        ),
        migrations.AddConstraint(
            model_name='forumpostlike',
            constraint=models.UniqueConstraint(
                fields=('post', 'user'),
                name='forumpostlike_post_user_unique',
            ),
        ),


        migrations.AddIndex(
            model_name='forumcommentlike',
            index=models.Index(fields=['created_at'], name='forumcmtlike_created_idx'),
        ),
        migrations.AddConstraint(
            model_name='forumcommentlike',
            constraint=models.UniqueConstraint(
                fields=('comment', 'user'),
                name='forumcommentlike_comment_user_unique',
            ),
        ),

        migrations.AddIndex(
            model_name='forumcommentcontentbackup',
            index=models.Index(fields=['deleted_at'], name='forumcmtbackup_deleted_at_idx'),
        ),
    ]
