"""Utility functions for teacher-related operations."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import Teacher


def recompute_teacher_aggregates(teacher: Teacher) -> None:
    """Recompute and update teacher's rating metrics from all course reviews.
    
    Logic:
    - Collects all CourseReview objects for courses taught by this teacher
    - Only includes reviews with only_text=False (reviews with actual ratings)
    - Computes average overall_rating and total review count
    - Updates teacher's rating_overall and rating_reviews_count
    - Preserves 1 decimal place for consistency with course ratings
    
    Args:
        teacher: Teacher instance to update
    """
    # Lazy import to avoid circular dependency at module level
    from courses.models import CourseReview
    from django.db.models import Avg, Count
    
    # Find all courses taught by this teacher, then get all reviews for those courses
    # Only count reviews with ratings (only_text=False)
    qs = CourseReview.objects.filter(
        course__teachers=teacher,
        only_text=False
    )
    
    agg = qs.aggregate(
        avg=Avg("overall_rating"),
        cnt=Count("id")
    )
    
    count = int(agg.get("cnt") or 0)
    avg = float(agg.get("avg") or 0.0)
    
    # Keep one decimal place as agreed (consistent with course rating)
    score = round(avg, 1) if count > 0 else None
    
    # Update teacher record atomically
    from .models import Teacher
    Teacher.objects.filter(pk=teacher.pk).update(
        rating_overall=score,
        rating_reviews_count=count,
    )

