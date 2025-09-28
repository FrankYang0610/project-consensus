from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Profile
from .models import Course, CourseReview, CourseReviewReply, CourseReviewLike, CourseReviewReplyLike


User = get_user_model()


def _author_payload_for(user: User) -> dict:
    """Build an Author dict for course APIs (camelCase).

    Note: Course-related APIs use `avatarUrl` to align with frontend Course types,
    which differ from forum/user `Author` shape that uses `avatar`.
    """
    try:
        p: Profile = user.profile  # type: ignore[attr-defined]
        name = p.display_name or user.get_username()
        avatar_url = p.avatar_url or None
    except Profile.DoesNotExist:  # pragma: no cover
        name = user.get_username()
        avatar_url = None
    return {"id": str(user.pk), "name": name, "avatarUrl": avatar_url}


class CourseSerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend Course type (camelCase output)."""

    subjectId = serializers.CharField(source="subject_id")
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

    class Meta:
        model = Course
        fields = [
            "subjectId",
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
        ]
        read_only_fields = ["lastUpdated"]

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
        return {
            "difficulty": obj.attr_difficulty,
            "workload": obj.attr_workload,
            "grading": obj.attr_grading,
            "gain": obj.attr_gain,
        }

    def get_teachers(self, obj: Course):
        # Use M2M: return minimal refs with id + name + avatarUrl
        return [
            {"id": str(t.id), "name": t.name, "avatarUrl": t.avatar_url or None}
            for t in obj.teachers.all()
        ]

    def get_otherTeacherCourses(self, obj: Course):
        # Other courses with the same subject_code but different subject_id
        qs = (
            Course.objects
            .filter(subject_code=obj.subject_code)
            .exclude(subject_id=obj.subject_id)
            .prefetch_related("teachers")
        )
        result = []
        for c in qs:
            teacher = next(iter(c.teachers.all()), None)
            payload = {
                "subjectId": str(c.subject_id),
                "teacherName": getattr(teacher, "name", "Unknown"),
                "teacherAvatarUrl": getattr(teacher, "avatar_url", None) if teacher else None,
                "rating": {
                    "score": c.rating_score,
                    "reviewsCount": c.rating_reviews_count,
                },
                "attributes": {
                    "difficulty": c.attr_difficulty,
                    "workload": c.attr_workload,
                    "grading": c.attr_grading,
                    "gain": c.attr_gain,
                },
            }
            result.append(payload)
        return result

    def validate_curriculum(self, value):
        """
        Validate the curriculum structure.

        The curriculum must be a list of colleges, where each college is a dict with a "majors" key
        containing a list of majors. Each major is a dict with a "semesters" key containing a list of semesters.
        Each semester is a dict that may contain:
            - "year": an integer
            - "semester": one of "spring", "summer", or "fall"

        Validation rules:
        - The top-level value must be a list (or None/"", which is treated as empty).
        - Each college must be a dict with a "majors" key (list).
        - Each major must be a dict with a "semesters" key (list).
        - Each semester must be a dict.
        - If present, "year" must be an integer.
        - If present, "semester" must be one of: "spring", "summer", "fall".
        """
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("curriculum must be a list of colleges")
        for college in value:
            if not isinstance(college, dict):
                raise serializers.ValidationError("college entries must be objects")
            if "majors" not in college or not isinstance(college.get("majors"), list):
                raise serializers.ValidationError("college.majors must be a list")
            for major in college["majors"]:
                if not isinstance(major, dict):
                    raise serializers.ValidationError("major must be an object")
                if "semesters" not in major or not isinstance(major.get("semesters"), list):
                    raise serializers.ValidationError("major.semesters must be a list")
                for sem in major["semesters"]:
                    if not isinstance(sem, dict):
                        raise serializers.ValidationError("semester must be an object")
                    if "year" in sem and not isinstance(sem["year"], int):
                        raise serializers.ValidationError("semester.year must be integer")
                    if "semester" in sem and sem["semester"] not in ("spring", "summer", "fall"):
                        raise serializers.ValidationError("semester.semester must be one of: spring, summer, fall")
        return value


class CourseReviewSerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend CourseReview type (camelCase)."""

    subjectId = serializers.CharField(source="course.subject_id", read_only=True)
    author = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()
    overallRating = serializers.FloatField(source="overall_rating")
    likesCount = serializers.IntegerField(source="likes_count", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    term = serializers.SerializerMethodField()
    repliesCount = serializers.IntegerField(source="replies_count", read_only=True)
    isLiked = serializers.SerializerMethodField()

    isAnonymous = serializers.BooleanField(source="is_anonymous", required=False, write_only=True)
    onlyText = serializers.BooleanField(source="only_text", required=False, write_only=True)

    class Meta:
        model = CourseReview
        fields = [
            "id",
            "subjectId",
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
        ]
        read_only_fields = ["id", "subjectId", "likesCount", "createdAt", "updatedAt", "repliesCount"]

    def get_author(self, obj: CourseReview) -> dict:
        # Respect anonymous reviews: hide identity from others
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if getattr(obj, "is_anonymous", False) and (not user or user != obj.author):
            return {"id": "", "name": "Anonymous", "avatarUrl": None}
        return _author_payload_for(obj.author)

    def get_attributes(self, obj: CourseReview) -> dict:
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
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return CourseReviewLike.objects.filter(review=obj, user=user).exists()


class CourseReviewReplySerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend CourseReviewReply type (camelCase)."""

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
        return _author_payload_for(obj.author)

    def get_replyToUser(self, obj: CourseReviewReply):
        if obj.reply_to_user_id:
            return _author_payload_for(obj.reply_to_user)  # type: ignore[arg-type]
        return None

    def get_isLiked(self, obj: CourseReviewReply) -> bool:
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return CourseReviewReplyLike.objects.filter(reply=obj, user=user).exists()
