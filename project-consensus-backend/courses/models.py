from __future__ import annotations

import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Course(models.Model):
    """Course basic info + aggregated rating.

    Aligns with the frontend Course type:
    - course_id, subject_code, title
    - term: year + semester (choices)
    - rating: score (0–10) and reviews_count
    - attributes: difficulty/workload/grading/gain (choices)
    - teachers: ManyToMany to teachers.Teacher
    - department/last_updated, etc.
    """

    class Semester(models.TextChoices):
        SPRING = "spring", "spring"
        SUMMER = "summer", "summer"
        FALL = "fall", "fall"

    class Difficulty(models.TextChoices):
        VERY_EASY = "veryEasy", "veryEasy"
        EASY = "easy", "easy"
        MEDIUM = "medium", "medium"
        HARD = "hard", "hard"
        VERY_HARD = "veryHard", "veryHard"

    class Workload(models.TextChoices):
        LIGHT = "light", "light"
        MODERATE = "moderate", "moderate"
        HEAVY = "heavy", "heavy"
        VERY_HEAVY = "veryHeavy", "veryHeavy"

    class Grading(models.TextChoices):
        LENIENT = "lenient", "lenient"
        BALANCED = "balanced", "balanced"
        STRICT = "strict", "strict"

    class Gain(models.TextChoices):
        LOW = "low", "low"
        DECENT = "decent", "decent"
        HIGH = "high", "high"

    course_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_code = models.CharField(max_length=64)
    title = models.CharField(max_length=200)

    term_year = models.PositiveIntegerField()
    term_semester = models.CharField(max_length=10, choices=Semester.choices)

    rating_score = models.FloatField(default=0)
    rating_reviews_count = models.PositiveIntegerField(default=0)
    # Extra rating counters used by frontend voting UI
    rating_recommend_count = models.PositiveIntegerField(default=0)
    rating_not_recommend_count = models.PositiveIntegerField(default=0)

    attr_difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    attr_workload = models.CharField(max_length=10, choices=Workload.choices, default=Workload.MODERATE)
    attr_grading = models.CharField(max_length=10, choices=Grading.choices, default=Grading.BALANCED)
    attr_gain = models.CharField(max_length=10, choices=Gain.choices, default=Gain.DECENT)

    # Terms history: list of {year:int, semester:"spring|summer|fall"}
    terms = models.JSONField(default=list, blank=True, help_text="List of offered terms")

    teachers = models.ManyToManyField('teachers.Teacher', related_name='courses', blank=True)
    department = models.CharField(max_length=200, blank=True)
    last_updated = models.DateTimeField(default=timezone.now)

    # Optional metadata used by CourseDetailCard
    ai_summary = models.TextField(blank=True)
    selection_category = models.CharField(max_length=100, blank=True)
    teaching_type = models.CharField(max_length=100, blank=True)
    course_category = models.CharField(max_length=100, blank=True)
    offering_department = models.CharField(max_length=200, blank=True)
    # Unified subject level: values '1'..'6'
    class Level(models.TextChoices):
        L1 = "1", "1"
        L2 = "2", "2"
        L3 = "3", "3"
        L4 = "4", "4"
        L5 = "5", "5"
        L6 = "6", "6"

    level = models.CharField(max_length=1, choices=Level.choices, blank=True)
    # credits can be number or string on the frontend, store as string for flexibility
    credits = models.CharField(max_length=20, blank=True)
    course_homepage_url = models.URLField(blank=True)
    syllabus_url = models.URLField(blank=True)
    # Curriculum: list of colleges -> majors -> semesters
    # Shape (camelCase) aligns with frontend expectations:
    # [
    #   { id, name, majors: [ { id, name, semesters: [ { id, year, semester, url, yearLevel? } ] } ] }
    # ]
    curriculum = models.JSONField(default=list, blank=True, help_text="List of curriculum colleges with majors and semesters")

    class Meta:
        indexes = [
            models.Index(fields=["course_id"]),
        ]
        verbose_name = "Course"
        verbose_name_plural = "Courses"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.subject_code} {self.title}"


class CourseReview(models.Model):
    """Course review model."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="reviews")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="course_reviews")
    overall_rating = models.FloatField(default=0)

    attr_difficulty = models.CharField(max_length=10, choices=Course.Difficulty.choices, default=Course.Difficulty.MEDIUM)
    attr_workload = models.CharField(max_length=10, choices=Course.Workload.choices, default=Course.Workload.MODERATE)
    attr_grading = models.CharField(max_length=10, choices=Course.Grading.choices, default=Course.Grading.BALANCED)
    attr_gain = models.CharField(max_length=10, choices=Course.Gain.choices, default=Course.Gain.DECENT)

    content = models.TextField()
    is_anonymous = models.BooleanField(default=False)
    only_text = models.BooleanField(default=False, help_text="如果为真，则仅文本评价（不含星级/维度）")
    likes_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    term_year = models.PositiveIntegerField(null=True, blank=True)
    term_semester = models.CharField(max_length=10, choices=Course.Semester.choices, blank=True)

    replies_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["author", "course"], name="unique_course_review_per_user"),
        ]
        verbose_name = "Course review"
        verbose_name_plural = "Course reviews"


class CourseReviewReply(models.Model):
    """Single-level course review reply model."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    review = models.ForeignKey(CourseReview, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    likes_count = models.PositiveIntegerField(default=0)
    reply_to_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="course_review_reply_targets")
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Course review reply"
        verbose_name_plural = "Course review replies"


class CourseReviewLike(models.Model):
    """User like for a CourseReview (for per-user isLiked and counting)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    review = models.ForeignKey(CourseReview, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "review"], name="unique_review_like"),
        ]
        indexes = [
            models.Index(fields=["review", "user"]),
        ]
        verbose_name = "Course review like"
        verbose_name_plural = "Course review likes"


class CourseReviewReplyLike(models.Model):
    """User like for a CourseReviewReply."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reply = models.ForeignKey(CourseReviewReply, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "reply"], name="unique_reply_like"),
        ]
        indexes = [
            models.Index(fields=["reply", "user"]),
        ]
        verbose_name = "Course review reply like"
        verbose_name_plural = "Course review reply likes"


class CourseVote(models.Model):
    """Per-user vote for a course: recommend or notRecommend.

    Enforces one active vote per (user, course). Used to update Course.rating_* counters.
    """

    class Value(models.TextChoices):
        RECOMMEND = "recommend", "recommend"
        NOT_RECOMMEND = "notRecommend", "notRecommend"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="votes")
    value = models.CharField(max_length=20, choices=Value.choices)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="unique_course_vote"),
        ]
        indexes = [
            models.Index(fields=["course", "user"]),
        ]
        verbose_name = "Course vote"
        verbose_name_plural = "Course votes"
