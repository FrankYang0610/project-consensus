from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Course, CourseReview, CourseReviewReply
from .serializers import CourseSerializer, CourseReviewSerializer, CourseReviewReplySerializer


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoints for courses, aligned with frontend usage.

    Best practices applied:
    - Lookup by `subject_id` to match frontend routing (`/courses/[subjectId]`).
    - Allow basic search and ordering.
    - Provide a nested `reviews` endpoint for convenience.
    """

    queryset = Course.objects.all().order_by("-last_updated")
    serializer_class = CourseSerializer
    permission_classes = [permissions.AllowAny]

    # Use subject_id as the resource identifier (e.g., /api/courses/crs_0001/)
    lookup_field = "subject_id"
    # UUID pattern (8-4-4-4-12 hex), be lenient to lowercase/uppercase
    lookup_value_regex = "[0-9a-fA-F\-]{32,36}"

    # Basic filtering/searching/ordering for list endpoint
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["subject_code", "title", "department"]
    ordering_fields = ["last_updated", "rating_score", "rating_reviews_count", "subject_code"]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        # Optional filters to help frontend query
        subject_code = self.request.query_params.get("subjectCode")
        if subject_code:
            qs = qs.filter(subject_code=subject_code)
        department = self.request.query_params.get("department")
        if department:
            qs = qs.filter(department__iexact=department)
        teacher_id = self.request.query_params.get("teacherId")
        if teacher_id:
            qs = qs.filter(teachers__id=teacher_id).distinct()
        return qs

    @action(detail=True, methods=["get", "post"], url_path="reviews")
    def reviews(self, request, subject_id=None):
        """Nested reviews for a course identified by subject_id.

        - GET: list reviews for the course (supports basic pagination)
        - POST: create a review for the course (requires authentication)
        """
        try:
            course = self.get_queryset().get(subject_id=subject_id)
        except Course.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method.lower() == "get":
            qs = CourseReview.objects.select_related("author", "course").filter(course=course)
            page = self.paginate_queryset(qs)
            serializer = CourseReviewSerializer(page or qs, many=True, context={"request": request})
            if page is not None:
                return self.get_paginated_response(serializer.data)
            return Response(serializer.data)

        # POST branch
        if not request.user or not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = CourseReviewSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            # Persist with bound course and author
            serializer.save(course=course, author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CourseReviewViewSet(viewsets.ModelViewSet):
    """CRUD for course reviews.

    Supports filtering by course via query param:
    - GET /api/reviews/?course=<id>
    """

    queryset = CourseReview.objects.select_related("course", "author")
    serializer_class = CourseReviewSerializer
    permission_classes = [permissions.AllowAny]

    filter_backends = [SearchFilter, OrderingFilter]
    ordering_fields = ["created_at", "updated_at", "likes_count", "overall_rating"]
    search_fields = ["content"]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        # Support filtering by numeric course ID
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)

        # Also support subjectId (align with frontend Course.subjectId)
        subject_id = self.request.query_params.get("subjectId") or self.request.query_params.get("subject_id")
        if subject_id:
            qs = qs.filter(course__subject_id=subject_id)
        return qs


class CourseReviewReplyViewSet(viewsets.ModelViewSet):
    """CRUD for course review replies.

    Supports filtering by review via query param:
    - GET /api/replies/?review=<review_id>
    """

    queryset = CourseReviewReply.objects.select_related("review", "author", "reply_to_user")
    serializer_class = CourseReviewReplySerializer
    permission_classes = [permissions.AllowAny]

    filter_backends = [SearchFilter, OrderingFilter]
    ordering_fields = ["created_at", "likes_count"]
    search_fields = ["content"]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        review_id = self.request.query_params.get("review")
        if review_id:
            qs = qs.filter(review_id=review_id)
        return qs
