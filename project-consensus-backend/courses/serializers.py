from __future__ import annotations

from django.contrib.auth import get_user_model
import bleach
from rest_framework import serializers

from accounts.models import Profile
from .models import Course, CourseReview, CourseReviewReply, CourseReviewLike, CourseReviewReplyLike, CourseVote


User = get_user_model()


# Strict allowlist: align with frontend DOMPurify settings
ALLOWED_TAGS = [
    'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
]
ALLOWED_ATTRS: dict[str, list[str]] = {
    # Table attributes for cell merging and alignment
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align'],
    # Code syntax highlighting
    'code': ['class'],
    'pre': ['class'],
    # Ordered list starting number
    'ol': ['start'],
}

def _sanitize_html(html: str) -> str:
    if not isinstance(html, str):
        return ""
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)


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
    # Per-user vote state (read-only): 'recommend' | 'notRecommend' | None
    userVote = serializers.SerializerMethodField()
    # Whether current user has posted a review for this course
    userHasReview = serializers.SerializerMethodField()

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
            "userVote",
            "userHasReview",
        ]
        read_only_fields = ["lastUpdated"]

    def __init__(self, *args, **kwargs):  # type: ignore[override]
        super().__init__(*args, **kwargs)
        # Only include userVote/userHasReview/otherTeacherCourses in detail responses when explicitly requested
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

    def get_userVote(self, obj: Course):
        request = getattr(self, "context", {}).get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return None
        # Prefer annotated value to avoid N+1 in lists
        annotated = getattr(obj, "_user_vote", None)
        if annotated:
            return annotated
        # Fallback single lookup (detail view)
        vote = (
            CourseVote.objects
            .filter(user=user, course=obj)
            .values_list("value", flat=True)
            .first()
        )
        return vote or None

    def get_userHasReview(self, obj: Course) -> bool:
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        # Prefer annotated value to avoid extra query
        annotated = getattr(obj, "_user_has_review", None)
        if annotated is not None:
            return bool(annotated)
        # Fallback for cases where annotation is not available
        return CourseReview.objects.filter(course=obj, author=user).exists()


class CourseReviewSerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend CourseReview type (camelCase).
    
    Security note: HTML content is sanitized on both write (create/update) and read (to_representation)
    to provide defense-in-depth against XSS attacks.
    """

    subjectId = serializers.CharField(source="course.subject_id", read_only=True)
    author = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()
    # Not required when onlyText=true; range validated in validate()
    overallRating = serializers.FloatField(source="overall_rating", required=False)
    likesCount = serializers.IntegerField(source="likes_count", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    term = serializers.SerializerMethodField()
    repliesCount = serializers.IntegerField(source="replies_count", read_only=True)
    isLiked = serializers.SerializerMethodField()

    isAnonymous = serializers.BooleanField(source="is_anonymous", required=False)
    onlyText = serializers.BooleanField(source="only_text", required=False)

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
    
    def to_representation(self, instance):
        """Override to_representation to sanitize HTML content on output.
        
        This provides defense-in-depth: even if unsanitized content exists in the database
        (e.g., from data migration or manual database edits), it will be sanitized when read.
        """
        data = super().to_representation(instance)
        # Sanitize content field on output for security
        if 'content' in data and data['content']:
            data['content'] = _sanitize_html(data['content'])
        return data

    def get_author(self, obj: CourseReview) -> dict:
        # Respect anonymous reviews: hide identity from others
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if getattr(obj, "is_anonymous", False) and (not user or user != obj.author):
            return {"id": "", "name": "Anonymous", "avatarUrl": None}
        return _author_payload_for(obj.author)

    def get_attributes(self, obj: CourseReview) -> dict | None:
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
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        # Prefer annotated flag to avoid per-object queries
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        return CourseReviewLike.objects.filter(review=obj, user=user).exists()

    # --- Write helpers for create/update ---
    def _extract_attributes(self) -> dict:
        data = getattr(self, "initial_data", {}) or {}
        attrs = data.get("attributes")
        if attrs in (None, ""):
            return {}
        if not isinstance(attrs, dict):
            raise serializers.ValidationError({"attributes": "must be an object with difficulty/workload/grading/gain"})
        out: dict = {}
        for key in ("difficulty", "workload", "grading", "gain"):
            if key in attrs:
                val = attrs[key]
                if not isinstance(val, str):
                    raise serializers.ValidationError({"attributes": f"{key} must be a string"})
                out[key] = val
        return out

    def _extract_term(self) -> dict:
        data = getattr(self, "initial_data", {}) or {}
        term = data.get("term")
        if term in (None, ""):
            return {}
        if not isinstance(term, dict):
            raise serializers.ValidationError({"term": "must be an object with year and semester"})
        out: dict = {}
        if "year" in term:
            if not isinstance(term["year"], int):
                raise serializers.ValidationError({"term": "year must be integer"})
            out["year"] = term["year"]
        if "semester" in term:
            if term["semester"] not in ("spring", "summer", "fall"):
                raise serializers.ValidationError({"term": "semester must be one of: spring, summer, fall"})
            out["semester"] = term["semester"]
        return out

    def validate(self, attrs):  # type: ignore[override]
        # Enforce required fields when only_text == False
        data = getattr(self, "initial_data", {}) or {}
        instance = getattr(self, "instance", None)
        is_create = instance is None
        only_text = attrs.get("only_text")
        if only_text is None:
            # If not explicitly provided, fallback to current instance or default False
            only_text = getattr(instance, "only_text", False)

        if not only_text:
            # overallRating: required on create; optional on partial update but validate if provided
            value = attrs.get("overall_rating")
            if value is None and "overallRating" in data:
                try:
                    value = float(data.get("overallRating"))
                except Exception:
                    raise serializers.ValidationError({"overallRating": "must be a number"})
            if is_create and value is None and not getattr(instance, "overall_rating", None):
                raise serializers.ValidationError({"overallRating": "required when onlyText is false"})
            if value is not None:
                try:
                    fv = float(value)
                except Exception:
                    raise serializers.ValidationError({"overallRating": "must be a number"})
                if fv < 0 or fv > 10:
                    raise serializers.ValidationError({"overallRating": "must be between 0 and 10"})
                # ensure normalized back into attrs for create/update
                attrs["overall_rating"] = fv
            # attributes: required on create; optional on partial update but validate shape if provided
            attrs_dict = data.get("attributes")
            if is_create:
                if not isinstance(attrs_dict, dict):
                    raise serializers.ValidationError({"attributes": "required when onlyText is false"})
                for k in ("difficulty", "workload", "grading", "gain"):
                    if k not in attrs_dict or not isinstance(attrs_dict[k], str):
                        raise serializers.ValidationError({"attributes": f"{k} is required when onlyText is false"})
            elif isinstance(attrs_dict, dict):
                # If provided in update, check keys are strings
                for k in ("difficulty", "workload", "grading", "gain"):
                    if k in attrs_dict and not isinstance(attrs_dict[k], str):
                        raise serializers.ValidationError({"attributes": f"{k} must be a string"})

        # Sanitize content (always sanitize if provided)
        if "content" in attrs:
            raw = attrs.get("content")
            attrs["content"] = _sanitize_html(raw)
        return attrs

    def create(self, validated_data):  # type: ignore[override]
        # Expect course and author passed in .save(course=..., author=...)
        course = validated_data.pop("course", None)
        author = validated_data.pop("author", None)
        if course is None or author is None:
            raise serializers.ValidationError("course and author must be provided")

        only_text = validated_data.get("only_text", False)
        
        # Only extract and save attributes/rating when not onlyText
        if not only_text:
            attrs = self._extract_attributes()
            term = self._extract_term()

            # Map to model fields
            if "difficulty" in attrs:
                validated_data["attr_difficulty"] = attrs["difficulty"]
            if "workload" in attrs:
                validated_data["attr_workload"] = attrs["workload"]
            if "grading" in attrs:
                validated_data["attr_grading"] = attrs["grading"]
            if "gain" in attrs:
                validated_data["attr_gain"] = attrs["gain"]
            if "year" in term:
                validated_data["term_year"] = term["year"]
            if "semester" in term:
                validated_data["term_semester"] = term["semester"]
        else:
            # For text-only reviews, explicitly set overall_rating to 0
            validated_data["overall_rating"] = 0

        # Sanitize HTML content
        if "content" in validated_data:
            validated_data["content"] = _sanitize_html(validated_data.get("content", ""))

        instance = CourseReview.objects.create(course=course, author=author, **validated_data)
        return instance

    def update(self, instance: CourseReview, validated_data):  # type: ignore[override]
        # Check if transitioning to/from onlyText mode
        only_text = validated_data.get("only_text", instance.only_text)
        
        # Only update attributes/rating when not onlyText
        if not only_text:
            attrs = self._extract_attributes()
            term = self._extract_term()
            for field, key in (
                ("attr_difficulty", "difficulty"),
                ("attr_workload", "workload"),
                ("attr_grading", "grading"),
                ("attr_gain", "gain"),
            ):
                if key in attrs:
                    setattr(instance, field, attrs[key])
            if "year" in term:
                instance.term_year = term["year"]
            if "semester" in term:
                instance.term_semester = term["semester"]
        else:
            # For text-only reviews, set overall_rating to 0
            if "only_text" in validated_data and validated_data["only_text"]:
                instance.overall_rating = 0
        
        # Apply other scalar fields from validated_data
        for key in ("overall_rating", "content", "is_anonymous", "only_text"):
            if key in validated_data:
                val = validated_data[key]
                if key == "content":
                    val = _sanitize_html(val)
                # Only update overall_rating if not in onlyText mode
                if key == "overall_rating" and only_text:
                    continue
                setattr(instance, key, val)
        instance.save()
        return instance


class CourseReviewReplySerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend CourseReviewReply type (camelCase).
    
    Security note: HTML content is sanitized on both write (create/update) and read (to_representation)
    to provide defense-in-depth against XSS attacks.
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
    
    def to_representation(self, instance):
        """Override to_representation to sanitize HTML content on output.
        
        This provides defense-in-depth: even if unsanitized content exists in the database
        (e.g., from data migration or manual database edits), it will be sanitized when read.
        """
        data = super().to_representation(instance)
        # Sanitize content field on output for security
        if 'content' in data and data['content']:
            data['content'] = _sanitize_html(data['content'])
        return data

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
        # Prefer annotated flag to avoid per-object queries
        annotated = getattr(obj, "is_liked", None)
        if annotated is not None:
            return bool(annotated)
        return CourseReviewReplyLike.objects.filter(reply=obj, user=user).exists()

    # --- Write hooks ---
    def create(self, validated_data):  # type: ignore[override]
        # Prefer explicit args via .save(review=..., author=..., reply_to_user=...)
        review = validated_data.pop("review", None)
        author = validated_data.pop("author", None)
        reply_to_user = validated_data.pop("reply_to_user", None)
        if review is None:
            # Try resolve from payload for fallback
            data = getattr(self, "initial_data", {}) or {}
            review_id = data.get("reviewId") or data.get("review")
            if review_id:
                from .models import CourseReview  # local import to avoid cycle
                try:
                    review = CourseReview.objects.get(pk=review_id)
                except CourseReview.DoesNotExist:  # pragma: no cover
                    raise serializers.ValidationError({"reviewId": "invalid review id"})
        if author is None and hasattr(self, "context"):
            req = self.context.get("request")
            if getattr(req, "user", None) and req.user.is_authenticated:  # type: ignore[attr-defined]
                author = req.user
        if review is None or author is None:
            raise serializers.ValidationError("review and author must be provided")

        # Sanitize content
        if "content" in validated_data:
            validated_data["content"] = _sanitize_html(validated_data.get("content", ""))

        instance = CourseReviewReply.objects.create(review=review, author=author, reply_to_user=reply_to_user, **validated_data)
        return instance

    def update(self, instance: CourseReviewReply, validated_data):  # type: ignore[override]
        if "content" in validated_data:
            instance.content = _sanitize_html(validated_data.get("content", ""))
        instance.save(update_fields=["content"])
        return instance
