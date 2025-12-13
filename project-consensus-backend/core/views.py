"""
Core views for the project consensus backend.

This module provides HTTP endpoints for global search and health checks.
Business logic is delegated to the service layer.
"""

from django.contrib.auth import get_user_model

from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.exceptions import NotAuthenticated, NotFound, PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle

from accounts import error_codes as accounts_error_codes

from .search_services import (
    perform_global_search,
    SearchQueryEmptyError,
    SearchQueryTooLongError,
    SearchQueryMaliciousError,
)

# Result limits
MAX_PAGE_SIZE = 100          # Maximum results per page
DEFAULT_PAGE_SIZE = 20       # Default results per page

User = get_user_model()


class SearchRateThrottle(UserRateThrottle):
    """Custom throttle for search endpoint to prevent abuse."""
    scope = 'search'
    rate = '100/hour'  # Allow 100 searches per hour per user


class SearchAnonThrottle(AnonRateThrottle):
    """Custom throttle for anonymous search requests."""
    scope = 'search_anon'
    rate = '50/hour'  # Allow 50 searches per hour for anonymous users


@api_view(["GET"])
def health(request):
    """Health check endpoint for monitoring and load balancer detection."""
    return Response({"status": "ok"})


@api_view(["GET"])
@throttle_classes([SearchRateThrottle, SearchAnonThrottle])
def search(request):
    """
    Global search endpoint using PostgreSQL trigram similarity for better Chinese text search.
    
    Query params:
    - q: search query (required)
    - page: page number (default: 1)
    - page_size: results per page (default: 20, max: 100)
    - types: comma-separated content types to filter
            (course,forum_post,forum_comment,course_review,wiki,teacher,user)
    """
    # Validate and sanitize search query
    raw_query = request.GET.get('q', '').strip()
    if not raw_query:
        return Response({
            "results": [],
            "total": 0,
            "page": 1,
            "page_size": DEFAULT_PAGE_SIZE
        })
    
    try:
        # Parse pagination params
        try:
            page = int(request.GET.get('page', 1))
            page = max(1, page)
        except (ValueError, TypeError):
            page = 1
        
        try:
            page_size = int(request.GET.get('page_size', DEFAULT_PAGE_SIZE))
            page_size = min(max(1, page_size), MAX_PAGE_SIZE)
        except (ValueError, TypeError):
            page_size = DEFAULT_PAGE_SIZE
        
        # Parse type filters
        types_param = request.GET.get('types', '')
        allowed_types = {'course', 'forum_post', 'forum_comment', 'course_review', 'wiki', 'teacher', 'user'}
        if types_param:
            filter_types = set(t.strip() for t in types_param.split(',') if t.strip() in allowed_types)
        else:
            filter_types = allowed_types
        
        # Perform search using service layer
        result = perform_global_search(
            query=raw_query,
            filter_types=filter_types,
            page=page,
            page_size=page_size
        )
        
        return Response(result)
        
    except SearchQueryEmptyError as e:
        return Response({
            "error": "Invalid search query",
            "details": str(e),
            "results": [],
            "total": 0,
            "page": 1,
            "page_size": DEFAULT_PAGE_SIZE
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except SearchQueryTooLongError as e:
        return Response({
            "error": "Search query too long",
            "details": str(e),
            "results": [],
            "total": 0,
            "page": 1,
            "page_size": DEFAULT_PAGE_SIZE
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except SearchQueryMaliciousError as e:
        return Response({
            "error": "Search query contains potentially malicious content",
            "details": str(e),
            "results": [],
            "total": 0,
            "page": 1,
            "page_size": DEFAULT_PAGE_SIZE
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:  # pragma: no cover
        # Log the error in production
        return Response({
            "error": "Internal server error",
            "results": [],
            "total": 0,
            "page": 1,
            "page_size": DEFAULT_PAGE_SIZE
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        - False when viewing own content (including via /users/<self_id>/...)
        - True when viewing someone else's content via /users/<user_id>/...
        """
        user_id = self.kwargs.get("user_id")
        request_user = self.request.user

        # Mode 1: /my-*/ – must be authenticated
        if user_id is None:
            if not request_user.is_authenticated:
                # Keep using our i18n error code for consistency with other auth endpoints.
                raise NotAuthenticated(detail=accounts_error_codes.AUTHENTICATION_REQUIRED)
            return request_user, False

        # Mode 2: /users/<user_id>/* – public profile content
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
            return target_user, True

        # Owner always sees full content (including anonymous) regardless of URL pattern.
        return target_user, False

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
