from __future__ import annotations

from rest_framework.pagination import PageNumberPagination


class CourseReviewPagination(PageNumberPagination):
    """Pagination for course reviews and replies (small result sets)."""
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class CourseListPagination(PageNumberPagination):
    """Pagination for course list (medium result sets)."""
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class CourseSearchPagination(PageNumberPagination):
    """Pagination for course search results (large result sets)."""
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200
