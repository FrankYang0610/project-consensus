from __future__ import annotations

from typing import Any, Optional

from django.contrib.auth import get_user_model

from accounts.models import Profile


User = get_user_model()


def build_forum_author_payload(user: Any) -> dict:
    """Return forum Author payload shape: {id, name, avatar}.

    Uses Profile.author_payload when available; falls back to username.
    """
    try:
        profile: Profile = user.profile  # type: ignore[attr-defined]
        return profile.author_payload
    except Profile.DoesNotExist:  # pragma: no cover
        return {"id": str(user.pk), "name": user.get_username(), "avatar": None}


def build_course_author_payload(user: Any) -> dict:
    """Return course Author payload shape: {id, name, avatarUrl}.

    Course serializers expect camelCase `avatarUrl`.
    """
    try:
        profile: Profile = user.profile  # type: ignore[attr-defined]
        name = profile.nickname or user.get_username()
        avatar_url = profile.avatar_url or None
    except Profile.DoesNotExist:  # pragma: no cover
        name = user.get_username()
        avatar_url = None
    return {"id": str(user.pk), "name": name, "avatarUrl": avatar_url}


def get_anonymous_author_payload() -> dict:
    """Return anonymous author payload for course reviews."""
    return {"id": "", "name": "Anonymous", "avatarUrl": None}


def get_course_review_author_display(review: Any, request_user: Optional[Any] = None) -> dict:
    """Get the appropriate author display for a course review.
    
    Handles anonymous review logic:
    - If review is anonymous and current user is not the author, show anonymous
    - Otherwise show the real author
    
    Args:
        review: CourseReview instance
        request_user: Current request user (optional)
        
    Returns:
        Author payload dict
    """
    if review.is_anonymous and (not request_user or request_user != review.author):
        return get_anonymous_author_payload()
    return build_course_author_payload(review.author)


def get_course_review_reply_author_display(reply: Any, request_user: Optional[Any] = None) -> dict:
    """Get the appropriate author display for a course review reply.
    
    Handles anonymous reply logic:
    - If reply is anonymous and current user is not the author, show anonymous
    - Otherwise show the real author
    
    Args:
        reply: CourseReviewReply instance
        request_user: Current request user (optional)
        
    Returns:
        Author payload dict
    """
    if reply.is_anonymous and (not request_user or request_user != reply.author):
        return get_anonymous_author_payload()
    return build_course_author_payload(reply.author)


