from __future__ import annotations

from django.db.models import Q, QuerySet


class CourseFilter:
    """Encapsulate parsing/validation of course list query params and apply to queryset."""

    def __init__(self, params):
        self.params = params

    def _collect_multi(self, key: str) -> list[str]:
        values = list(self.params.getlist(key))
        flat: list[str] = []
        for v in values:
            if v is None:
                continue
            s = str(v).strip()
            if not s:
                continue
            if "," in s:
                flat.extend([x.strip() for x in s.split(",") if x.strip()])
            else:
                flat.append(s)
        return flat

    def apply(self, qs: QuerySet) -> QuerySet:
        # Basic filters aligned with frontend CourseFilterBar
        subject_code = self.params.get("subjectCode")
        if subject_code:
            qs = qs.filter(subject_code=subject_code)

        teacher_id = self.params.get("teacherId")
        if teacher_id:
            qs = qs.filter(teachers__id=teacher_id).distinct()

        # selection_category support removed

        course_categories = self._collect_multi("courseCategory") or self._collect_multi("categories")
        if course_categories:
            qs = qs.filter(course_category__in=course_categories)

        teaching_types = self._collect_multi("teachingType")
        if teaching_types:
            qs = qs.filter(teaching_type__in=teaching_types)

        departments = self._collect_multi("departments")
        if departments:
            MAX_DEPARTMENTS = 20
            MAX_DEPT_LENGTH = 200
            departments = [
                d[:MAX_DEPT_LENGTH]
                for d in departments[:MAX_DEPARTMENTS]
                if d and len(d.strip()) > 0
            ]
            if departments:
                q = Q()
                for d in departments:
                    q |= Q(department__iexact=d)
                qs = qs.filter(q)

        # level IN ('1'..'6'); accept repeated level= and comma-separated levels=
        levels = self._collect_multi("level") or self._collect_multi("levels")
        if levels:
            norm_levels = []
            for lv in levels:
                s = str(lv).strip()
                if s.isdigit():
                    s = str(int(s))  # remove leading zeros
                if s in {"1", "2", "3", "4", "5", "6"}:
                    norm_levels.append(s)
            if norm_levels:
                qs = qs.filter(level__in=norm_levels)

        return qs


class CourseReviewFilter:
    """Encapsulate parsing/validation of course review list query params.
    
    Supported params:
    - courseId: UUID of course
    - mine: truthy to filter current user's reviews
    - minRating|maxRating: numeric range filters
    - termYear, termSemester: term filters
    """

    def __init__(self, params, user=None):
        self.params = params
        self.user = user

    def _get(self, key: str):
        return self.params.get(key)

    def apply(self, qs: QuerySet) -> QuerySet:
        course_uuid = self._get("courseId")
        if course_uuid:
            qs = qs.filter(course__course_id=course_uuid)

        mine = self._get("mine")
        if mine and self.user is not None and self.user.is_authenticated:
            qs = qs.filter(author=self.user)

        try:
            min_rating = self._get("minRating")
            if min_rating is not None:
                qs = qs.filter(overall_rating__gte=float(min_rating))
        except (TypeError, ValueError):  # pragma: no cover
            pass

        try:
            max_rating = self._get("maxRating")
            if max_rating is not None:
                qs = qs.filter(overall_rating__lte=float(max_rating))
        except (TypeError, ValueError):  # pragma: no cover
            pass

        term_year = self._get("termYear")
        if term_year:
            qs = qs.filter(term_year=term_year)

        term_semester = self._get("termSemester")
        if term_semester:
            qs = qs.filter(term_semester=term_semester)

        return qs
