from __future__ import annotations

from django.contrib.auth import get_user_model
from typing import override
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from accounts.models import Profile

from .models import Course, CourseReview, CourseReviewReply, CourseReviewLike, CourseReviewReplyLike, CourseVote
from .presentation.author import get_course_review_author_display, get_course_review_reply_author_display
from .services import create_course_review, create_course_review_reply, update_course_review
from .services.course_exceptions import AlreadyReviewedError, ServiceError, NotFoundError
from .services.course_get_teachers import sort_teachers_by_surname
from .services.course_get_other_teacher_courses import get_other_teacher_courses_for_course
from .validators import (
    validate_curriculum_structure,
    validate_course_review_creation,
    validate_course_review_update,
    validate_course_review_reply_creation,
)


User = get_user_model()


class CourseSerializer(serializers.ModelSerializer):
    """
    Serializer aligning with the frontend Course type (camelCase output).
    
    Context keys expected:
        - include_user_vote: bool - Whether to include userVote field
        - include_user_review: bool - Whether to include userHasReview field  
        - include_other_teachers: bool - Whether to include otherTeacherCourses field
        - otherTeacherCoursesByCourseId: dict[UUID, list] - Precomputed other teacher courses by course ID
        - userVoteByCourseId: dict[UUID, str] - User vote state by course ID ('recommend' | 'notRecommend' | None)
        - userHasReviewByCourseId: dict[UUID, bool] - Whether user has review by course ID
    """

    # This serializer is read-only; all exposed fields are also marked read-only.
    courseId = serializers.CharField(source="course_id", read_only=True)
    subjectCode = serializers.CharField(source="subject_code", read_only=True)
    title = serializers.CharField(read_only=True)
    term = serializers.SerializerMethodField()
    terms = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()
    teachers = serializers.SerializerMethodField()
    department = serializers.CharField(read_only=True)
    lastUpdated = serializers.DateTimeField(source="last_updated", read_only=True)
    aiSummary = serializers.CharField(source="ai_summary", required=False, allow_blank=True, read_only=True)
    teachingType = serializers.CharField(source="teaching_type", required=False, allow_blank=True, read_only=True)
    courseCategory = serializers.CharField(source="course_category", required=False, allow_blank=True, read_only=True)
    offeringDepartment = serializers.CharField(source="offering_department", required=False, allow_blank=True, read_only=True)
    level = serializers.CharField(required=False, allow_blank=True, read_only=True)
    credits = serializers.CharField(required=False, allow_blank=True, read_only=True)
    courseHomepageUrl = serializers.URLField(source="course_homepage_url", required=False, allow_blank=True, read_only=True)
    syllabusUrl = serializers.URLField(source="syllabus_url", required=False, allow_blank=True, read_only=True)
    otherTeacherCourses = serializers.SerializerMethodField()
    curriculum = serializers.JSONField(required=False, read_only=True)
    userVote = serializers.SerializerMethodField()  # Per-user vote state (read-only): 'recommend' | 'notRecommend' | None
    userHasReview = serializers.SerializerMethodField()  # Whether current user has posted a review for this course

    class Meta:
        model = Course
        fields = [
            "courseId", "subjectCode", "title", "term", "terms", "rating",
            "attributes", "teachers", "department", "lastUpdated", "aiSummary",
            "teachingType", "courseCategory", "offeringDepartment", "level",
            "credits", "courseHomepageUrl", "syllabusUrl", "curriculum",
            "otherTeacherCourses", "userVote", "userHasReview",
        ]

    def __init__(self, *args, **kwargs):  # type: ignore[override]
        super().__init__(*args, **kwargs)
        # Only include userVote/userHasReview/otherTeacherCourses in detail responses when explicitly requested
        # This allows for efficient list views that don't need per-user data
        include_user_vote = bool(self.context.get("include_user_vote"))
        include_user_review = bool(self.context.get("include_user_review"))
        include_other_teachers = bool(self.context.get("include_other_teachers"))
        if not include_user_vote:
            self.fields.pop("userVote", None)
        if not include_user_review:
            self.fields.pop("userHasReview", None)
        if not include_other_teachers:
            self.fields.pop("otherTeacherCourses", None)

    def get_term(self, obj: Course):
        return {"year": obj.term_year, "semester": obj.term_semester}

    def get_terms(self, obj: Course):
        # If explicit list exists, return it; otherwise include the current term as a single-item list
        if obj.terms:
            return obj.terms
        return [{"year": obj.term_year, "semester": obj.term_semester}]

    def get_rating(self, obj: Course):
        return {
            "score": obj.rating_score,
            "reviewsCount": obj.rating_reviews_count,
            "recommendCount": obj.rating_recommend_count,
            "notRecommendCount": obj.rating_not_recommend_count,
            "deletedReviewsCount": obj.deleted_reviews_count,
        }

    def get_attributes(self, obj: Course):
        # Return None for each attribute if no reviews exist
        # This allows frontend to display "unknown" instead of misleading defaults
        return {
            "difficulty": obj.attr_difficulty or None,
            "workload": obj.attr_workload or None,
            "grading": obj.attr_grading or None,
            "gain": obj.attr_gain or None,
        }

    def get_teachers(self, obj: Course):
        """
        Returns all teachers associated with this course, sorted by surname (alphabetically).
        Title stripping and name normalization are handled by `services.course_get_teachers`.
        """
        teachers_sorted = sort_teachers_by_surname(obj.teachers.all())
        return [
            {"id": str(t.id), "name": t.name, "avatarUrl": t.avatar_url or None, "department": (t.department or None)}
            for t in teachers_sorted
        ]

    def get_otherTeacherCourses(self, obj: Course):
        """
        Compute other teacher courses for the current course.

        Returns a list of simplified course dicts that the frontend expects,
        matching the shape used in the course detail page. The core query and
        data-shaping logic is implemented in `services.course_get_other_teacher_courses`.
        """
        return get_other_teacher_courses_for_course(obj)

    def validate_curriculum(self, value):
        return validate_curriculum_structure(value)

    def get_userVote(self, obj: Course):
        annotated = getattr(obj, "_user_vote", None)
        if annotated:
            return annotated
        user_vote_map = self.context.get("userVoteByCourseId") or {}
        return user_vote_map.get(obj.course_id)

    def get_userHasReview(self, obj: Course) -> bool:
        annotated = getattr(obj, "_user_has_review", None)
        if annotated is not None:
            return bool(annotated)
        has_review_map = self.context.get("userHasReviewByCourseId") or {}
        return bool(has_review_map.get(obj.course_id, False))


