from __future__ import annotations

from typing import Any

from ..models import Course


def get_other_teacher_courses_for_course(course: Course) -> list[dict[str, Any]]:
    """
    Compute "other teacher courses" for a given course.

    - Same ``subject_code`` as the given course
    - Different ``course_id``
    - Ordered by rating score, reviews count, and last updated
    - Prefetches ``teachers`` to avoid N+1 queries
    - For each related course, chooses a teacher who is not already
      teaching the current course when possible.
    """
    # Use the already-prefetched teachers on the current course when available
    # to avoid an extra database hit. If not prefetched, this will be a single
    # additional query, not an N+1.
    current_teacher_ids = {t.id for t in course.teachers.all()}

    others_qs = (
        Course.objects.filter(subject_code=course.subject_code)
        .exclude(course_id=course.course_id)
        .order_by("-rating_score", "-rating_reviews_count", "-last_updated")
        .prefetch_related("teachers")
    )

    other_teacher_courses: list[dict[str, Any]] = []

    for c in others_qs:
        teachers = list(c.teachers.all())
        chosen = None
        co_teachers: list[dict[str, Any]] = []
        if teachers:
            # Prefer a teacher who is not already teaching the current course.
            for t in teachers:
                if t.id not in current_teacher_ids:
                    chosen = t
                    break
            # Fallback: if all teachers overlap, just take the first one.
            if chosen is None:
                chosen = teachers[0]

            teacher_name = chosen.name
            teacher_avatar = chosen.avatar_url or None

            # Collect co-teachers (other teachers of this course, excluding the chosen one)
            for t in teachers:
                if t.id != chosen.id:
                    co_teachers.append({"id": str(t.id), "name": t.name})
        else:
            teacher_name = ""
            teacher_avatar = None

        other_teacher_courses.append(
            {
                "courseId": str(c.course_id),
                "teacherName": teacher_name,
                "teacherAvatarUrl": teacher_avatar,
                "coTeachers": co_teachers,
                "rating": {
                    "score": c.rating_score,
                    "reviewsCount": c.rating_reviews_count,
                },
                "attributes": {
                    "difficulty": c.attr_difficulty or None,
                    "workload": c.attr_workload or None,
                    "grading": c.attr_grading or None,
                    "gain": c.attr_gain or None,
                },
            }
        )

    return other_teacher_courses

