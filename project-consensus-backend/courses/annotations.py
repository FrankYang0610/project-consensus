from __future__ import annotations

from typing import TYPE_CHECKING
from django.db.models import Exists, OuterRef, QuerySet, Value, BooleanField, CharField

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


def annotate_is_liked(
    qs: QuerySet, 
    like_model: type, 
    fk_name: str, 
    user: AbstractUser | None
) -> QuerySet:
    """Annotate queryset with is_liked field for the given user.
    
    Args:
        qs: The queryset to annotate
        like_model: The like model class (e.g., CourseReviewLike)
        fk_name: The foreign key field name in the like model (e.g., "review")
        user: The user to check likes for (None for anonymous users)
    
    Returns:
        Annotated queryset with is_liked field
    """
    if not user or not user.is_authenticated:
        return qs.annotate(is_liked=Value(False, output_field=BooleanField()))
    
    like_exists = like_model.objects.filter(**{fk_name: OuterRef("pk")}, user=user)
    return qs.annotate(is_liked=Exists(like_exists))


def annotate_user_vote(
    qs: QuerySet,
    vote_model: type,
    fk_name: str,
    user: AbstractUser | None,
    vote_field: str = "value"
) -> QuerySet:
    """Annotate queryset with user vote field.
    
    Args:
        qs: The queryset to annotate
        vote_model: The vote model class (e.g., CourseVote)
        fk_name: The foreign key field name in the vote model (e.g., "course")
        user: The user to check votes for (None for anonymous users)
        vote_field: The field name to extract from vote model
    
    Returns:
        Annotated queryset with user vote field
    """
    if not user or not user.is_authenticated:
        return qs.annotate(_user_vote=Value(None, output_field=CharField(max_length=20)))
    
    vote_sq = (
        vote_model.objects
        .filter(**{fk_name: OuterRef("pk")}, user=user)
        .values(vote_field)[:1]
    )
    return qs.annotate(_user_vote=vote_sq)


def annotate_user_has_review(
    qs: QuerySet,
    review_model: type,
    fk_name: str,
    user: AbstractUser | None
) -> QuerySet:
    """Annotate queryset with user_has_review field.
    
    Args:
        qs: The queryset to annotate
        review_model: The review model class (e.g., CourseReview)
        fk_name: The foreign key field name in the review model (e.g., "course")
        user: The user to check reviews for (None for anonymous users)
    
    Returns:
        Annotated queryset with user_has_review field
    """
    if not user or not user.is_authenticated:
        return qs.annotate(_user_has_review=Value(False, output_field=BooleanField()))
    
    has_review_exists = review_model.objects.filter(**{fk_name: OuterRef("pk")}, author=user)
    return qs.annotate(_user_has_review=Exists(has_review_exists))
