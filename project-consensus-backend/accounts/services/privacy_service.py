from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from accounts.models import Profile


User = get_user_model()
UserLike = User | AnonymousUser


def _get_profile(user: User | None) -> Profile | None:
    if user is None:
        return None
    try:
        return user.profile
    except Profile.DoesNotExist:
        return None


def can_view_forum_posts(*, viewer: UserLike, owner: User) -> bool:
    """Return True if `viewer` is allowed to see `owner`'s forum posts."""
    if viewer.is_authenticated and viewer.pk == owner.pk:
        return True
    profile = _get_profile(owner)
    return profile.show_forum_posts_publicly if profile else True


def can_view_forum_comments(*, viewer: UserLike, owner: User) -> bool:
    """Return True if `viewer` is allowed to see `owner`'s forum comments."""
    if viewer.is_authenticated and viewer.pk == owner.pk:
        return True
    profile = _get_profile(owner)
    return profile.show_forum_post_comments_publicly if profile else True


def can_view_course_reviews(*, viewer: UserLike, owner: User) -> bool:
    """Return True if `viewer` is allowed to see `owner`'s course reviews."""
    if viewer.is_authenticated and viewer.pk == owner.pk:
        return True
    profile = _get_profile(owner)
    return profile.show_course_reviews_publicly if profile else True
