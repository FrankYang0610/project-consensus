from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination

from courses.models import Course

from django.db.models import Q

from .models import Teacher
from .serializers import TeacherSerializer, TeacherCourseRefSerializer
from .services.teachers_splink_search import search_teachers_with_splink
from .services.teachers_build_search_response import build_teachers_splink_response


class TeacherPagination(PageNumberPagination):
    """Custom pagination for teachers list."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TeacherViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoints for teachers.

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
        """
        Approximate search powered by Splink (DuckDB).

        Query params:
        - q: search text (required)
        - page: page number (optional; defaults to 1)
        - page_size: page size (optional; defaults to TeacherPagination.page_size)

        Falls back to simple icontains search if Splink is unavailable.
        """
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"detail": "Missing query parameter 'q'"}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve pagination params with DRF's paginator helpers
        paginator = self.pagination_class()

        # Page number: coerce to int and clamp to >= 1
        try:
            page = int(request.query_params.get("page", 1))
        except (TypeError, ValueError):
            page = 1
        page = max(page, 1)

        # Page size: let paginator enforce bounds (page_size_query_param, max_page_size)
        page_size = paginator.get_page_size(request)
        if not page_size:
            page_size = paginator.page_size

        search_result = search_teachers_with_splink(q, page=page, page_size=page_size)

        response_data = build_teachers_splink_response(
            request=request,
            teachers=search_result.teachers,
            query=q,
            page=page,
            page_size=page_size,
            has_more=search_result.has_more,
            total_fetched=search_result.total_fetched,
        )

        return Response(response_data)

    @action(detail=True, methods=["get"], url_path="courses")
    def courses(self, request, pk=None):
        """
        Return lightweight course refs taught by the teacher via M2M relation.
        Uses the Course.teachers M2M field to fetch all courses associated with this teacher.
        """
        teacher = self.get_object()  # automatically handle pk lookup and 404
        qs = Course.objects.filter(teachers=teacher).only('course_id', 'subject_code', 'title')
        serializer = TeacherCourseRefSerializer(qs, many=True)
        return Response(serializer.data)
