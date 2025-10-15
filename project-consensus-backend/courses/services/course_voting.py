from __future__ import annotations

from django.db import transaction
from django.db.models import F

from ..models import Course, CourseVote


def _fetch_counts(course: Course) -> tuple[int, int]:
    # Single-row fetch without refreshing the in-memory instance
    rec, not_rec = (
        Course.objects
        .filter(pk=course.pk)
        .values_list("rating_recommend_count", "rating_not_recommend_count")
        .first() or (0, 0)
    )
    return int(rec), int(not_rec)


def toggle_course_vote(*, user, course: Course, vote_type: str) -> dict:
    """Toggle or switch a user's vote on a course.

    Behavior:
    - If user has no vote: create new vote with value; increment corresponding counter.
    - If user voted same value: remove vote (toggle off); decrement corresponding counter.
    - If user voted different value: switch; decrement old counter and increment new counter.

    Returns dict: { 'user_vote': 'recommend' | 'notRecommend' | None,
                    'recommend_count': int,
                    'not_recommend_count': int }
    """
    with transaction.atomic():
        existing = (
            CourseVote.objects.select_for_update()
            .filter(user=user, course=course)
            .first()
        )

        user_vote: str | None

        if existing is None:
            CourseVote.objects.create(user=user, course=course, value=vote_type)
            if vote_type == CourseVote.Value.RECOMMEND:
                Course.objects.filter(pk=course.pk).update(
                    rating_recommend_count=F("rating_recommend_count") + 1
                )
            else:
                Course.objects.filter(pk=course.pk).update(
                    rating_not_recommend_count=F("rating_not_recommend_count") + 1
                )
            user_vote = vote_type
        elif existing.value == vote_type:
            old = existing.value
            existing.delete()
            if old == CourseVote.Value.RECOMMEND:
                Course.objects.filter(pk=course.pk, rating_recommend_count__gt=0).update(
                    rating_recommend_count=F("rating_recommend_count") - 1
                )
            else:
                Course.objects.filter(pk=course.pk, rating_not_recommend_count__gt=0).update(
                    rating_not_recommend_count=F("rating_not_recommend_count") - 1
                )
            user_vote = None
        else:
            # Switch vote
            old = existing.value
            existing.value = vote_type
            existing.save(update_fields=["value"])
            if old == CourseVote.Value.RECOMMEND:
                Course.objects.filter(pk=course.pk, rating_recommend_count__gt=0).update(
                    rating_recommend_count=F("rating_recommend_count") - 1
                )
            else:
                Course.objects.filter(pk=course.pk, rating_not_recommend_count__gt=0).update(
                    rating_not_recommend_count=F("rating_not_recommend_count") - 1
                )
            if vote_type == CourseVote.Value.RECOMMEND:
                Course.objects.filter(pk=course.pk).update(
                    rating_recommend_count=F("rating_recommend_count") + 1
                )
            else:
                Course.objects.filter(pk=course.pk).update(
                    rating_not_recommend_count=F("rating_not_recommend_count") + 1
                )
            user_vote = vote_type

        recommend_count, not_recommend_count = _fetch_counts(course)
        return {
            "user_vote": user_vote,
            "recommend_count": recommend_count,
            "not_recommend_count": not_recommend_count,
        }

