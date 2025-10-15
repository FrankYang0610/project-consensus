from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Course, CourseReview, CourseReviewReply, CourseReviewLike, CourseReviewReplyLike, CourseVote
from .validators import validate_curriculum_structure, validate_course_attributes_enum


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

    courseId = serializers.CharField(source="course_id")
    subjectCode = serializers.CharField(source="subject_code")
    term = serializers.SerializerMethodField()
    terms = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()
    teachers = serializers.SerializerMethodField()
    lastUpdated = serializers.DateTimeField(source="last_updated")
    aiSummary = serializers.CharField(source="ai_summary", required=False, allow_blank=True)
    selectionCategory = serializers.CharField(source="selection_category", required=False, allow_blank=True)
    teachingType = serializers.CharField(source="teaching_type", required=False, allow_blank=True)
    courseCategory = serializers.CharField(source="course_category", required=False, allow_blank=True)
    offeringDepartment = serializers.CharField(source="offering_department", required=False, allow_blank=True)
    level = serializers.CharField(required=False, allow_blank=True)
    credits = serializers.CharField(required=False, allow_blank=True)
    courseHomepageUrl = serializers.URLField(source="course_homepage_url", required=False, allow_blank=True)
    syllabusUrl = serializers.URLField(source="syllabus_url", required=False, allow_blank=True)
    otherTeacherCourses = serializers.SerializerMethodField()
    curriculum = serializers.JSONField(required=False)
    # Per-user vote state (read-only): 'recommend' | 'notRecommend' | None
    userVote = serializers.SerializerMethodField()
    # Whether current user has posted a review for this course
    userHasReview = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "courseId",
            "subjectCode",
            "title",
            "term",
            "terms",
            "rating",
            "attributes",
            "teachers",
            "department",
            "lastUpdated",
            "aiSummary",
            "selectionCategory",
            "teachingType",
            "courseCategory",
            "offeringDepartment",
            "level",
            "credits",
            "courseHomepageUrl",
            "syllabusUrl",
            "curriculum",
            "otherTeacherCourses",
            "userVote",
            "userHasReview",
        ]
        read_only_fields = ["lastUpdated"]

    def __init__(self, *args, **kwargs):  # type: ignore[override]
        super().__init__(*args, **kwargs)
        # Only include userVote/userHasReview/otherTeacherCourses in detail responses when explicitly requested
        # This allows for efficient list views that don't need per-user data
        include_user_vote = bool(getattr(self, "context", {}).get("include_user_vote"))
        include_user_review = bool(getattr(self, "context", {}).get("include_user_review"))
        include_other_teachers = bool(getattr(self, "context", {}).get("include_other_teachers"))
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
            "recommendCount": getattr(obj, "rating_recommend_count", 0),
            "notRecommendCount": getattr(obj, "rating_not_recommend_count", 0),
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
        # Use M2M: return minimal refs with id + name + avatarUrl
        return [
            {"id": str(t.id), "name": t.name, "avatarUrl": t.avatar_url or None}
            for t in obj.teachers.all()
        ]

    def get_otherTeacherCourses(self, obj: Course):
        """
        Return other teacher courses from annotations or serializer context.

        This serializer does not perform service/database lookups. Views should
        annotate the instance with `_other_teacher_courses` or provide a
        `otherTeacherCoursesByCourseId` mapping in the serializer context.
        
        Priority: 1) Annotated data, 2) Context mapping, 3) Empty list
        """
        annotated = getattr(obj, "_other_teacher_courses", None)
        if annotated is not None:
            return annotated
        mapping = (self.context.get("otherTeacherCoursesByCourseId") or {}) if hasattr(self, "context") else {}
        return mapping.get(obj.course_id, [])

    def validate_curriculum(self, value):
        return validate_curriculum_structure(value)

    def get_userVote(self, obj: Course):
        annotated = getattr(obj, "_user_vote", None)
        if annotated:
            return annotated
        user_vote_map = (self.context.get("userVoteByCourseId") or {}) if hasattr(self, "context") else {}
        return user_vote_map.get(obj.course_id)

    def get_userHasReview(self, obj: Course) -> bool:
        annotated = getattr(obj, "_user_has_review", None)
        if annotated is not None:
            return bool(annotated)
        has_review_map = (self.context.get("userHasReviewByCourseId") or {}) if hasattr(self, "context") else {}
        return bool(has_review_map.get(obj.course_id, False))


