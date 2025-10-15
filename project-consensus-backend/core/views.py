"""
Core views for the project consensus backend.

This module provides HTTP endpoints for global search and health checks.
Business logic is delegated to the service layer.
"""

from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle

from .services import (
    perform_global_search,
    SearchQueryEmptyError,
    SearchQueryTooLongError,
    SearchQueryMaliciousError,
)

# Result limits
MAX_PAGE_SIZE = 100          # Maximum results per page
DEFAULT_PAGE_SIZE = 20       # Default results per page


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