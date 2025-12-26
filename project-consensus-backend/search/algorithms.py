"""
Search algorithms and scoring functions.
"""

from django.db.models import Q, F, Value, FloatField, Case, When
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models.functions import Greatest, Coalesce, Substr, Least, Trim, NullIf

# ==================== Search Configuration Constants ====================
"""
Search scoring is based on a weighted combination of:
1. Text similarity (90%): Using PostgreSQL trigram similarity for multi-language support
2. Popularity metrics (10%): Based on likes, views, or review counts

This balance prioritizes relevance while giving a slight boost to popular content.
"""

# Similarity weights for scoring
SIMILARITY_WEIGHT = 0.9  # Weight for text similarity in final score
POPULARITY_WEIGHT = 0.1  # Weight for popularity metrics in final score

# Type-specific similarity weights (for weighted combinations)
FORUM_POST_WEIGHTS = {
    'title': 0.6,      # Title is most important for posts
    'content': 0.35,   # Content is secondary
    'author': 0.05     # Author match is least important
}

# Similarity thresholds based on query length
# Shorter queries need higher thresholds to reduce false positives
SIMILARITY_THRESHOLDS = {
    'very_short': 0.30,  # 1 character queries - strictest
    'short': 0.15,       # 2 character queries - moderate
    'normal': 0.1        # 3+ character queries - most permissive
}

# Query length boundaries
QUERY_LENGTH_VERY_SHORT = 1
QUERY_LENGTH_SHORT = 2

# Popularity normalization divisors
# These values normalize popularity metrics to [0, 1] range
POPULARITY_DIVISORS = {
    'reviews': 100.0,        # 100+ reviews = max popularity
    'likes': 100.0,          # 100+ likes = max popularity
    'views': 1000.0,         # 1000+ views = max popularity
    'user_activity': 100.0   # 100+ posts/reviews = max popularity
}


def get_similarity_threshold(query_length: int) -> tuple[float, bool]:
    """
    Get appropriate similarity threshold and short query flag based on query length.
    
    Args:
        query_length: Length of the search query
        
    Returns:
        Tuple of (threshold, is_short_query)
    """
    if query_length <= QUERY_LENGTH_VERY_SHORT:
        return SIMILARITY_THRESHOLDS['very_short'], True
    elif query_length == QUERY_LENGTH_SHORT:
        return SIMILARITY_THRESHOLDS['short'], True
    else:
        return SIMILARITY_THRESHOLDS['normal'], False


def create_popularity_norm(field_name: str, divisor_key: str):
    """
    Create a popularity normalization expression.
    
    Args:
        field_name: Name of the popularity field (e.g., 'likes_count')
        divisor_key: Key in POPULARITY_DIVISORS dict
        
    Returns:
        Django ORM expression for normalized popularity [0, 1]
    """
    divisor = POPULARITY_DIVISORS.get(divisor_key, 100.0)
    return Least(F(field_name) / Value(divisor), Value(1.0))


def create_final_score_expr():
    """
    Create the final score expression combining similarity and popularity.
    
    Returns:
        Django ORM expression for final score
    """
    return F('similarity') * Value(SIMILARITY_WEIGHT) + F('popularity_norm') * Value(POPULARITY_WEIGHT)


def create_snippet_expr(primary_field: str, fallback_field: str = None, max_length: int = 200):
    """
    Create a snippet extraction expression.
    
    Args:
        primary_field: Primary field to extract snippet from
        fallback_field: Optional fallback field if primary is empty
        max_length: Maximum snippet length
        
    Returns:
        Django ORM expression for snippet
    """
    primary = NullIf(Trim(Substr(primary_field, 1, max_length)), Value(''))
    
    if fallback_field:
        return Coalesce(primary, Substr(fallback_field, 1, max_length), Value(''))
    else:
        return Coalesce(primary, Value(''))


def apply_short_query_filters(queryset, query: str, similarity_threshold: float, 
                                prefix_fields: list, text_fields: list):
    """
    Apply filters for short queries with prefix and text fallbacks.
    
    Args:
        queryset: Django queryset to filter
        query: Search query string
        similarity_threshold: Minimum similarity threshold
        prefix_fields: List of field names for prefix matching
        text_fields: List of field names for text contains matching
        
    Returns:
        Filtered queryset
    """
    # Build prefix filter (istartswith)
    prefix_q = Q()
    for field in prefix_fields:
        prefix_q |= Q(**{f'{field}__istartswith': query})
    
    # Build text fallback filter (icontains)
    text_q = Q()
    for field in text_fields:
        text_q |= Q(**{f'{field}__icontains': query})
    
    # Combine: similarity OR prefix OR text
    return queryset.filter(
        Q(similarity__gte=similarity_threshold) | prefix_q | text_q
    )

