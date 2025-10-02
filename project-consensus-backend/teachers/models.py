from __future__ import annotations

import uuid
from django.db import models


class Teacher(models.Model):
    """Teacher entity aligned with frontend Teacher type.

    Fields mirror the frontend expectations where reasonable.
    Rating metrics are stored as flattened fields for simplicity.
    """

    class Grading(models.TextChoices):
        LENIENT = "lenient", "lenient"
        BALANCED = "balanced", "balanced"
        STRICT = "strict", "strict"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, db_index=True)
    title = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=200, blank=True)

    avatar_url = models.URLField(blank=True)
    email = models.EmailField(blank=True)
    office = models.CharField(max_length=200, blank=True)
    office_hours = models.CharField(max_length=200, blank=True)
    homepage_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)

    tags = models.JSONField(default=list, blank=True, help_text="List of tags/areas of expertise")
    languages = models.JSONField(default=list, blank=True, help_text="List of teaching languages")
    years_experience = models.PositiveIntegerField(null=True, blank=True)

    # Rating metrics
    rating_overall = models.FloatField(null=True, blank=True, help_text="Overall rating 0.0-10.0, null if no reviews")
    rating_difficulty = models.FloatField(null=True, blank=True, help_text="Difficulty rating 0.0-10.0")
    rating_friendliness = models.FloatField(null=True, blank=True, help_text="Friendliness rating 0.0-10.0")
    rating_clarity = models.FloatField(null=True, blank=True, help_text="Clarity rating 0.0-10.0")
    rating_grading = models.CharField(max_length=10, choices=Grading.choices, blank=True)
    rating_reviews_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["department"]),
        ]
        verbose_name = "Teacher"
        verbose_name_plural = "Teachers"

    def __str__(self) -> str:  # pragma: no cover
        return self.name

