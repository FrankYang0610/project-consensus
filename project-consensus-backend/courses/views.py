from __future__ import annotations

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db.models import Avg, Count, Q
from django.db import transaction, IntegrityError
from django.db.models import F
from django.db.models import Exists
from django.db.models import OuterRef, Subquery, CharField
from rest_framework.pagination import PageNumberPagination

from .models import (
    Course,
    CourseReview,
    CourseReviewReply,
    CourseReviewLike,
    CourseReviewReplyLike,
    CourseVote,
)
from .serializers import CourseSerializer, CourseReviewSerializer, CourseReviewReplySerializer
from notifications import NotificationType
from notifications.events import emit, DomainEvent
from django.utils import timezone


def _is_constraint_violation(e: IntegrityError, constraint_name: str) -> bool:
    """Check if an IntegrityError is caused by a specific constraint violation.
    
    This function attempts to extract the constraint name from the exception in a 
    database-agnostic way, falling back to string matching if needed.
    
    Args:
        e: The IntegrityError exception.
        constraint_name: The expected constraint name to check.
    
    Returns:
        True if the error is caused by the specified constraint, False otherwise.
    """
    # Try PostgreSQL psycopg2/psycopg3 exception structure
    if hasattr(e, '__cause__') and e.__cause__ is not None:
        # psycopg2 uses 'diag' attribute
        if hasattr(e.__cause__, 'diag'):
            actual_constraint = getattr(e.__cause__.diag, 'constraint_name', None)
            if actual_constraint == constraint_name:
                return True
        # psycopg3 and some other adapters may store it differently
        if hasattr(e.__cause__, 'constraint_name'):
            if e.__cause__.constraint_name == constraint_name:
                return True
    
    # Fallback: check string representation (works across databases but less reliable)
    return constraint_name in str(e)


def _recompute_course_aggregates(course: Course) -> None:
    """Recompute course rating aggregates with row-level locking to prevent race conditions.
    
    Args:
        course: The course instance to recompute aggregates for.
    
    Note:
        This function should be called within a transaction context.
        It uses select_for_update() to prevent concurrent modifications.
    """
    # Lock the course row to prevent race conditions during concurrent review operations
    locked_course = Course.objects.select_for_update().get(pk=course.pk)
    
    qs = CourseReview.objects.filter(course=locked_course, only_text=False)
    agg = qs.aggregate(avg=Avg("overall_rating"), cnt=Count("id"))
    count = int(agg.get("cnt") or 0)
    avg = float(agg.get("avg") or 0.0)
    # Keep one decimal place as agreed
    score = round(avg, 1) if count > 0 else 0.0
    
    # Update the locked course instance
    locked_course.rating_reviews_count = count
    locked_course.rating_score = score
    locked_course.save(update_fields=["rating_reviews_count", "rating_score"])


def _recompute_replies_count(review: CourseReview) -> None:
    cnt = review.replies.count()
    CourseReview.objects.filter(pk=review.pk).update(replies_count=cnt)


