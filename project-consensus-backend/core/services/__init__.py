# Core Services
# 
# This directory contains service layer functions for core-related business logic.
# Services encapsulate complex operations, data transformations, and cross-cutting concerns
# while keeping views thin and focused on HTTP handling.

from .search_exceptions import (
    SearchValidationError,
    SearchQueryTooLongError,
    SearchQueryEmptyError,
    SearchQueryMaliciousError,
)

from .search_services import (
    perform_global_search,
    search_courses,
    search_forum_posts,
    search_forum_comments,
    search_course_reviews,
    search_wiki_pages,
    search_teachers,
    search_users,
)

from .search_algorithms import (
    get_similarity_threshold,
    create_popularity_norm,
    create_final_score_expr,
    create_snippet_expr,
    apply_short_query_filters,
)

from .search_utils import (
    get_author_name,
    build_search_result,
    truncate_content,
    validate_and_sanitize_search_query,
)

__all__ = [
    # Exceptions
    "SearchValidationError",
    "SearchQueryTooLongError", 
    "SearchQueryEmptyError",
    "SearchQueryMaliciousError",
    
    # Main search services
    "perform_global_search",
    "search_courses",
    "search_forum_posts", 
    "search_forum_comments",
    "search_course_reviews",
    "search_wiki_pages",
    "search_teachers",
    "search_users",
    
    # Search algorithms
    "get_similarity_threshold",
    "create_popularity_norm",
    "create_final_score_expr", 
    "create_snippet_expr",
    "apply_short_query_filters",
    
    # Utilities
    "get_author_name",
    "build_search_result",
    "truncate_content",
    "validate_and_sanitize_search_query",
]
