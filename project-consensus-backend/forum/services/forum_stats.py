from __future__ import annotations

from django.core.cache import cache

from forum.models import ForumPost


STATS_CACHE_TIMEOUT_SECONDS = 60

FORUM_POST_STATS_CACHE_KEY = "forum:stats:posts"


def get_forum_post_stats() -> dict[str, int]:
    """
    Return cached site-wide forum post stats.

    Uses a 1-minute cache to avoid frequent COUNT(*) queries on the `ForumPost` table.
    """
    cached = cache.get(FORUM_POST_STATS_CACHE_KEY)
    if cached is not None:
        return cached

    stats = {
        "forumPosts": ForumPost.objects.count(),
    }
    cache.set(FORUM_POST_STATS_CACHE_KEY, stats, STATS_CACHE_TIMEOUT_SECONDS)
    return stats


