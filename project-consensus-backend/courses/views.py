from __future__ import annotations

from rest_framework import viewsets, permissions

from .models import Course, CourseReview, CourseReviewReply
from .serializers import CourseSerializer, CourseReviewSerializer, CourseReviewReplySerializer


class CourseViewSet(viewsets.ModelViewSet):
    """CRUD for courses."""

    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.AllowAny]


class CourseReviewViewSet(viewsets.ModelViewSet):
    """CRUD for course reviews.

    Supports filtering by course via query param:
    - GET /api/reviews/?course=<id>
    """

    queryset = CourseReview.objects.select_related("course", "author")
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs


class CourseReviewReplyViewSet(viewsets.ModelViewSet):
    """CRUD for course review replies.

    Supports filtering by review via query param:
    - GET /api/replies/?review=<review_id>
    """

    queryset = CourseReviewReply.objects.select_related("review", "author", "reply_to_user")
    serializer_class = CourseReviewReplySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        review_id = self.request.query_params.get("review")
        if review_id:
            qs = qs.filter(review_id=review_id)
        return qs
