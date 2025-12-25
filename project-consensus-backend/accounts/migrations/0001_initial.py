import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),  # Ensure pg_trgm extension is available
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Profile',
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nickname", models.CharField(help_text="Unique display name", max_length=15, unique=True)),
                ("avatar_url", models.URLField(blank=True, help_text="Avatar URL (optional)")),
                ("pronouns", models.CharField(blank=True, help_text="Pronouns (optional)", max_length=100)),
                ("show_forum_posts_publicly", models.BooleanField(default=True, help_text="Show my forum posts publicly")),
                ("show_forum_post_comments_publicly", models.BooleanField(default=True, help_text="Show my forum comments publicly")),
                ("show_course_reviews_publicly", models.BooleanField(default=True, help_text="Show my course reviews publicly")),
                ("last_nickname_updated_at", models.DateTimeField(blank=True, help_text="Last nickname change time", null=True)),
                ("is_account_active", models.BooleanField(default=True, help_text="Account is active (can log in)")),
                ("forum_posts_count", models.PositiveIntegerField(default=0, help_text="Total forum posts created by the user")),
                ("forum_post_comments_count", models.PositiveIntegerField(default=0, help_text="Total forum comments created by the user")),
                ("course_reviews_count", models.PositiveIntegerField(default=0, help_text="Total course reviews created by the user")),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Profile',
                'verbose_name_plural': 'Profiles',
            },
        ),
        # Add trigram index for better search performance on nickname
        migrations.AddIndex(
            model_name='profile',
            index=GinIndex(fields=['nickname'], name='profile_nickname_trgm_idx', opclasses=['gin_trgm_ops']),
        ),
    ]
