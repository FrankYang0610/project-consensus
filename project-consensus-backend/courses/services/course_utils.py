from __future__ import annotations

from typing import Any
from functools import wraps

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.response import Response

from ..models import Course, CourseVote, CourseReview, CourseReviewLike, CourseReviewReply, CourseReviewReplyLike
from .course_exceptions import (
    ServiceError, 
    ValidationError as ServiceValidationError,
    NotFoundError
)

User = get_user_model()


def get_related_teacher_courses(course: Course) -> list[dict[str, Any]]:
    """Get other courses with the same subject_code but different course_id.
    
    This function extracts the complex query logic from the serializer to make it
    reusable and testable. It returns a list of course dictionaries with teacher
    information and ratings.
    
    Args:
        course: The course to find related courses for
        
    Returns:
        List of dictionaries containing course information with teacher details
    """
    # Other courses with the same subject_code but different course_id
    qs = (
        Course.objects
        .filter(subject_code=course.subject_code)
        .exclude(course_id=course.course_id)
        .prefetch_related("teachers")
    )
    
    result = []
    for c in qs:
        teacher = next(iter(c.teachers.all()), None)
        payload = {
            "courseId": str(c.course_id),
            "teacherName": getattr(teacher, "name", "Unknown"),
            "teacherAvatarUrl": (getattr(teacher, "avatar_url", None) or None) if teacher else None,
            "rating": {
                "score": c.rating_score,
                "reviewsCount": c.rating_reviews_count,
            },
            "attributes": {
                "difficulty": c.attr_difficulty,
                "workload": c.attr_workload,
                "grading": c.attr_grading,
                "gain": c.attr_gain,
            },
        }
        result.append(payload)
    
    return result


def get_user_vote_for_course(course: Course, user: User | None) -> str | None:
    """Get the user's vote for a course.
    
    Args:
        course: The course to check vote for
        user: The user to check vote for (can be None for anonymous users)
        
    Returns:
        The vote value ('recommend' or 'notRecommend') or None if no vote
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None
    
    # Prefer annotated value to avoid N+1 in lists
    annotated = getattr(course, "_user_vote", None)
    if annotated:
        return annotated
    
    # Fallback single lookup (detail view)
    vote = (
        CourseVote.objects
        .filter(user=user, course=course)
        .values_list("value", flat=True)
        .first()
    )
    return vote or None


def get_user_has_review_for_course(course: Course, user: User | None) -> bool:
    """Check if user has posted a review for the course.
    
    Args:
        course: The course to check review for
        user: The user to check review for (can be None for anonymous users)
        
    Returns:
        True if user has a review for this course, False otherwise
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    
    # Prefer annotated value to avoid extra query
    annotated = getattr(course, "_user_has_review", None)
    if annotated is not None:
        return bool(annotated)
    
    # Fallback for cases where annotation is not available
    return CourseReview.objects.filter(course=course, author=user).exists()


def get_user_liked_review(review: CourseReview, user: User | None) -> bool:
    """Check if user has liked a course review.
    
    Args:
        review: The review to check like for
        user: The user to check like for (can be None for anonymous users)
        
    Returns:
        True if user has liked this review, False otherwise
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    
    # Prefer annotated flag to avoid per-object queries
    annotated = getattr(review, "is_liked", None)
    if annotated is not None:
        return bool(annotated)
    
    return CourseReviewLike.objects.filter(review=review, user=user).exists()


def get_user_liked_reply(reply: CourseReviewReply, user: User | None) -> bool:
    """Check if user has liked a course review reply.
    
    Args:
        reply: The reply to check like for
        user: The user to check like for (can be None for anonymous users)
        
    Returns:
        True if user has liked this reply, False otherwise
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    
    # Prefer annotated flag to avoid per-object queries
    annotated = getattr(reply, "is_liked", None)
    if annotated is not None:
        return bool(annotated)
    
    return CourseReviewReplyLike.objects.filter(reply=reply, user=user).exists()


def handle_service_error(func):
    """Decorator to handle ServiceError exceptions and convert to appropriate HTTP responses."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ServiceValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except NotFoundError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except ServiceError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return wrapper
