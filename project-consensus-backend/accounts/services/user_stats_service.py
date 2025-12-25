from __future__ import annotations

from django.db.models import F, Case, When, Value, IntegerField

from accounts.models import Profile


def _ensure_profile(user_id: int) -> None:
    """Ensure a profile exists for the given user id."""
    Profile.objects.get_or_create(user_id=user_id)


def _increment_field(user_id: int, field_name: str, delta: int) -> None:
    if delta <= 0:
        return
    _ensure_profile(user_id)
    Profile.objects.filter(user_id=user_id).update(
        **{field_name: F(field_name) + delta}
    )


def _decrement_field(user_id: int, field_name: str, delta: int) -> None:
    if delta <= 0:
        return
    _ensure_profile(user_id)
    Profile.objects.filter(user_id=user_id).update(
        **{
            field_name: Case(
                When(**{f"{field_name}__gte": delta}, then=F(field_name) - delta),
                default=Value(0),
                output_field=IntegerField(),
            )
        }
    )


def increment_forum_posts_count(*, user_id: int, delta: int = 1) -> None:
    """Increment forum posts count for a user."""
    _increment_field(user_id=user_id, field_name="forum_posts_count", delta=delta)


def decrement_forum_posts_count(*, user_id: int, delta: int = 1) -> None:
    """Decrement forum posts count for a user."""
    _decrement_field(user_id=user_id, field_name="forum_posts_count", delta=delta)


def increment_forum_post_comments_count(*, user_id: int, delta: int = 1) -> None:
    """Increment forum post comments count for a user."""
    _increment_field(user_id=user_id, field_name="forum_post_comments_count", delta=delta)


def decrement_forum_post_comments_count(*, user_id: int, delta: int = 1) -> None:
    """Decrement forum post comments count for a user."""
    _decrement_field(user_id=user_id, field_name="forum_post_comments_count", delta=delta)


def increment_course_reviews_count(*, user_id: int, delta: int = 1) -> None:
    """Increment course reviews count for a user."""
    _increment_field(user_id=user_id, field_name="course_reviews_count", delta=delta)


def decrement_course_reviews_count(*, user_id: int, delta: int = 1) -> None:
    """Decrement course reviews count for a user."""
    _decrement_field(user_id=user_id, field_name="course_reviews_count", delta=delta)


