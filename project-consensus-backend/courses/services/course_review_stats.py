from __future__ import annotations

from django.core.cache import cache

from courses.models import CourseReview


STATS_CACHE_TIMEOUT_SECONDS = 60

COURSE_REVIEW_STATS_CACHE_KEY = "courses:stats:course_reviews"


def get_course_review_stats() -> dict[str, int]:
    """
    Return cached site-wide course review stats.

    Uses a 1-minute cache to avoid frequent COUNT(*) queries on the `CourseReview` table.
    """
    cached = cache.get(COURSE_REVIEW_STATS_CACHE_KEY)
    if cached is not None:
        return cached

    stats = {
        "courseReviews": CourseReview.objects.count(),
    }
    cache.set(COURSE_REVIEW_STATS_CACHE_KEY, stats, STATS_CACHE_TIMEOUT_SECONDS)
    return stats


