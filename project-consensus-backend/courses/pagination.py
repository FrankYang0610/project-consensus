from __future__ import annotations

from core.pagination import BasePageNumberPagination


class CourseReviewPagination(BasePageNumberPagination):
    """Pagination for course reviews and replies (small result sets)."""
    page_size = 10
    max_page_size = 50


class CourseListPagination(BasePageNumberPagination):
    """Pagination for course list (medium result sets)."""
    page_size = 20


class CourseSearchPagination(BasePageNumberPagination):
    """Pagination for course search results (large result sets)."""
    page_size = 50
    max_page_size = 200
