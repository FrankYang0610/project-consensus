from __future__ import annotations

from core.pagination import BasePageNumberPagination


class TeacherPagination(BasePageNumberPagination):
    """Custom pagination for teachers list."""
    page_size = 20


