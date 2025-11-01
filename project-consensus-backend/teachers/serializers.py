from __future__ import annotations

from rest_framework import serializers

from .models import Teacher


class TeacherSerializer(serializers.ModelSerializer):
    """Serializer mapping to frontend Teacher type (camelCase)."""

    # Coalesce empty string to None for consistent frontend handling
    avatarUrl = serializers.SerializerMethodField()
    officeHours = serializers.CharField(source="office_hours", required=False, allow_blank=True, read_only=True)
    websiteName = serializers.CharField(source="website_name", required=False, allow_blank=True, read_only=True)
    websiteUrl = serializers.URLField(source="website_url", required=False, allow_null=True, read_only=True)
    profileUrl = serializers.URLField(source="profile_url", required=False, allow_null=True, read_only=True)
    scholarsHubUrl = serializers.URLField(source="scholars_hub_url", required=False, allow_null=True, read_only=True)
    biography = serializers.CharField(required=False, allow_blank=True, read_only=True)
    researchInterests = serializers.CharField(source="research_interests", required=False, allow_blank=True, read_only=True)
    academicAndProfessionalExperience = serializers.CharField(source="academic_and_professional_experience", required=False, allow_blank=True, read_only=True)
    professionalQualifications = serializers.CharField(source="professional_qualifications", required=False, allow_blank=True, read_only=True)
    yearsExperience = serializers.IntegerField(source="years_experience", required=False, allow_null=True, read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    rating = serializers.SerializerMethodField()
    orcid = serializers.SerializerMethodField()
    scopus = serializers.SerializerMethodField()
    researchId = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id",
            "name",
            "title",
            "department",
            "avatarUrl",
            "email",
            "phone",
            "office",
            "officeHours",
            "websiteName",
            "websiteUrl",
            "profileUrl",
            "scholarsHubUrl",
            "biography",
            "researchInterests",
            "academicAndProfessionalExperience",
            "professionalQualifications",
            "tags",
            "languages",
            "yearsExperience",
            "orcid",
            "scopus",
            "researchId",
            "rating",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = [
            "id",
            "createdAt",
            "updatedAt",
            # Computed/derived fields
            "avatarUrl",
            "rating",
            "orcid",
            "scopus",
            "researchId",
            # Source fields we do not allow writing via this API
            "name",
            "title",
            "department",
            "email",
            "phone",
            "office",
            "officeHours",
            "websiteName",
            "websiteUrl",
            "profileUrl",
            "scholarsHubUrl",
            "biography",
            "researchInterests",
            "academicAndProfessionalExperience",
            "professionalQualifications",
            "tags",
            "languages",
            "yearsExperience",
        ]

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

    def _id_url_pair(self, id_value: str | None, url_value: str | None):
        id_clean = (id_value or "").strip()
        url_clean = (url_value or "").strip()
        if not id_clean and not url_clean:
            return None
        return {"id": id_clean or None, "url": url_clean or None}

    def get_orcid(self, obj: Teacher):
        return self._id_url_pair(obj.orcid_id, obj.orcid_url)

    def get_scopus(self, obj: Teacher):
        return self._id_url_pair(obj.scopus_id, obj.scopus_url)

    def get_researchId(self, obj: Teacher):
        return self._id_url_pair(obj.researcherid_id, obj.researcherid_url)


class TeacherCourseRefSerializer(serializers.Serializer):
    """Lightweight course reference taught by a teacher, for /teachers/{id}/courses/ endpoint."""

    courseId = serializers.CharField()
    subjectCode = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField(required=False, allow_blank=True)

