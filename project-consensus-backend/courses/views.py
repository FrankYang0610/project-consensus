from __future__ import annotations

import logging
from typing import TypedDict
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.exceptions import ValidationError
from core.permissions import IsAuthorOrReadOnly
from .pagination import CourseReviewPagination, CourseListPagination
from .annotations import annotate_is_liked, annotate_user_vote, annotate_user_has_review


from .models import (
    Course,
    CourseReview,
    CourseReviewReply,
    CourseReviewLike,
    CourseReviewReplyLike,
    CourseVote,
)
from .serializers import (
    CourseSerializer, 
    CourseReviewSerializer, 
    CourseReviewReplySerializer,
    CourseVoteInputSerializer,
)
from .services import (
    # Utils
    get_departments_with_counts,
    get_department_level_distribution,
    get_distinct_departments_case_insensitive,
    find_review_for_reply_id,
    
    # Course Review CRUD
    create_course_review,
    update_course_review,
    delete_course_review,
    
    # Course Review Reply CRUD
    create_course_review_reply,
    delete_course_review_reply,
    
    # Like/Vote operations
    toggle_course_review_like,
    toggle_course_review_reply_like,
    toggle_course_vote,
)
from .services.course_filters import CourseFilter, CourseReviewFilter
from .services.course_exceptions import (
    ServiceError, 
    AlreadyReviewedError, 
    ValidationError as ServiceValidationError,
    NotFoundError
)

class DepartmentInfo(TypedDict):
    """Type definition for department information with count."""
    name: str
    count: int

