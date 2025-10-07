from __future__ import annotations

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('forum', '0001_initial'),
        ('courses', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('type', models.CharField(choices=[
                    ('forumPostLiked', 'forumPostLiked'),
                    ('forumPostCommented', 'forumPostCommented'),
                    ('forumPostCommentLiked', 'forumPostCommentLiked'),
                    ('forumPostCommentReplied', 'forumPostCommentReplied'),
                    ('courseReviewLiked', 'courseReviewLiked'),
                    ('courseReviewReplied', 'courseReviewReplied'),
                    ('courseReviewReplyLiked', 'courseReviewReplyLiked'),
                    ('courseReviewReplyReplied', 'courseReviewReplyReplied')
                ], max_length=50)),
                ('is_read', models.BooleanField(default=False)),
                ('is_deleted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('actor_is_anonymous', models.BooleanField(default=False)),
                ('content_preview', models.TextField(blank=True)),
                ('referenced_content_preview', models.TextField(blank=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='triggered_notifications', to=settings.AUTH_USER_MODEL)),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='received_notifications', db_column='user_id', to=settings.AUTH_USER_MODEL)),
                ('forumpost', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notifications', to='forum.forumpost')),
                ('forumpostcomment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notifications', to='forum.forumpostcomment')),
                ('coursereview', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notifications', to='courses.coursereview')),
                ('coursereviewreply', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notifications', to='courses.coursereviewreply')),
            ],
            options={
                'verbose_name': 'Notification',
                'verbose_name_plural': 'Notifications',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'is_read', 'is_deleted', 'created_at'], name='notifications_recipient_is__created_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'is_read'], name='notifications_recipient_is__idx'),
        ),
    ]


