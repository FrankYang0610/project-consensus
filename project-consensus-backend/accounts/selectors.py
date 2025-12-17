from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Count, QuerySet


User = get_user_model()


def annotate_user_stats(queryset: QuerySet[User]) -> QuerySet[User]:
    """
    Annotate a User queryset with per-user activity statistics.

    Adds the following fields (used by serializers and views):
    - posts_count: number of forum posts
    - comments_count: number of forum comments
    - reviews_count: number of course reviews
    """
    return queryset.select_related("profile").annotate(
        posts_count=Count("forum_posts", distinct=True),
        comments_count=Count("forum_comments", distinct=True),
        reviews_count=Count("course_reviews", distinct=True),
    )


def get_user_with_stats(user_id: int | str) -> User | None:
    """
    Fetch a single user with related profile and annotated statistics.

    Returns:
        User instance with extra annotation fields, or None if not found.
    """
    return annotate_user_stats(User.objects.filter(pk=user_id)).first()