logger = logging.getLogger(__name__)


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoints for courses, aligned with frontend usage.

    Best practices applied:
    - Lookup by `course_id` to match frontend routing (`/courses/[courseId]`).
    - Allow basic search and ordering.
    - Provide a nested `reviews` endpoint for convenience.
    """

    queryset = Course.objects.all().prefetch_related("teachers").order_by("-last_updated")
    serializer_class = CourseSerializer
    # Read: allow anyone; Write (e.g., nested POST actions): require authentication
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    # Use course_id as the resource identifier (e.g., /api/courses/{uuid}/)
    lookup_field = "course_id"
    # UUID pattern (8-4-4-4-12 hex), be lenient to lowercase/uppercase
    lookup_value_regex = "[0-9a-fA-F\-]{32,36}"

    # Basic filtering/searching/ordering for list endpoint
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["subject_code", "title", "department"]
    ordering_fields = ["last_updated", "rating_score", "rating_reviews_count", "subject_code"]

    # Enable pagination for the courses list endpoint so the frontend can lazy‑load
    pagination_class = CourseListPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        # Apply query-parameter filters only for the list action.
        # Detail/retrieve and custom actions (e.g., reviews, vote) should not be
        # affected by list filters like subjectCode/teacherId/etc.
        if getattr(self, "action", None) == "list":
            qs = CourseFilter(self.request.query_params).apply(qs)

        # Only annotate per-user info on retrieve to avoid extra work on list
        if self.action == "retrieve":
            user = getattr(self.request, "user", None)
            qs = annotate_user_vote(qs, CourseVote, "course", user)
            qs = annotate_user_has_review(qs, CourseReview, "course", user)
        # Always prefetch teachers to avoid N+1 in serializers
        return qs.prefetch_related("teachers")

    def get_serializer_context(self):  # type: ignore[override]
        ctx = super().get_serializer_context()
        # Include userVote/userHasReview/otherTeacherCourses only for detail retrieve responses
        is_detail = (self.action == "retrieve")
        ctx["include_user_vote"] = is_detail
        ctx["include_user_review"] = is_detail
        ctx["include_other_teachers"] = is_detail
        return ctx
    
    @action(detail=False, methods=["get"], url_path="departments")
    def departments(self, request):
        """Return distinct department names for filtering (case-insensitive).

        This endpoint is used by the frontend to populate the Department filter
        with values that actually exist in the database, avoiding code/name
        mismatches.

        Response shape: { "departments": ["Computer Science", "Mathematics", ...] }
        """
        departments = get_distinct_departments_case_insensitive()
        return Response({"departments": departments}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="departments-with-counts")
    def departments_with_counts(self, request):
        """Return distinct department names with course counts (optimized for browse page).

        This endpoint is optimized for the course browse by department page.
        It performs a single aggregated query to get department names and counts,
        reducing N+1 queries significantly.

        Response shape: { 
            "departments": [
                {"name": "Computer Science", "count": 42},
                {"name": "Mathematics", "count": 28},
                ...
            ] 
        }
        """
        departments = get_departments_with_counts()
        return Response({"departments": departments}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="department-levels")
    def department_levels(self, request):
        """Return level distribution for a specific department (optimized for browse page).

        Query params:
        - department: Department name (required)

        This endpoint is optimized to get level counts for a single department
        without fetching all course data, enabling efficient lazy loading.

        Response shape: { 
            "levels": [
                {"level": "1", "count": 8},
                {"level": "2", "count": 6},
                ...
            ] 
        }
        """
        department = request.query_params.get("department")
        if not department:
            return Response(
                {"detail": "department parameter is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        levels_data = get_department_level_distribution(department)
        return Response({"levels": levels_data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reviews", permission_classes=[permissions.IsAuthenticated])
    def reviews(self, request, course_id=None):
        """Create a review for a course (convenience endpoint for frontend).
        
        This is a convenience proxy to the CourseReviewViewSet for easier frontend integration.
        The actual business logic is handled by the service layer.
        """
        # Use DRF's lookup to avoid accidental filtering by list query params
        course = self.get_object()

        serializer = CourseReviewSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Apply business logic validation for creation
        from .validators import validate_course_review_creation
        try:
            validated_data = validate_course_review_creation(serializer.validated_data, request.data)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            instance = create_course_review(
                user=request.user, 
                course=course, 
                payload=validated_data
            )
            out = CourseReviewSerializer(instance, context={"request": request})
            return Response(out.data, status=status.HTTP_201_CREATED)
        except AlreadyReviewedError:
            return Response(
                {"detail": "You have already reviewed this course.", "code": "already_reviewed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["POST"], url_path="vote", permission_classes=[permissions.IsAuthenticated])
    def vote(self, request, course_id=None):
        """Toggle/switch course vote for current user.

        Body: { "voteType": "recommend" | "notRecommend" }
        Behavior:
        - If user has no vote: create new vote with value; increment corresponding counter.
        - If user voted same value: remove vote (toggle off); decrement corresponding counter.
        - If user voted different value: switch; decrement old counter and increment new counter.

        All updates are done in a transaction with atomic F() updates to avoid race conditions.
        Returns minimal payload with latest counts and current userVote.
        """
        course = self.get_object()

        serializer = CourseVoteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        result = toggle_course_vote(user=user, course=course, vote_type=serializer.validated_data["voteType"])

        return Response(
            {
                "courseId": str(course.course_id),
                "rating": {
                    "recommendCount": result["recommend_count"],
                    "notRecommendCount": result["not_recommend_count"],
                },
                "userVote": result["user_vote"],
            },
            status=status.HTTP_200_OK,
        )


class CourseReviewViewSet(viewsets.ModelViewSet):
    """CRUD for course reviews.

    Supports filtering by course via query param:
    - GET /api/reviews/?course=<id>
    """

    queryset = (
        CourseReview.objects
        .select_related("course", "author")
        .prefetch_related("author__profile")
    )
    serializer_class = CourseReviewSerializer
    permission_classes = [IsAuthorOrReadOnly]

    filter_backends = [SearchFilter, OrderingFilter]
    ordering_fields = ["created_at", "updated_at", "likes_count", "overall_rating"]
    search_fields = ["content"]
    pagination_class = CourseReviewPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        qs = CourseReviewFilter(self.request.query_params, user=getattr(self.request, "user", None)).apply(qs)

        # Annotate per-user isLiked to avoid N+1 exists() calls in serializer
        user = getattr(self.request, "user", None)
        qs = annotate_is_liked(qs, CourseReviewLike, "review", user)
        return qs

    def list(self, request, *args, **kwargs):  # type: ignore[override]
        """List course reviews with proper author display."""
        from .services.course_review_read import prepare_course_review_for_serialization
        
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            # Prepare each review for serialization
            prepared_reviews = [
                prepare_course_review_for_serialization(review, request.user)
                for review in page
            ]
            serializer = self.get_serializer(prepared_reviews, many=True)
            return self.get_paginated_response(serializer.data)
        
        # Prepare all reviews for serialization
        prepared_reviews = [
            prepare_course_review_for_serialization(review, request.user)
            for review in queryset
        ]
        serializer = self.get_serializer(prepared_reviews, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):  # type: ignore[override]
        """Retrieve a single course review with proper author display."""
        from .services.course_review_read import prepare_course_review_for_serialization
        
        instance = self.get_object()
        prepared_instance = prepare_course_review_for_serialization(instance, request.user)
        serializer = self.get_serializer(prepared_instance)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, pk: str | None = None):
        """Toggle like for current user (like if not liked, unlike if already liked).
        
        Behavior:
        - If user has not liked: create like; increment likes_count.
        - If user has liked: remove like; decrement likes_count.
        
        Returns updated review with current isLiked and likesCount.
        """
        assert pk is not None
        review = self.get_object()
        user = request.user
        try:
            toggle_course_review_like(user=user, review=review)
            review = self.get_queryset().get(pk=pk)
            data = self.get_serializer(review, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def perform_create(self, serializer):  # type: ignore[override]
        user = self.request.user
        course_id = self.request.data.get("courseId") or self.request.data.get("course_id")
        if not course_id:
            raise ValidationError({"courseId": "required"})
        
        try:
            course = Course.objects.get(course_id=course_id)
        except Course.DoesNotExist:
            raise ValidationError({"courseId": "invalid course courseId"})
        
        # Apply business logic validation for creation
        from .validators import validate_course_review_creation
        try:
            validated_data = validate_course_review_creation(serializer.validated_data, self.request.data)
        except ValidationError as e:
            raise e
        
        try:
            instance = create_course_review(
                user=user, 
                course=course, 
                payload=validated_data
            )
            serializer.instance = instance # Set the created instance on the serializer so DRF can serialize it properly
        except AlreadyReviewedError:
            raise ValidationError({
                "detail": "You have already reviewed this course.",
                "code": "already_reviewed",
            })

    def update(self, request, *args, **kwargs):  # type: ignore[override]
        """Allow only the author to update their review.

        On successful update, mark the review as edited and recompute aggregates.
        """
        partial = kwargs.pop("partial", False)
        instance: CourseReview = self.get_object()

        serializer = CourseReviewSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Apply business logic validation for update
        from .validators import validate_course_review_update
        try:
            validated_data = validate_course_review_update(serializer.validated_data, request.data, instance)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            updated_instance = update_course_review(
                user=request.user,
                review=instance,
                payload=validated_data
            )
            return Response(CourseReviewSerializer(updated_instance, context={"request": request}).data)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    def partial_update(self, request, *args, **kwargs):  # type: ignore[override]
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):  # type: ignore[override]
        """Hard delete a course review: only the author may delete.

        Behavior:
        - Hard-delete the review row; database CASCADE removes all related replies and likes
        - Recompute course and teacher aggregates after deletion
        """
        instance: CourseReview = self.get_object()
        
        try:
            delete_course_review(user=request.user, review=instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)


class CourseReviewReplyViewSet(viewsets.ModelViewSet):
    """CRUD for course review replies.

    Supports filtering by review via query param:
    - GET /api/replies/?review=<review_id>
    """

    queryset = (
        CourseReviewReply.objects
        .select_related("review", "author", "reply_to_user")
        .prefetch_related("author__profile", "reply_to_user__profile")
    )
    serializer_class = CourseReviewReplySerializer
    permission_classes = [IsAuthorOrReadOnly]

    filter_backends = [SearchFilter, OrderingFilter]
    ordering_fields = ["created_at", "likes_count"]
    search_fields = ["content"]
    pagination_class = CourseReviewPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset().filter(is_deleted=False)
        review_id = self.request.query_params.get("review")
        if review_id:
            qs = qs.filter(review_id=review_id)
        # Annotate per-user isLiked to avoid N+1 exists() calls in serializer
        user = getattr(self.request, "user", None)
        qs = annotate_is_liked(qs, CourseReviewReplyLike, "reply", user)
        return qs
    
    def perform_create(self, serializer):  # type: ignore[override]
        user = self.request.user
        review_id = self.request.data.get("reviewId") or self.request.data.get("review")
        if not review_id:
            raise ValidationError({"reviewId": "required"})
        
        try:
            review = CourseReview.objects.get(pk=review_id)
        except CourseReview.DoesNotExist:
            raise ValidationError({"reviewId": "invalid"})
        
        reply_to_user_id = self.request.data.get("replyToUserId")
        try:
            instance = create_course_review_reply(
                user=user,
                review=review,
                payload=serializer.validated_data,
                reply_to_user_id=reply_to_user_id,
            )
            serializer.instance = instance # Set the created instance on the serializer so DRF can serialize it properly
        except ServiceError as e:
            if isinstance(e, NotFoundError):
                raise ValidationError({"replyToUserId": str(e)})
            raise ValidationError({"detail": str(e)})

    def update(self, request, *args, **kwargs):  # type: ignore[override]
        return Response({"detail": "Reply editing is not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):  # type: ignore[override]
        return Response({"detail": "Reply editing is not allowed"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):  # type: ignore[override]
        """Soft delete a course review reply: only the author may delete.

        Behavior:
        - Mark is_deleted=True
        - Clear content (set to empty string)
        - Keep the row to preserve thread structure
        - Recompute reply count for the parent review
        """
        instance: CourseReviewReply = self.get_object()
        
        try:
            delete_course_review_reply(user=request.user, reply=instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, pk: str | None = None):
        """Toggle like for current user (like if not liked, unlike if already liked).
        
        Behavior:
        - If user has not liked: create like; increment likes_count.
        - If user has liked: remove like; decrement likes_count.
        
        Returns updated reply with current isLiked and likes.
        """
        assert pk is not None
        reply = self.get_object()
        user = request.user
        try:
            toggle_course_review_reply_like(user=user, reply=reply)
            reply = self.get_queryset().get(pk=pk)
            data = self.get_serializer(reply, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["GET"], url_path="find-review")
    def find_review(self, request):
        """Find the review ID for a given reply ID.
        
        Query params:
        - replyId: UUID of the reply
        
        Returns:
        - reviewId: UUID of the parent review
        - courseId: UUID of the course
        
        This endpoint is used by the frontend to efficiently locate which review
        contains a specific reply when navigating from notifications.
        """
        reply_id = request.query_params.get("replyId")
        if not reply_id:
            return Response(
                {"detail": "replyId query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            reply_info = find_review_for_reply_id(reply_id)
            return Response(reply_info, status=status.HTTP_200_OK)
        except ServiceError as e:
            if isinstance(e, NotFoundError):
                return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
