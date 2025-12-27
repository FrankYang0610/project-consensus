"""
Core views for the project consensus backend.

This module provides HTTP endpoints for health checks and base view classes
for user-related content listing.
"""

from django.contrib.auth import get_user_model

from rest_framework.decorators import api_view
from rest_framework.exceptions import NotAuthenticated, NotFound, PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.response import Response

from accounts import error_codes as accounts_error_codes

User = get_user_model()


@api_view(["GET"])
def health(request):
    """Health check endpoint for monitoring and load balancer detection."""
    return Response({"status": "ok"})


class BaseUserContentListView(ListAPIView):
    """
    Generic base view for listing user-generated content (posts, comments, reviews).

    It centralizes the shared control flow for:
    - /api/accounts/my-*/                    (current user's content)
    - /api/accounts/users/<user_id>/*/       (public content of a specific user)

    Subclasses must:
    - set `serializer_class`
    - set `pagination_class`
    - set `privacy_checker` to a callable(viewer, owner) -> bool
    - implement `get_content_queryset(target_user)`
    """

    # Callable with signature privacy_checker(*, viewer, owner) -> bool
    privacy_checker = None

    def get_target_user_and_mode(self):
        """
        Return (target_user, is_public_mode).

        is_public_mode:
        - False when viewing own content via /my-*/ (private view, includes anonymous content)
        - True when viewing via /users/<user_id>/* (public view, hides anonymous content for everyone)
        """
        user_id = self.kwargs.get("user_id")
        request_user = self.request.user

        # Mode 1: /my-*/ – must be authenticated, shows all content including anonymous
        if user_id is None:
            if not request_user.is_authenticated:
                # Keep using our i18n error code for consistency with other auth endpoints.
                raise NotAuthenticated(detail=accounts_error_codes.AUTHENTICATION_REQUIRED)
            return request_user, False

        # Mode 2: /users/<user_id>/* – public profile content (always public view)
        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            # Preserve existing error message used across accounts APIs.
            raise NotFound(detail="User not found")

        is_self = request_user.is_authenticated and request_user.pk == target_user.pk

        # When viewing someone else, enforce per-resource privacy.
        if not is_self:
            checker = self.privacy_checker
            if checker is None:
                raise NotImplementedError("Subclasses of BaseUserContentListView must define `privacy_checker(viewer, owner) -> bool`")
            if not checker(viewer=request_user, owner=target_user):
                # Normalize the privacy error message; specific wording is not important to the frontend.
                raise PermissionDenied(detail="Content is private")

        # Public profile URL always shows public view (hides anonymous content)
        # even for the owner - this lets users preview what others see.
        # Use /my-*/ endpoints for full content including anonymous posts.
        return target_user, True

    def get_content_queryset(self, target_user):
        """
        Subclasses must implement this to return the base queryset for the given target_user.
        """
        raise NotImplementedError("Subclasses must implement get_content_queryset(target_user)")

    def get_queryset(self):  # type: ignore[override]
        target_user, is_public = self.get_target_user_and_mode()
        qs = self.get_content_queryset(target_user)

        # In public mode, hide anonymous content consistently across all user-activity endpoints.
        if is_public:
            qs = qs.filter(is_anonymous=False)
        return qs
