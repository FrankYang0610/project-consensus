from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Profile
from accounts.serializers import AuthorSerializer
from .models import Course, CourseReview, CourseReviewReply


User = get_user_model()


def _author_payload_for(user: User) -> dict:
    """Build an Author dict from Profile or fallback to username."""
    try:
        return user.profile.author_payload  # type: ignore[attr-defined]
    except Profile.DoesNotExist:  # pragma: no cover
        return {"id": str(user.pk), "name": user.get_username(), "avatar": None}


class CourseSerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend Course type structure."""

    term = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "subject_id",
            "subject_code",
            "title",
            "term",
            "rating",
            "attributes",
            "teachers",
            "department",
            "last_updated",
        ]
        read_only_fields = ["id", "last_updated"]

    def get_term(self, obj: Course):
        return {"year": obj.term_year, "semester": obj.term_semester}

    def get_rating(self, obj: Course):
        return {"score": obj.rating_score, "reviewsCount": obj.rating_reviews_count}

    def get_attributes(self, obj: Course):
        return {
            "difficulty": obj.attr_difficulty,
            "workload": obj.attr_workload,
            "grading": obj.attr_grading,
            "gain": obj.attr_gain,
        }


class CourseReviewSerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend CourseReview type."""

    author = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()
    overallRating = serializers.FloatField(source="overall_rating")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = CourseReview
        fields = [
            "id",
            "course",
            "author",
            "overallRating",
            "attributes",
            "content",
            "likes_count",
            "createdAt",
            "updatedAt",
            "term_year",
            "term_semester",
            "replies_count",
        ]
        read_only_fields = ["id", "createdAt", "updatedAt"]

    def get_author(self, obj: CourseReview) -> dict:
        return _author_payload_for(obj.author)

    def get_attributes(self, obj: CourseReview) -> dict:
        return {
            "difficulty": obj.attr_difficulty,
            "workload": obj.attr_workload,
            "grading": obj.attr_grading,
            "gain": obj.attr_gain,
        }


class CourseReviewReplySerializer(serializers.ModelSerializer):
    """Serializer aligning with the frontend CourseReviewReply type."""

    author = serializers.SerializerMethodField()
    replyToUser = serializers.SerializerMethodField()

    class Meta:
        model = CourseReviewReply
        fields = [
            "id",
            "review",
            "author",
            "content",
            "created_at",
            "likes_count",
            "replyToUser",
            "is_deleted",
        ]
        read_only_fields = ["id", "created_at"]

    def get_author(self, obj: CourseReviewReply) -> dict:
        return _author_payload_for(obj.author)

    def get_replyToUser(self, obj: CourseReviewReply):
        if obj.reply_to_user_id:
            return _author_payload_for(obj.reply_to_user)  # type: ignore[arg-type]
        return None