class CourseReviewSerializer(serializers.ModelSerializer):
    """
    Serializer aligning with the frontend CourseReview type (camelCase).
    
    Context keys expected:
        - authorByReviewId: dict[UUID, dict] - Precomputed author display data by review ID
    """

    courseId = serializers.CharField(source="course.course_id", read_only=True)
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
            "id",
            "courseId",
            "author",
            "overallRating",
            "attributes",
            "content",
            "likesCount",
            "createdAt",
            "updatedAt",
            "term",
            "repliesCount",
            "isLiked",
            "isAnonymous",
            "onlyText",
            "isEdited",
        ]
        read_only_fields = ["id", "courseId", "likesCount", "createdAt", "updatedAt", "repliesCount", "isEdited"]
    
    def get_author(self, obj: CourseReview) -> dict:
        """
        Get author display information with fallback hierarchy.
        
        Priority: 1) Annotated data, 2) Context mapping, 3) Direct object access
        """
        # Prefer precomputed author display from annotations or context.
        annotated = getattr(obj, "_author_display", None)
        if annotated is not None:
            return annotated
        author_map = (self.context.get("authorByReviewId") or {}) if hasattr(self, "context") else {}
        mapped = author_map.get(obj.id)
        if mapped is not None:
            return mapped
        # Minimal fallback without invoking presentation builders.
        author = getattr(obj, "author", None)
        if author is None:
            return {"id": "", "name": "", "avatarUrl": None}
        # Use Profile nickname instead of email/username
        try:
            from accounts.models import Profile
            profile = author.profile
            display_name = profile.nickname or author.get_username()
            avatar_url = profile.avatar_url or None
        except Profile.DoesNotExist:
            display_name = author.get_username()
            avatar_url = None
        return {"id": str(getattr(author, "pk", "")), "name": display_name, "avatarUrl": avatar_url}

    def get_attributes(self, obj: CourseReview) -> dict | None:
        """
        Get review attributes, returning None for text-only reviews.
        
        Text-only reviews don't have meaningful attribute values, so we return None
        to let the frontend handle the display appropriately.
        """
        # Return None for text-only reviews to avoid showing meaningless default values
        if getattr(obj, "only_text", False):
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
        """
        Check if current user has liked this review.
        
        Priority: 1) Annotated flag, 2) Fallback exists() by current user
        """
        request = getattr(self, "context", {}).get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        return obj.likes.filter(user=user).exists()

    def validate(self, attrs):  # type: ignore[override]
        """
        Basic field-level validation for course review data.
        
        Business logic validation is handled at the view/service layer
        to maintain proper separation of concerns.
        """
        return attrs


class CourseReviewReplySerializer(serializers.ModelSerializer):
    """
    Serializer aligning with the frontend CourseReviewReply type (camelCase).
    
    Context keys expected:
        - authorByReplyId: dict[UUID, dict] - Precomputed author display data by reply ID
        - replyToUserByReplyId: dict[UUID, dict] - Precomputed reply-to-user display data by reply ID
    """

    reviewId = serializers.CharField(source="review_id", read_only=True)
    author = serializers.SerializerMethodField()
    replyToUser = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    likes = serializers.IntegerField(source="likes_count", read_only=True)
    isLiked = serializers.SerializerMethodField()
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)

    class Meta:
        model = CourseReviewReply
        fields = [
            "id",
            "reviewId",
            "author",
            "content",
            "createdAt",
            "likes",
            "isLiked",
            "replyToUser",
            "isDeleted",
        ]
        read_only_fields = ["id", "reviewId", "createdAt", "likes", "isDeleted"]
    
    def get_author(self, obj: CourseReviewReply) -> dict:
        """
        Get reply author display information with fallback hierarchy.
        
        Priority: 1) Annotated data, 2) Context mapping, 3) Direct object access
        """
        annotated = getattr(obj, "_author_display", None)
        if annotated is not None:
            return annotated
        author_map = (self.context.get("authorByReplyId") or {}) if hasattr(self, "context") else {}
        mapped = author_map.get(obj.id)
        if mapped is not None:
            return mapped
        user = getattr(obj, "author", None)
        if user is None:
            return {"id": "", "name": "", "avatarUrl": None}
        # Use Profile nickname
        try:
            from accounts.models import Profile
            profile = user.profile
            display_name = profile.nickname or user.get_username()
            avatar_url = profile.avatar_url or None
        except Profile.DoesNotExist:
            display_name = user.get_username()
            avatar_url = None
        return {"id": str(getattr(user, "pk", "")), "name": display_name, "avatarUrl": avatar_url}

    def get_replyToUser(self, obj: CourseReviewReply):
        """
        Get the user being replied to, if this is a reply to another user.
        
        Returns None if not a reply to user, otherwise returns user display info.
        Priority: 1) Annotated data, 2) Context mapping, 3) Direct object access
        """
        if not obj.reply_to_user_id:
            return None
        annotated = getattr(obj, "_reply_to_user_display", None)
        if annotated is not None:
            return annotated
        reply_map = (self.context.get("replyToUserByReplyId") or {}) if hasattr(self, "context") else {}
        mapped = reply_map.get(obj.id)
        if mapped is not None:
            return mapped
        user = getattr(obj, "reply_to_user", None)
        if user is None:
            return {"id": "", "name": "", "avatarUrl": None}
        # Use Profile nickname
        try:
            from accounts.models import Profile
            profile = user.profile
            display_name = profile.nickname or user.get_username()
            avatar_url = profile.avatar_url or None
        except Profile.DoesNotExist:
            display_name = user.get_username()
            avatar_url = None
        return {"id": str(getattr(user, "pk", "")), "name": display_name, "avatarUrl": avatar_url}

    def get_isLiked(self, obj: CourseReviewReply) -> bool:
        """
        Check if current user has liked this reply.
        
        Priority: 1) Annotated flag, 2) Fallback exists() by current user
        """
        request = getattr(self, "context", {}).get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        return obj.likes.filter(user=user).exists()

    def validate(self, attrs):  # type: ignore[override]
        """
        Validate reply data using business rules.
        
        Only supports creation - updates are not allowed for replies.
        """
        # Business validation for reply creation
        from .validators import validate_course_review_reply_creation
        return validate_course_review_reply_creation(attrs, self.initial_data)

    def update(self, instance: CourseReviewReply, validated_data):  # type: ignore[override]
        """
        Reply updates are not allowed - always raises validation error.
        
        This enforces the business rule that replies cannot be edited once created.
        """
        raise serializers.ValidationError({"detail": "reply editing is not allowed"})

class CourseVoteInputSerializer(serializers.Serializer):
    """
    Serializer for course voting input.
    
    Used for creating/updating course votes. No context keys expected.
    """
    voteType = serializers.ChoiceField(choices=[CourseVote.Value.RECOMMEND, CourseVote.Value.NOT_RECOMMEND])
