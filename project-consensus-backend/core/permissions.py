from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.request import Request


class IsAuthorOrReadOnly(BasePermission):
    """Allow read for anyone; write only for the object's author.
    
    Expects the model instance to expose an `author` attribute or `author_id` field.
    """

    def has_permission(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method in SAFE_METHODS:
            return True
        # For create or other non-object actions, require authentication
        user = request.user
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request: Request, view, obj) -> bool:  # type: ignore[override]
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and getattr(obj, "author_id", None) == user.pk)



