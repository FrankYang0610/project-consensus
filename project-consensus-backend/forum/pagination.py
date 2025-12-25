from __future__ import annotations

from core.pagination import BasePageNumberPagination


class DefaultPageNumberPagination(BasePageNumberPagination):
    """
    Default pagination for forum endpoints (posts, comments, user content).
    """
    page_size = 12