class CourseReviewSerializer(serializers.ModelSerializer):
    """
    Serializer aligning with the frontend CourseReview type (camelCase).
    
    Context keys expected:
        - authorByReviewId: dict[UUID, dict] - Precomputed author display data by review ID
    """

    # fields contains both writable review content (courseId, ratings, content, term, anonymity flags) and read-only metadata. 
    id = serializers.UUIDField(read_only=True)
    courseId = serializers.PrimaryKeyRelatedField(
        # For reads, exposes the course UUID; for writes, accepts `courseId` or uses context-provided `course`.
        queryset=Course.objects.all(),
        source="course",
        required=False,
        error_messages={"does_not_exist": "invalid course courseId"},
    )
    courseSubjectCode = serializers.CharField(source="course.subject_code", read_only=True)
    courseTitle = serializers.CharField(source="course.title", read_only=True)
    author = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()
    overallRating = serializers.FloatField(source="overall_rating", required=False)
    likesCount = serializers.IntegerField(source="likes_count", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    term = serializers.SerializerMethodField()
    repliesCount = serializers.IntegerField(source="replies_count", read_only=True)
    isEdited = serializers.BooleanField(source="is_edited", read_only=True)
    isLiked = serializers.SerializerMethodField()

    isAnonymous = serializers.BooleanField(source="is_anonymous", required=False)
    onlyText = serializers.BooleanField(source="only_text", required=False)

    class Meta:
        model = CourseReview
        fields = [
            "id", "courseId", "courseSubjectCode", "courseTitle", "author",
            "overallRating", "attributes", "content", "likesCount",
            "createdAt", "updatedAt", "term", "repliesCount", "isLiked",
            "isAnonymous", "onlyText", "isEdited",
        ]
    
    def get_author(self, obj: CourseReview) -> dict:
        """
        Resolve the author payload for a review.

        Uses the shared presentation-layer helper `get_course_review_author_display`
        so that anonymous review rules are applied consistently across all endpoints.
        """
        # Priority 1: Check annotated/precomputed data (most efficient, optional)
        annotated = getattr(obj, "_author_display", None)
        if annotated is not None:
            return annotated
        
        # Priority 2: Check context mapping (batch precomputed, optional)
        author_map = self.context.get("authorByReviewId") or {}
        mapped = author_map.get(obj.id)
        if mapped is not None:
            return mapped
        
        # Priority 3: Compute based on current request user and review flags
        request = self.context.get("request")
        request_user = request.user if request is not None else None
        return get_course_review_author_display(obj, request_user)

    def get_attributes(self, obj: CourseReview) -> dict | None:
        # Return None for text-only reviews to avoid showing meaningless default values
        if obj.only_text:
            return None

        return {
            "difficulty": obj.attr_difficulty,
            "workload": obj.attr_workload,
            "grading": obj.attr_grading,
            "gain": obj.attr_gain,
        }

    def get_term(self, obj: CourseReview):
        if obj.term_year and obj.term_semester:
            return {"year": obj.term_year, "semester": obj.term_semester}
        return None

    def get_isLiked(self, obj: CourseReview) -> bool:
        request = self.context.get("request")
        user = request.user if request is not None else None
        if not user or not user.is_authenticated:
            return False
        
        # Priority 1: Check annotated data (most efficient)
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        
        # Priority 2: Fallback to database query (least efficient)
        return obj.likes.filter(user=user).exists()
    
    @override
    def validate(self, attrs):  # type: ignore[override]
        # Validate course review data for creation or update.

        initial_data = getattr(self, "initial_data", {}) or {}

        # Update existing review
        if self.instance is not None:
            return validate_course_review_update(attrs, initial_data, self.instance)

        # Creation path: ensure we have a `course` in attrs.
        course = attrs.get("course")
        if course is None:
            context_course = self.context.get("course")
            if context_course is not None:
                attrs["course"] = context_course
                course = context_course

        if course is None:
            raw_course_id = initial_data.get("courseId")
            if raw_course_id:
                try:
                    course = Course.objects.get(course_id=raw_course_id)
                    attrs["course"] = course
                except Course.DoesNotExist:
                    raise serializers.ValidationError({"courseId": "invalid course courseId"})

        if course is None:
            # At this point we still don't have course information. Treat as validation error.
            raise serializers.ValidationError({"courseId": "required"})
        
        return validate_course_review_creation(attrs, initial_data)
    
    @override
    def create(self, validated_data):  # type: ignore[override]
        # Note: The authenticated user is taken from serializer context (request.user).

        # Drop any author passed via serializer.save(author=...)
        validated_data.pop("author", None)

        request = self.context.get("request")
        user = request.user if request is not None else None
        course = validated_data.pop("course", None)

        if not user or not user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication required"})
        if course is None:
            raise serializers.ValidationError({"courseId": "required"})

        try:
            return create_course_review(
                user=user,
                course=course,
                payload=validated_data,
            )
        except AlreadyReviewedError:
            raise serializers.ValidationError(
                {
                    "detail": "You have already reviewed this course.",
                    "code": "already_reviewed",
                }
            )
    
    @override
    def update(self, instance: CourseReview, validated_data):  # type: ignore[override]
        request = self.context.get("request")
        user = request.user if request is not None else None

        if not user or not user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication required"})

        try:
            return update_course_review(user=user, review=instance, payload=validated_data)
        except PermissionError as e:
            # Map domain-level permission failures to DRF's permission exception
            # so the standard exception handler returns HTTP 403.
            raise PermissionDenied(detail=str(e))


class CourseReviewReplySerializer(serializers.ModelSerializer):
    """
    Serializer aligning with the frontend CourseReviewReply type (camelCase).
    
    Context keys expected:
        - authorByReplyId: dict[UUID, dict] - Precomputed author display data by reply ID
    """

    # reviewId/content/replyTo/isAnonymous are writable for creating replies; everything else is read-only metadata.
    id = serializers.UUIDField(read_only=True)
    reviewId = serializers.PrimaryKeyRelatedField(
        queryset=CourseReview.objects.all(),
        source="review",
        required=False,
        error_messages={
            "required": "required",
            "does_not_exist": "invalid",
        },
    )
    author = serializers.SerializerMethodField()
    replyTo = serializers.UUIDField(source="reply_to_id", allow_null=True, required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    likes = serializers.IntegerField(source="likes_count", read_only=True)
    isLiked = serializers.SerializerMethodField()
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)
    isAnonymous = serializers.BooleanField(source="is_anonymous", required=False, default=False)

    class Meta:
        model = CourseReviewReply
        fields = [
            "id", "reviewId", "author", "content", "createdAt",
            "likes", "isLiked", "replyTo", "isDeleted",
            "isAnonymous",
        ]
    
    def get_author(self, obj: CourseReviewReply) -> dict:
        """
        Resolve the author payload for a course review reply.

        Uses the shared presentation-layer helper `get_course_review_reply_author_display`
        so that anonymous reply rules are applied consistently across all endpoints.
        """
        # Priority 1: Check annotated/precomputed data (most efficient, optional)
        annotated = getattr(obj, "_author_display", None)
        if annotated is not None:
            return annotated
        
        # Priority 2: Check context mapping (batch precomputed, optional)
        author_map = self.context.get("authorByReplyId") or {}
        mapped = author_map.get(obj.id)
        if mapped is not None:
            return mapped
        
        # Priority 3: Compute based on current request user and reply flags
        request = self.context.get("request")
        request_user = request.user if request is not None else None
        return get_course_review_reply_author_display(obj, request_user)

    def get_isLiked(self, obj: CourseReviewReply) -> bool:
        request = self.context.get("request")

        user = request.user if request is not None else None
        if not user or not user.is_authenticated:
            return False
        
        # Priority 1: Check annotated data (most efficient)
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        
        # Priority 2: Fallback to database query (least efficient)
        return obj.likes.filter(user=user).exists()
    
    @override
    def validate(self, attrs):  # type: ignore[override]
        # Validate reply data for creation, updates are blocked at the view layer.

        initial_data = getattr(self, "initial_data", {}) or {}

        # Only support creation
        if self.instance is not None:
            return attrs

        # Ensure we have a `review` in attrs.
        review = attrs.get("review")
        if review is None:
            context_review = self.context.get("review")
            if context_review is not None:
                attrs["review"] = context_review
                review = context_review

        if review is None:
            raw_review_id = initial_data.get("reviewId")
            if raw_review_id:
                try:
                    review = CourseReview.objects.get(pk=raw_review_id)
                    attrs["review"] = review
                except CourseReview.DoesNotExist:
                    raise serializers.ValidationError({"reviewId": "invalid"})

        if review is None:
            raise serializers.ValidationError({"reviewId": "required"})

        # Validate reply_to target if provided
        reply_to_id = attrs.get("reply_to_id")
        if reply_to_id is not None:
            try:
                reply_to_obj = CourseReviewReply.objects.get(pk=reply_to_id)
            except CourseReviewReply.DoesNotExist:
                raise serializers.ValidationError({"replyTo": "invalid reply target id"})
            if reply_to_obj.is_deleted:
                raise serializers.ValidationError({"replyTo": "reply target has been deleted"})
            # Ensure reply target belongs to the same review
            if str(reply_to_obj.review_id) != str(review.pk):
                raise serializers.ValidationError({"replyTo": "reply target does not belong to the given reviewId"})

        # Validate reply creation
        return validate_course_review_reply_creation(attrs, initial_data)
    
    @override
    def create(self, validated_data):  # type: ignore[override]
        # Drop any author passed via serializer.save(author=...)
        # This is a security measure: ensure the author is always taken from the request context (the authenticated user), preventing clients from forging author identity via `save()` method
        validated_data.pop("author", None)

        request = self.context.get("request")
        user = request.user if request is not None else None
        review = validated_data.pop("review", None)

        if not user or not user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication required"})
        if review is None:
            raise serializers.ValidationError({"reviewId": "required"})

        try:
            return create_course_review_reply(
                user=user,
                review=review,
                payload=validated_data,
            )
        except ServiceError as e:
            raise serializers.ValidationError({"detail": str(e)})
    
    @override
    def update(self, instance: CourseReviewReply, validated_data):  # type: ignore[override]
        # Reply updates are not allowed
        raise serializers.ValidationError({"detail": "reply editing is not allowed"})


class CourseVoteInputSerializer(serializers.Serializer):
    """
    Serializer for course voting input.
    Used for creating/updating course votes. No context keys expected.
    """
    voteType = serializers.ChoiceField(choices=[CourseVote.Value.RECOMMEND, CourseVote.Value.NOT_RECOMMEND])
