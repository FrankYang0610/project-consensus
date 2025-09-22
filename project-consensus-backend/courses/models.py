from __future__ import annotations

import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Course(models.Model):
    """Course basic info + aggregated rating.

    Aligns with the frontend Course type:
    - subject_id, subject_code, title
    - term: year + semester (choices)
    - rating: score (0–10) and reviews_count
    - attributes: difficulty/workload/grading/gain (choices)
    - teachers: JSON list of strings (teacher names in this scaffold)
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

    subject_id = models.CharField(max_length=64, unique=True)
    subject_code = models.CharField(max_length=64)
    title = models.CharField(max_length=200)

    term_year = models.PositiveIntegerField()
    term_semester = models.CharField(max_length=10, choices=Semester.choices)

    rating_score = models.FloatField(default=0)
    rating_reviews_count = models.PositiveIntegerField(default=0)

    attr_difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    attr_workload = models.CharField(max_length=10, choices=Workload.choices, default=Workload.MODERATE)
    attr_grading = models.CharField(max_length=10, choices=Grading.choices, default=Grading.BALANCED)
    attr_gain = models.CharField(max_length=10, choices=Gain.choices, default=Gain.DECENT)

    teachers = models.JSONField(default=list, blank=True, help_text="教师姓名列表，例如 ['Alice','Bob']")
    department = models.CharField(max_length=200, blank=True)
    last_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["subject_id"]),
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
    likes_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    term_year = models.PositiveIntegerField(null=True, blank=True)
    term_semester = models.CharField(max_length=10, choices=Course.Semester.choices, blank=True)

    replies_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
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
