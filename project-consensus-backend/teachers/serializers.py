from __future__ import annotations

from rest_framework import serializers

from .models import Teacher


class TeacherSerializer(serializers.ModelSerializer):
    """Serializer mapping to frontend Teacher type (camelCase)."""

    # Coalesce empty string to None for consistent frontend handling
    avatarUrl = serializers.SerializerMethodField()
    officeHours = serializers.CharField(source="office_hours", required=False, allow_blank=True)
    homepageUrl = serializers.URLField(source="homepage_url", required=False, allow_null=True)
    yearsExperience = serializers.IntegerField(source="years_experience", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    rating = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id",
            "name",
            "title",
            "department",
            "avatarUrl",
            "email",
            "office",
            "officeHours",
            "homepageUrl",
            "bio",
            "tags",
            "languages",
            "yearsExperience",
            "rating",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = ["id", "createdAt", "updatedAt", "rating"]

    def get_rating(self, obj: Teacher):
        return {
            "overall": obj.rating_overall,
            "difficulty": obj.rating_difficulty,
            "friendliness": obj.rating_friendliness,
            "clarity": obj.rating_clarity,
            "grading": obj.rating_grading or None,
            "reviewsCount": obj.rating_reviews_count,
        }

    def get_avatarUrl(self, obj: Teacher):
        """
        Return avatar URL if available, otherwise return initials for default avatar.
        
        Frontend can check if the value is a URL or initials:
        - URL: starts with "http://" or "https://"
        - Initials: uppercase letters generated from the first letter of each name part
          (typically 1-3 characters for most names, e.g., "JS" for "John Smith")
        
        """
        if obj.avatar_url:
            return obj.avatar_url
        return obj.initials


class TeacherCourseRefSerializer(serializers.Serializer):
    """Lightweight course reference taught by a teacher, for /teachers/{id}/courses/ endpoint."""

    courseId = serializers.CharField()
    subjectCode = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField(required=False, allow_blank=True)

