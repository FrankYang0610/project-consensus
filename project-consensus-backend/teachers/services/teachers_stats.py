from __future__ import annotations

from django.core.cache import cache

from teachers.models import Teacher


STATS_CACHE_TIMEOUT_SECONDS = 60

TEACHER_STATS_CACHE_KEY = "teachers:stats:teachers"


def get_teacher_stats() -> dict[str, int]:
    """
    Return cached site-wide teacher stats.

    Uses a 1-minute cache to avoid frequent COUNT(*) queries on the `Teacher` table.
    """
    cached = cache.get(TEACHER_STATS_CACHE_KEY)
    if cached is not None:
        return cached

    stats = {
        "teachers": Teacher.objects.count(),
    }
    cache.set(TEACHER_STATS_CACHE_KEY, stats, STATS_CACHE_TIMEOUT_SECONDS)
    return stats


