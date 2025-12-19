from __future__ import annotations

from django.core.cache import cache

from courses.models import Course


STATS_CACHE_TIMEOUT_SECONDS = 60

COURSE_STATS_CACHE_KEY = "courses:stats:courses"


def get_course_stats() -> dict[str, int]:
    """
    Return cached site-wide course stats.

    Uses a 1-minute cache to avoid frequent COUNT(*) queries on the `Course` table.
    """
    cached = cache.get(COURSE_STATS_CACHE_KEY)
    if cached is not None:
        return cached

    stats = {
        "courses": Course.objects.count(),
    }
    cache.set(COURSE_STATS_CACHE_KEY, stats, STATS_CACHE_TIMEOUT_SECONDS)
    return stats


