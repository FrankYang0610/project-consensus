import uuid
from django.contrib.postgres.indexes import GinIndex
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),  # Ensure pg_trgm extension is available
    ]

    operations = [
        migrations.CreateModel(
            name='Teacher',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(db_index=True, max_length=100)),
                ('title', models.CharField(blank=True, max_length=300)),
                ('department', models.CharField(blank=True, max_length=200)),
                ('avatar_url', models.URLField(blank=True)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('phone', models.CharField(blank=True, max_length=50)),
                ('office', models.CharField(blank=True, max_length=200)),
                ('office_hours', models.CharField(blank=True, max_length=200)),
                ('website_name', models.CharField(blank=True, max_length=200)),
                ('website_url', models.URLField(blank=True)),
                ('profile_url', models.URLField(blank=True)),
                ('scholars_hub_url', models.URLField(blank=True)),
                ('biography', models.TextField(blank=True)),
                ('research_interests', models.TextField(blank=True)),
                ('academic_and_professional_experience', models.TextField(blank=True)),
                ('professional_qualifications', models.TextField(blank=True)),
                ('tags', models.JSONField(blank=True, default=list, help_text='List of tags/areas of expertise')),
                ('languages', models.JSONField(blank=True, default=list, help_text='List of teaching languages')),
                ('years_experience', models.PositiveIntegerField(blank=True, null=True)),
                ('orcid_id', models.CharField(blank=True, max_length=100)),
                ('orcid_url', models.URLField(blank=True)),
                ('scopus_id', models.CharField(blank=True, max_length=100)),
                ('scopus_url', models.URLField(blank=True)),
                ('researcherid_id', models.CharField(blank=True, max_length=100)),
                ('researcherid_url', models.URLField(blank=True)),
                ('rating_overall', models.FloatField(blank=True, help_text='Overall rating 0.0-10.0, null if no reviews', null=True)),
                ('rating_difficulty', models.FloatField(blank=True, help_text='Difficulty rating 0.0-10.0', null=True)),
                ('rating_friendliness', models.FloatField(blank=True, help_text='Friendliness rating 0.0-10.0', null=True)),
                ('rating_clarity', models.FloatField(blank=True, help_text='Clarity rating 0.0-10.0', null=True)),
                ('rating_grading', models.CharField(blank=True, choices=[('lenient', 'lenient'), ('balanced', 'balanced'), ('strict', 'strict')], max_length=10)),
                ('rating_reviews_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Teacher',
                'verbose_name_plural': 'Teachers',
                'indexes': [models.Index(fields=['name'], name='teachers_te_name_c63a4b_idx'), models.Index(fields=['department'], name='teachers_te_departm_3b845d_idx')],
            },
        ),
        # Add trigram indexes for better search performance
        migrations.AddIndex(
            model_name='teacher',
            index=GinIndex(fields=['name'], name='teacher_name_trgm_idx', opclasses=['gin_trgm_ops']),
        ),
        migrations.AddIndex(
            model_name='teacher',
            index=GinIndex(fields=['department'], name='teacher_department_trgm_idx', opclasses=['gin_trgm_ops']),
        ),
        migrations.AddIndex(
            model_name='teacher',
            index=models.Index(fields=['-updated_at'], name='teacher_updated_at_idx'),
        ),
    ]
