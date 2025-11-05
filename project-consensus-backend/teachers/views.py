from __future__ import annotations

from typing import List
from urllib.parse import urlencode

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination

from .models import Teacher
from .serializers import TeacherSerializer, TeacherCourseRefSerializer
from django.db.models import Q


class TeacherPagination(PageNumberPagination):
    """Custom pagination for teachers list."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TeacherViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoints for teachers.

    Endpoints:
    - GET /api/teachers/            (list, search via ?q=, paginated)
    - GET /api/teachers/{id}/       (detail)
    - GET /api/teachers/{id}/courses/  (courses taught by this teacher)
    """

    queryset = Teacher.objects.all().order_by("name")
    serializer_class = TeacherSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = TeacherPagination

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "department"]
    ordering_fields = ["name", "department", "updated_at", "rating_overall", "rating_reviews_count"]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            # Basic search across name and department; JSON fields vary by DB so keep simple
            qs = qs.filter(Q(name__icontains=q) | Q(department__icontains=q))
        return qs

    @action(detail=False, methods=["get"], url_path="search-splink")
    def search_splink(self, request):
        """Approximate search powered by Splink (DuckDB).

        Query params:
        - q: search text (required)
        - page: page number (optional; defaults to 1)
        - page_size: page size (optional; defaults to TeacherPagination.page_size)

        Falls back to simple icontains search if Splink is unavailable.
        """
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"detail": "Missing query parameter 'q'"}, status=status.HTTP_400_BAD_REQUEST)

        page_param = request.query_params.get("page")
        page_size_param = request.query_params.get("page_size")

        from .services.splink_search import search_teachers_with_splink

        # Resolve pagination params with sane bounds
        try:
            page = max(int(page_param) if page_param else 1, 1)
        except (TypeError, ValueError):
            page = 1
        default_page_size = getattr(self.pagination_class, "page_size", 20) or 20
        max_page_size = getattr(self.pagination_class, "max_page_size", 100) or 100
        try:
            page_size = int(page_size_param) if page_size_param else int(default_page_size)
        except (TypeError, ValueError):
            page_size = int(default_page_size)
        page_size = max(1, min(page_size, int(max_page_size)))

        # Fetch one extra item to determine if a next page exists
        top_k = page * page_size + 1
        pairs = search_teachers_with_splink(q, top_k=top_k)
        total_fetched = len(pairs)
        start = (page - 1) * page_size
        end = start + page_size
        has_more = total_fetched > end

        # Slice to current page (guard against short results)
        page_pairs = pairs[start:min(end, total_fetched)] if start < total_fetched else []
        page_teachers = [t for (t, _score) in page_pairs]

        # Serialize teacher objects only (consistent with other list endpoints)
        data_results = [TeacherSerializer(instance=t).data for t in page_teachers]

        # Build pagination links (relative URLs are sufficient for clients that only test truthiness)
        def build_url(p: int) -> str:
            query = urlencode({"q": q, "page": p, "page_size": page_size})
            return f"/api/teachers/search-splink/?{query}"

        next_url = build_url(page + 1) if has_more else None
        prev_url = build_url(page - 1) if page > 1 else None

        # We cannot know the true total from Splink; provide a conservative lower bound
        conservative_count = (end + 1) if has_more else total_fetched

        return Response({
            "count": int(conservative_count),
            "next": next_url,
            "previous": prev_url,
            "results": data_results,
        })

    @action(detail=True, methods=["get"], url_path="courses")
    def courses(self, request, pk=None):
        """Return lightweight course refs taught by the teacher via M2M relation.

        Uses the Course.teachers M2M field to fetch all courses associated with this teacher.
        """
        # Lazy import to avoid hard dependency at import time
        from courses.models import Course

        try:
            teacher = Teacher.objects.get(pk=pk)
        except Teacher.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Use M2M relation to fetch courses taught by this teacher (optimized query)
        qs = (
            Course.objects
            .filter(teachers=teacher)
            .only('course_id', 'subject_code', 'title')
        )
        data = [
            {
                "courseId": str(c.course_id),
                "subjectCode": c.subject_code,
                "title": c.title,
            }
            for c in qs
        ]
        serializer = TeacherCourseRefSerializer(data=data, many=True)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)
