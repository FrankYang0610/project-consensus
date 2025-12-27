from __future__ import annotations

import uuid
from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import Avg, BooleanField, Count, Case, Exists, When, Value, IntegerField, F, OuterRef, Q
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
        KILLER = "killer", "killer"

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
    deleted_reviews_count = models.PositiveIntegerField(default=0)  # Counter of how many reviews have been deleted for this course.
    # Extra rating counters used by frontend voting UI
    rating_recommend_count = models.PositiveIntegerField(default=0)
    rating_not_recommend_count = models.PositiveIntegerField(default=0)

    attr_difficulty = models.CharField(max_length=10, choices=Difficulty.choices, null=True, blank=True)
    attr_workload = models.CharField(max_length=10, choices=Workload.choices, null=True, blank=True)
    attr_grading = models.CharField(max_length=10, choices=Grading.choices, null=True, blank=True)
    attr_gain = models.CharField(max_length=10, choices=Gain.choices, null=True, blank=True)

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
            models.Index(
                fields=["-last_updated"],
                name="course_last_updated_idx",
            ),
            GinIndex(
                fields=["subject_code"],
                name="courses_subject_code_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
            GinIndex(
                fields=["title"],
                name="courses_title_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
            GinIndex(
                fields=["department"],
                name="courses_department_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]
        verbose_name = "Course"
        verbose_name_plural = "Courses"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.subject_code} {self.title}"

    def increment_deleted_reviews_count(self) -> None:
        # Atomically increment deleted_reviews_count for this course.
        Course.objects.filter(pk=self.pk).update(deleted_reviews_count=F("deleted_reviews_count") + 1)

    def recompute_aggregates(self) -> None:
        """Recompute rating score, reviews count, and attribute aggregates.

        Must be called within a transaction when concurrency is possible; uses
        row-level locking to avoid race conditions.
        """
        # Lock this course row
        locked_course = Course.objects.select_for_update().get(pk=self.pk)

        # Attribute value to numeric mappings for weighted averaging
        DIFFICULTY_MAP = {
            "veryEasy": 1,
            "easy": 2,
            "medium": 3,
            "hard": 4,
            "veryHard": 5,
        }
        DIFFICULTY_REVERSE = {1: "veryEasy", 2: "easy", 3: "medium", 4: "hard", 5: "veryHard"}

        WORKLOAD_MAP = {
            "light": 1,
            "moderate": 2,
            "heavy": 3,
            "veryHeavy": 4,
        }
        WORKLOAD_REVERSE = {1: "light", 2: "moderate", 3: "heavy", 4: "veryHeavy"}

        GRADING_MAP = {
            "lenient": 1,
            "balanced": 2,
            "strict": 3,
            "killer": 4,
        }
        GRADING_REVERSE = {1: "lenient", 2: "balanced", 3: "strict", 4: "killer"}

        GAIN_MAP = {
            "low": 1,
            "decent": 2,
            "high": 3,
        }
        GAIN_REVERSE = {1: "low", 2: "decent", 3: "high"}

        qs = self.reviews.all()
        agg = qs.aggregate(
            total_count=Count("id"),
            rated_count=Count(Case(When(only_text=False, then=Value(1)), output_field=IntegerField())),
            avg=Avg(Case(When(only_text=False, then=F("overall_rating")))),
        )
        total_reviews_count = int(agg.get("total_count") or 0)
        rated_count = int(agg.get("rated_count") or 0)
        avg = float(agg.get("avg") or 0.0)
        score = round(avg, 1) if rated_count > 0 else 0.0

        locked_course.rating_reviews_count = total_reviews_count
        locked_course.rating_score = score

        if rated_count > 0:
            reviews = list(qs.filter(only_text=False).values("attr_difficulty", "attr_workload", "attr_grading", "attr_gain"))

            difficulty_values = [DIFFICULTY_MAP.get(r["attr_difficulty"]) for r in reviews]
            difficulty_values = [v for v in difficulty_values if v is not None]
            if difficulty_values:
                avg_difficulty = sum(difficulty_values) / len(difficulty_values)
                rounded_difficulty = max(1, min(5, round(avg_difficulty)))
                locked_course.attr_difficulty = DIFFICULTY_REVERSE[rounded_difficulty]

            workload_values = [WORKLOAD_MAP.get(r["attr_workload"]) for r in reviews]
            workload_values = [v for v in workload_values if v is not None]
            if workload_values:
                avg_workload = sum(workload_values) / len(workload_values)
                rounded_workload = max(1, min(4, round(avg_workload)))
                locked_course.attr_workload = WORKLOAD_REVERSE[rounded_workload]

            grading_values = [GRADING_MAP.get(r["attr_grading"]) for r in reviews]
            grading_values = [v for v in grading_values if v is not None]
            if grading_values:
                avg_grading = sum(grading_values) / len(grading_values)
                rounded_grading = max(1, min(4, round(avg_grading)))
                locked_course.attr_grading = GRADING_REVERSE[rounded_grading]

            gain_values = [GAIN_MAP.get(r["attr_gain"]) for r in reviews]
            gain_values = [v for v in gain_values if v is not None]
            if gain_values:
                avg_gain = sum(gain_values) / len(gain_values)
                rounded_gain = max(1, min(3, round(avg_gain)))
                locked_course.attr_gain = GAIN_REVERSE[rounded_gain]
        else:
            locked_course.attr_difficulty = None
            locked_course.attr_workload = None
            locked_course.attr_grading = None
            locked_course.attr_gain = None

        locked_course.save(update_fields=[
            "rating_reviews_count",
            "rating_score",
            "attr_difficulty",
            "attr_workload",
            "attr_grading",
            "attr_gain",
        ])



class CourseReviewQuerySet(models.QuerySet):
    """
    Custom queryset for CourseReview to encapsulate common select/annotate patterns.

    This keeps list/detail/user-activity views DRY and ensures that any future
    changes to the eager-loading strategy only need to be updated in one place.
    """

    def with_details(self) -> "CourseReviewQuerySet":
        """
        Attach common related objects used by serializers and views:
        - course
        - author and author.profile
        - likes relation
        """
        return (
            self.select_related("course", "author", "author__profile")
            .prefetch_related("likes")
        )

    def with_user_interaction(self, user) -> "CourseReviewQuerySet":
        """
        Annotate is_liked for a given user.

        - For authenticated users: exists subquery on CourseReviewLike
        - For anonymous users: constant False (BooleanField)
        """
        if user is not None and user.is_authenticated:
            return self.annotate(
                is_liked=Exists(
                    CourseReviewLike.objects.filter(
                        review_id=OuterRef("id"),
                        user=user,
                    )
                )
            )
        return self.annotate(is_liked=Value(False, output_field=BooleanField()))


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
    only_text = models.BooleanField(default=False, help_text="If true, only text reviews (no rating and attributes)")
    likes_count = models.PositiveIntegerField(default=0)
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    term_year = models.PositiveIntegerField(null=True, blank=True)
    term_semester = models.CharField(max_length=10, choices=Course.Semester.choices, blank=True)

    replies_count = models.PositiveIntegerField(default=0)

    objects: CourseReviewQuerySet = CourseReviewQuerySet.as_manager()

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(
                fields=["created_at"],
                name="coursereview_created_idx",
            ),
            models.Index(
                fields=["updated_at"],
                name="coursereview_updated_idx",
            ),
            GinIndex(
                fields=["content"],
                name="coursereview_content_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]
        constraints = [
            models.UniqueConstraint(fields=["author", "course"], name="unique_course_review_per_user"),
            models.CheckConstraint(
                # Text-only reviews must have rating = 0
                condition=Q(only_text=False) | Q(overall_rating=0),
                name="coursereview_only_text_zero_rating",
            ),
            models.CheckConstraint(
                # Rated reviews (only_text=false) must have rating in [1, 10]
                condition=Q(only_text=True) | (Q(overall_rating__gte=1) & Q(overall_rating__lte=10)),
                name="coursereview_rated_rating_range_1_10",
            ),
        ]
        verbose_name = "Course review"
        verbose_name_plural = "Course reviews"

    def recompute_replies_count(self) -> None:
        cnt = self.replies.filter(is_deleted=False).count()
        CourseReview.objects.filter(pk=self.pk).update(replies_count=cnt)

    def increment_like(self) -> None:
        """Atomically increment likes_count for this review."""
        CourseReview.objects.filter(pk=self.pk).update(likes_count=F("likes_count") + 1)

    def decrement_like(self) -> None:
        """Atomically decrement likes_count for this review without going below zero."""
        CourseReview.objects.filter(pk=self.pk).update(
            likes_count=Case(
                When(likes_count__gt=0, then=F("likes_count") - 1),
                default=Value(0),
                output_field=IntegerField(),
            )
        )


class CourseReviewReplyQuerySet(models.QuerySet):
    """
    Custom queryset for CourseReviewReply to share common eager-loading
    and per-user interaction annotations.
    """

    def with_details(self) -> "CourseReviewReplyQuerySet":
        """
        Attach common related objects used by serializers:
        - review
        - author, author.profile
        - reply_to, reply_to.author, reply_to.author.profile
        - likes
        """
        return (
            self.select_related("review", "author", "author__profile", "reply_to", "reply_to__author", "reply_to__author__profile")
            .prefetch_related("likes")
        )

    def with_user_interaction(self, user) -> "CourseReviewReplyQuerySet":
        """
        Annotate is_liked for a given user.

        - For authenticated users: exists subquery on CourseReviewReplyLike
        - For anonymous users: constant False (BooleanField)
        """
        if user is not None and user.is_authenticated:
            return self.annotate(
                is_liked=Exists(
                    CourseReviewReplyLike.objects.filter(
                        reply_id=OuterRef("id"),
                        user=user,
                    )
                )
            )
        return self.annotate(is_liked=Value(False, output_field=BooleanField()))


class CourseReviewReply(models.Model):
    """Single-level course review reply model."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    review = models.ForeignKey(CourseReview, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    likes_count = models.PositiveIntegerField(default=0)
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies_to_this")
    is_deleted = models.BooleanField(default=False)
    is_anonymous = models.BooleanField(default=False)  # Whether the reply should display the author as Anonymous on the client

    objects: CourseReviewReplyQuerySet = CourseReviewReplyQuerySet.as_manager()

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(is_deleted=False) | Q(content=""),
                name="coursereviewreply_deleted_content_empty",
            ),
        ]
        indexes = [
            models.Index(
                fields=["is_deleted", "created_at"],
                name="crreply_del_created_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="crreply_created_idx",
            ),
        ]
        verbose_name = "Course review reply"
        verbose_name_plural = "Course review replies"

    def increment_like(self) -> None:
        """Atomically increment likes_count for this reply."""
        CourseReviewReply.objects.filter(pk=self.pk).update(likes_count=F("likes_count") + 1)

    def decrement_like(self) -> None:
        """Atomically decrement likes_count for this reply without going below zero."""
        CourseReviewReply.objects.filter(pk=self.pk).update(
            likes_count=Case(
                When(likes_count__gt=0, then=F("likes_count") - 1),
                default=Value(0),
                output_field=IntegerField(),
            )
        )


class CourseReviewLike(models.Model):
    """User like for a CourseReview (for per-user isLiked and counting)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    review = models.ForeignKey(CourseReview, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "review"], name="unique_review_like"),
        ]
        indexes = [
            models.Index(
                fields=["review", "user"],
                name="crlike_review_user_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="crlike_created_idx",
            ),
        ]
        verbose_name = "Course review like"
        verbose_name_plural = "Course review likes"


class CourseReviewReplyLike(models.Model):
    """User like for a CourseReviewReply."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reply = models.ForeignKey(CourseReviewReply, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "reply"], name="unique_reply_like"),
        ]
        indexes = [
            models.Index(
                fields=["reply", "user"],
                name="crrplike_reply_user_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="crrplike_created_idx",
            ),
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
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="unique_course_vote"),
        ]
        indexes = [
            models.Index(
                fields=["course", "user"],
                name="coursevote_course_user_idx",
            ),
            models.Index(
                fields=["created_at"],
                name="coursevote_created_idx",
            ),
        ]
        verbose_name = "Course vote"
        verbose_name_plural = "Course votes"
