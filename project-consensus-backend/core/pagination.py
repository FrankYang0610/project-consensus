from __future__ import annotations

from django.core.paginator import Paginator
from django.utils.functional import cached_property
from django.core.cache import cache
from rest_framework.pagination import PageNumberPagination
import hashlib

# MARK: The caching paginator is not in use yet. This may be useful in the future.
class CachingPaginator(Paginator):
    """
    A custom Paginator that caches the count attribute.
    """
    _count_timeout = 60  # 1 minute

    @cached_property
    def count(self):
        query_string = str(self.object_list.query) 
        query_hash = hashlib.md5(query_string.encode('utf-8')).hexdigest()
        cache_key = f'paginator_count_{query_hash}'

        cached_count = cache.get(cache_key)
        if cached_count is not None:
            return cached_count

        count = super().count

        cache.set(cache_key, count, self._count_timeout)
        return count


class BasePageNumberPagination(PageNumberPagination):
    """
    Base pagination class for all apps.
    """
    page_size_query_param = "page_size"
    max_page_size = 100


