from __future__ import annotations

from typing import List

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Teacher
from .serializers import TeacherSerializer, TeacherCourseRefSerializer
from django.db.models import Q


class TeacherViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoints for teachers.

    Endpoints:
    - GET /api/teachers/            (list, search via ?q=)
    - GET /api/teachers/{id}/       (detail)
    - GET /api/teachers/{id}/courses/  (courses taught by this teacher)
    """

    queryset = Teacher.objects.all().order_by("name")
    serializer_class = TeacherSerializer
    permission_classes = [permissions.AllowAny]

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

    @action(detail=True, methods=["get"], url_path="courses")
    def courses(self, request, pk=None):
        """Return lightweight course refs taught by the teacher.

        Uses existing Course model where `teachers` JSON list contains the teacher name.
        """
        # Lazy import to avoid hard dependency at import time
        from courses.models import Course

        try:
            teacher = Teacher.objects.get(pk=pk)
        except Teacher.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Use M2M relation to fetch courses taught by this teacher
        qs = Course.objects.filter(teachers=teacher)
        data = [
            {
                "subjectId": str(c.subject_id),
                "subjectCode": c.subject_code,
                "title": c.title,
            }
            for c in qs
        ]
        serializer = TeacherCourseRefSerializer(data=data, many=True)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)