def _recompute_teachers_aggregates(course: Course) -> None:
    """Update rating aggregates for all teachers of the given course.
    
    This should be called after any course review is created, updated, or deleted
    to keep teacher ratings in sync with their course reviews.
    """
    from teachers.utils import recompute_teacher_aggregates
    
    # Update all teachers associated with this course
    for teacher in course.teachers.all():
        recompute_teacher_aggregates(teacher)


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
    class DefaultPageNumberPagination(PageNumberPagination):
        page_size = 20
        page_size_query_param = "page_size"
        max_page_size = 100
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        # Apply query-parameter filters only for the list action.
        # Detail/retrieve and custom actions (e.g., reviews, vote) should not be
        # affected by list filters like subjectCode/teacherId/etc.
        if getattr(self, "action", None) == "list":
            # Optional filters to help frontend query
            subject_code = self.request.query_params.get("subjectCode")
            if subject_code:
                qs = qs.filter(subject_code=subject_code)
            # Department filter moved below to support multi-value (repeated or comma-separated)
            teacher_id = self.request.query_params.get("teacherId")
            if teacher_id:
                qs = qs.filter(teachers__id=teacher_id).distinct()

            # --- Extended filters wired to frontend CourseFilterBar ---
            qp = self.request.query_params

            # Helper: collect multi-value params from repeated keys or comma-separated lists
            def _collect_multi(key: str) -> list[str]:
                values = list(qp.getlist(key))
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

            # category → selection_category (single-value; ignore 'all')
            category = qp.get("category")
            if category and category.lower() != "all":
                qs = qs.filter(selection_category__iexact=category)

            # selectionCategory IN (...)
            selection_categories = _collect_multi("selectionCategory")
            if selection_categories:
                qs = qs.filter(selection_category__in=selection_categories)

            # courseCategory IN (...)
            course_categories = _collect_multi("courseCategory")
            # alias: categories → courseCategory
            course_categories_alias = _collect_multi("categories")
            course_categories = course_categories or course_categories_alias
            if course_categories:
                qs = qs.filter(course_category__in=course_categories)

            # teachingType IN (...)
            teaching_types = _collect_multi("teachingType")
            if teaching_types:
                qs = qs.filter(teaching_type__in=teaching_types)

            # department IN (...), case-insensitive; supports repeated key or comma-separated
            departments = _collect_multi("department")
            if departments:
                # Input validation: limit count and length to prevent DoS
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

            # level IN ('1'..'6'); accept repeated level= and comma-separated levels=, normalize to strings
            levels = _collect_multi("level")
            if not levels:
                levels = _collect_multi("levels")
            # normalize numeric inputs to string digits
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

        # Only annotate per-user info on retrieve to avoid extra work on list
        if self.action == "retrieve":
            user = getattr(self.request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                vote_sq = (
                    CourseVote.objects
                    .filter(user=user, course=OuterRef("pk"))
                    .values("value")[:1]
                )
                qs = qs.annotate(_user_vote=Subquery(vote_sq, output_field=CharField()))
                # Annotate whether user has reviewed this course
                has_review_exists = CourseReview.objects.filter(course=OuterRef("pk"), author=user)
                qs = qs.annotate(_user_has_review=Exists(has_review_exists))
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
        # Collect non-empty department names; deduplicate in Python to achieve
        # case-insensitive distinct across different DB backends.
        values = (
            Course.objects.exclude(department="")
            .values_list("department", flat=True)
        )
        seen: dict[str, str] = {}
        for name in values:
            if not name:
                continue
            key = str(name).strip().lower()
            if key not in seen:
                seen[key] = str(name).strip()
        departments = sorted(seen.values(), key=lambda s: s.lower())
        return Response({"departments": departments}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"], url_path="reviews")
    def reviews(self, request, course_id=None):
        """Nested reviews for a course identified by course_id.

        - GET: list reviews for the course (supports basic pagination)
        - POST: create a review for the course (requires authentication)
        """
        # Use DRF's lookup to avoid accidental filtering by list query params
        course = self.get_object()

        if request.method.lower() == "get":
            qs = (
                CourseReview.objects
                .select_related("author", "course")
                .prefetch_related("author__profile")
                .filter(course=course)
            )
            # Annotate isLiked for current user to avoid N+1 on serializer
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                like_exists = CourseReviewLike.objects.filter(review=OuterRef("pk"), user=user)
                qs = qs.annotate(is_liked=Exists(like_exists))
            # Use a local paginator to avoid paginating the courses list
            class DefaultPageNumberPagination(PageNumberPagination):
                page_size = 10
                page_size_query_param = "page_size"
                max_page_size = 50
            paginator = DefaultPageNumberPagination()
            page = paginator.paginate_queryset(qs, request, view=self)
            serializer = CourseReviewSerializer(page or qs, many=True, context={"request": request})
            if page is not None:
                return paginator.get_paginated_response(serializer.data)
            return Response(serializer.data)

        # POST branch (authentication is enforced by DRF permission class)

        serializer = CourseReviewSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            # Persist with bound course and author
            # Rely on database UniqueConstraint for concurrency safety
            try:
                with transaction.atomic():
                    instance = serializer.save(course=course, author=request.user)
                    _recompute_course_aggregates(course)
                    _recompute_teachers_aggregates(course)
                out = CourseReviewSerializer(instance, context={"request": request})
                return Response(out.data, status=status.HTTP_201_CREATED)
            except IntegrityError as e:
                # Catch unique constraint violation (duplicate review)
                if _is_constraint_violation(e, 'unique_course_review_per_user'):
                    return Response(
                        {"detail": "You have already reviewed this course.", "code": "already_reviewed"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # Re-raise other integrity errors
                raise
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

        vote_type = (request.data or {}).get("voteType")
        if vote_type not in (CourseVote.Value.RECOMMEND, CourseVote.Value.NOT_RECOMMEND):
            return Response({"voteType": "must be 'recommend' or 'notRecommend'"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        with transaction.atomic():
            existing = (
                CourseVote.objects.select_for_update()
                .filter(user=user, course=course)
                .first()
            )

            if existing is None:
                # New vote
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
            else:
                if existing.value == vote_type:
                    # Toggle off
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

        # Refresh counts
        course.refresh_from_db(fields=["rating_recommend_count", "rating_not_recommend_count"])
        return Response(
            {
                "courseId": str(course.course_id),
                "rating": {
                    "recommendCount": course.rating_recommend_count,
                    "notRecommendCount": course.rating_not_recommend_count,
                },
                "userVote": user_vote,
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
    # Read for anyone; write requires authentication
    def get_permissions(self):  # type: ignore[override]
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    filter_backends = [SearchFilter, OrderingFilter]
    ordering_fields = ["created_at", "updated_at", "likes_count", "overall_rating"]
    search_fields = ["content"]
    class DefaultPageNumberPagination(PageNumberPagination):
        page_size = 10
        page_size_query_param = "page_size"
        max_page_size = 50
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        # Support filtering by numeric course ID
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)

        # Also support courseId (align with frontend Course.courseId)
        course_id = self.request.query_params.get("courseId") or self.request.query_params.get("course_id")
        if course_id:
            qs = qs.filter(course__course_id=course_id)

        # Filter to current user's review when requested
        mine = self.request.query_params.get("mine")
        if mine and getattr(self.request, "user", None) and self.request.user.is_authenticated:
            qs = qs.filter(author=self.request.user)

        # Optional rating range filters (0..10)
        try:
            min_rating = self.request.query_params.get("minRating")
            if min_rating is not None:
                qs = qs.filter(overall_rating__gte=float(min_rating))
        except ValueError:  # pragma: no cover
            pass
        try:
            max_rating = self.request.query_params.get("maxRating")
            if max_rating is not None:
                qs = qs.filter(overall_rating__lte=float(max_rating))
        except ValueError:  # pragma: no cover
            pass

        # Optional term filters
        term_year = self.request.query_params.get("termYear")
        if term_year:
            qs = qs.filter(term_year=term_year)
        term_semester = self.request.query_params.get("termSemester")
        if term_semester:
            qs = qs.filter(term_semester=term_semester)

        # Annotate per-user isLiked to avoid N+1 exists() calls in serializer
        user = getattr(self.request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            like_exists = CourseReviewLike.objects.filter(review=OuterRef("pk"), user=user)
            qs = qs.annotate(is_liked=Exists(like_exists))
        return qs

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
            with transaction.atomic():
                existing = CourseReviewLike.objects.filter(review=review, user=user).first()
                if existing:
                    # Already liked, so unlike
                    existing.delete()
                    CourseReview.objects.filter(pk=review.pk, likes_count__gt=0).update(
                        likes_count=F("likes_count") - 1
                    )
                else:
                    # Not liked, so like
                    like = CourseReviewLike.objects.create(review=review, user=user)
                    CourseReview.objects.filter(pk=review.pk).update(likes_count=F("likes_count") + 1)
                    # Notify review author
                    if user.pk != review.author_id:
                        emit(DomainEvent(
                            type=NotificationType.COURSE_REVIEW_LIKED,
                            recipient_id=review.author_id,
                            actor_id=user.pk,
                            target_app="courses",
                            target_model="CourseReview",
                            target_id=str(review.pk),
                            route=f"/courses/{review.course.course_id}#review-{review.pk}",
                            metadata={
                                "courseId": str(review.course.course_id),
                                "courseReviewId": str(review.pk),
                                "courseTitle": f"{review.course.subject_code} {review.course.title}",
                            },
                            referenced_content_preview=f"{review.course.subject_code} {review.course.title}",
                            created_at=getattr(like, "created_at", timezone.now()),
                        ))
            # Re-fetch the review to get fresh data and annotation
            review = self.get_queryset().get(pk=pk)
            data = self.get_serializer(review, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk: str | None = None):
        """Current user likes the review (idempotent)."""
        assert pk is not None
        review = self.get_object()
        user = request.user
        try:
            with transaction.atomic():
                like, created = CourseReviewLike.objects.get_or_create(review=review, user=user)
                if created:
                    CourseReview.objects.filter(pk=review.pk).update(likes_count=F("likes_count") + 1)
                    if user.pk != review.author_id:
                        emit(DomainEvent(
                            type=NotificationType.COURSE_REVIEW_LIKED,
                            recipient_id=review.author_id,
                            actor_id=user.pk,
                            target_app="courses",
                            target_model="CourseReview",
                            target_id=str(review.pk),
                            route=f"/courses/{review.course.course_id}#review-{review.pk}",
                            metadata={
                                "courseId": str(review.course.course_id),
                                "courseReviewId": str(review.pk),
                                "courseTitle": f"{review.course.subject_code} {review.course.title}",
                            },
                            referenced_content_preview=f"{review.course.subject_code} {review.course.title}",
                            created_at=getattr(like, "created_at", timezone.now()),
                        ))
            review.refresh_from_db(fields=["likes_count"])
            data = self.get_serializer(review, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def unlike(self, request, pk: str | None = None):
        """Current user unlikes the review (idempotent). """
        assert pk is not None
        review = self.get_object()
        user = request.user
        try:
            with transaction.atomic():
                deleted, _ = CourseReviewLike.objects.filter(review=review, user=user).delete()
                if deleted:
                    CourseReview.objects.filter(pk=review.pk, likes_count__gt=0).update(likes_count=F("likes_count") - 1)
            review.refresh_from_db(fields=["likes_count"])
            data = self.get_serializer(review, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def _ensure_owner(self, obj: CourseReview) -> None:
        user = self.request.user
        if not user or (not getattr(user, "is_staff", False) and obj.author_id != user.pk):
            raise PermissionDenied("You do not have permission to modify this review.")

    def perform_create(self, serializer):  # type: ignore[override]
        user = self.request.user
        if not user or not user.is_authenticated:  # pragma: no cover - guarded by permission
            raise PermissionDenied()
        course_id = self.request.data.get("courseId") or self.request.data.get("course_id")
        course = None
        if course_id:
            try:
                course = Course.objects.get(course_id=course_id)
            except Course.DoesNotExist:
                raise ValidationError({"courseId": "invalid course courseId"})
        else:
            raise ValidationError({"courseId": "required"})
        
        # Rely on database UniqueConstraint for concurrency safety
        try:
            with transaction.atomic():
                instance = serializer.save(author=user, course=course)
                _recompute_course_aggregates(course)
                _recompute_teachers_aggregates(course)
        except IntegrityError as e:
            # Catch unique constraint violation (duplicate review)
            if _is_constraint_violation(e, 'unique_course_review_per_user'):
                raise ValidationError({
                    "detail": "You have already reviewed this course.", 
                    "code": "already_reviewed"
                })
            # Re-raise other integrity errors
            raise

    def perform_update(self, serializer):  # type: ignore[override]
        instance: CourseReview = self.get_object()
        self._ensure_owner(instance)
        with transaction.atomic():
            obj = serializer.save()
            _recompute_course_aggregates(obj.course)
            _recompute_teachers_aggregates(obj.course)

    def perform_destroy(self, instance):  # type: ignore[override]
        self._ensure_owner(instance)
        course = instance.course
        with transaction.atomic():
            instance.delete()
            _recompute_course_aggregates(course)
            _recompute_teachers_aggregates(course)


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
    def get_permissions(self):  # type: ignore[override]
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    filter_backends = [SearchFilter, OrderingFilter]
    ordering_fields = ["created_at", "likes_count"]
    search_fields = ["content"]
    class DefaultPageNumberPagination(PageNumberPagination):
        page_size = 10
        page_size_query_param = "page_size"
        max_page_size = 50
    pagination_class = DefaultPageNumberPagination

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        review_id = self.request.query_params.get("review")
        if review_id:
            qs = qs.filter(review_id=review_id)
        # Annotate per-user isLiked to avoid N+1 exists() calls in serializer
        user = getattr(self.request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            like_exists = CourseReviewReplyLike.objects.filter(reply=OuterRef("pk"), user=user)
            qs = qs.annotate(is_liked=Exists(like_exists))
        return qs

    def _ensure_owner(self, obj: CourseReviewReply) -> None:
        user = self.request.user
        if not user or (not getattr(user, "is_staff", False) and obj.author_id != user.pk):
            raise PermissionDenied("You do not have permission to modify this reply.")

    def perform_create(self, serializer):  # type: ignore[override]
        user = self.request.user
        if not user or not user.is_authenticated:  # pragma: no cover - guarded by permission
            raise PermissionDenied()
        review_id = self.request.data.get("reviewId") or self.request.data.get("review")
        if not review_id:
            raise ValidationError({"reviewId": "required"})
        try:
            review = CourseReview.objects.get(pk=review_id)
        except CourseReview.DoesNotExist:
            raise ValidationError({"reviewId": "invalid"})
        reply_to_user = None
        reply_to_user_id = self.request.data.get("replyToUserId")
        if reply_to_user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                reply_to_user = User.objects.get(pk=reply_to_user_id)
            except User.DoesNotExist:  # pragma: no cover
                reply_to_user = None
        with transaction.atomic():
            instance = serializer.save(author=user, review=review, reply_to_user=reply_to_user)
            _recompute_replies_count(review)
            # Notify reply target or review author
            try:
                target = reply_to_user or review.author
                if target.pk != user.pk:
                    # Use different notification types based on whether this is a reply to another reply
                    notification_type = (
                        NotificationType.COURSE_REVIEW_REPLY_REPLIED 
                        if reply_to_user 
                        else NotificationType.COURSE_REVIEW_REPLIED
                    )
                    emit(DomainEvent(
                        type=notification_type,
                        recipient_id=target.pk,
                        actor_id=user.pk,
                        target_app="courses",
                        target_model="CourseReviewReply",
                        target_id=str(instance.pk),
                        route=f"/courses/{review.course.course_id}#review-{review.pk}",
                        metadata={
                            "courseId": str(review.course.course_id),
                            "courseReviewId": str(review.pk),
                            "courseReviewReplyId": str(instance.pk),
                            "courseTitle": f"{review.course.subject_code} {review.course.title}",
                        },
                        content_preview=instance.content,
                        # Target is the original review content; for reply->reply we also fallback to review content
                        referenced_content_preview=review.content,
                        created_at=getattr(instance, "created_at", None),
                    ))
            except Exception:
                pass

    def perform_update(self, serializer):  # type: ignore[override]
        instance: CourseReviewReply = self.get_object()
        self._ensure_owner(instance)
        serializer.save()

    def perform_destroy(self, instance):  # type: ignore[override]
        self._ensure_owner(instance)
        review = instance.review
        with transaction.atomic():
            instance.delete()
            _recompute_replies_count(review)

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
            with transaction.atomic():
                existing = CourseReviewReplyLike.objects.filter(reply=reply, user=user).first()
                if existing:
                    # Already liked, so unlike
                    existing.delete()
                    CourseReviewReply.objects.filter(pk=reply.pk, likes_count__gt=0).update(
                        likes_count=F("likes_count") - 1
                    )
                else:
                    # Not liked, so like
                    like = CourseReviewReplyLike.objects.create(reply=reply, user=user)
                    CourseReviewReply.objects.filter(pk=reply.pk).update(likes_count=F("likes_count") + 1)
                    if user.pk != reply.author_id:
                        emit(DomainEvent(
                            type=NotificationType.COURSE_REVIEW_REPLY_LIKED,
                            recipient_id=reply.author_id,
                            actor_id=user.pk,
                            target_app="courses",
                            target_model="CourseReviewReply",
                            target_id=str(reply.pk),
                            route=f"/courses/{reply.review.course.course_id}#review-{reply.review.pk}",
                            metadata={
                                "courseId": str(reply.review.course.course_id),
                                "courseReviewId": str(reply.review.pk),
                                "courseReviewReplyId": str(reply.pk),
                                "courseTitle": f"{reply.review.course.subject_code} {reply.review.course.title}",
                            },
                            referenced_content_preview=reply.content,
                            created_at=getattr(like, "created_at", timezone.now()),
                        ))
            # Re-fetch the reply to get fresh data and annotation
            reply = self.get_queryset().get(pk=pk)
            data = self.get_serializer(reply, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk: str | None = None):
        """Current user likes the reply (idempotent). Mirrors forum like handling."""
        assert pk is not None
        reply = self.get_object()
        user = request.user
        try:
            with transaction.atomic():
                like, created = CourseReviewReplyLike.objects.get_or_create(reply=reply, user=user)
                if created:
                    CourseReviewReply.objects.filter(pk=reply.pk).update(likes_count=F("likes_count") + 1)
                    if user.pk != reply.author_id:
                        emit(DomainEvent(
                            type=NotificationType.COURSE_REVIEW_REPLY_LIKED,
                            recipient_id=reply.author_id,
                            actor_id=user.pk,
                            target_app="courses",
                            target_model="CourseReviewReply",
                            target_id=str(reply.pk),
                            route=f"/courses/{reply.review.course.course_id}#review-{reply.review.pk}",
                            metadata={
                                "courseId": str(reply.review.course.course_id),
                                "courseReviewId": str(reply.review.pk),
                                "courseReviewReplyId": str(reply.pk),
                                "courseTitle": f"{reply.review.course.subject_code} {reply.review.course.title}",
                            },
                            referenced_content_preview=reply.content,
                            created_at=getattr(like, "created_at", timezone.now()),
                        ))
            reply.refresh_from_db(fields=["likes_count"])
            data = self.get_serializer(reply, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["POST"], permission_classes=[permissions.IsAuthenticated])
    def unlike(self, request, pk: str | None = None):
        """Current user unlikes the reply (idempotent). Mirrors forum unlike handling."""
        assert pk is not None
        reply = self.get_object()
        user = request.user
        try:
            with transaction.atomic():
                deleted, _ = CourseReviewReplyLike.objects.filter(reply=reply, user=user).delete()
                if deleted:
                    CourseReviewReply.objects.filter(pk=reply.pk, likes_count__gt=0).update(likes_count=F("likes_count") - 1)
            reply.refresh_from_db(fields=["likes_count"])
            data = self.get_serializer(reply, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:  # pragma: no cover
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
