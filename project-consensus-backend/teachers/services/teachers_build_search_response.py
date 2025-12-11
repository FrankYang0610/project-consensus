from __future__ import annotations

from typing import Sequence
from urllib.parse import urlencode

from rest_framework.request import Request

from teachers.models import Teacher
from teachers.serializers import TeacherSerializer


def build_teachers_splink_response(
    request: Request,
    teachers: Sequence[Teacher],
    query: str,
    page: int,
    page_size: int,
    has_more: bool,
    total_fetched: int,
) -> dict:
    """
    Format Splink teacher search results as a DRF-style page.

    The true total number of matches is unknown because Splink is queried with a
    ``top_k`` limit. When ``has_more`` is True, ``count`` is a conservative
    lower bound (current page upper index + 1); otherwise it equals the number
    of fetched pairs.
    """

    # 1. Serialize teacher objects
    data = TeacherSerializer(teachers, many=True).data

    # 2. Build pagination links
    base_url = request.build_absolute_uri("/api/teachers/search-splink/")

    def get_link(p: int) -> str:
        params = {"q": query, "page": p, "page_size": page_size}
        return f"{base_url}?{urlencode(params)}"

    # 3. Compute conservative count estimate
    if has_more:
        count = page * page_size + 1
    else:
        count = total_fetched

    return {
        "count": int(count),
        "next": get_link(page + 1) if has_more else None,
        "previous": get_link(page - 1) if page > 1 else None,
        "results": data,
    }
