# Global Search Services

This directory contains **global search service layer** functions for core-related business logic. These services encapsulate complex search operations, data transformations, and cross-cutting concerns while keeping views thin and focused on HTTP handling.

## Architecture

The service layer follows the same pattern as `courses` and `forum` apps:

```
HTTP Request → View → Service → Model
     ↑                           ↓
HTTP Response ← Serializer ← Service ← Model
```

## File Structure

```
search_services/
├── __init__.py                    # Public API exports
├── search_exceptions.py           # Search-related exception definitions
├── search_algorithms.py           # Search scoring and similarity algorithms
├── search_utils.py                # Search utility functions and validation
├── search_services.py             # Main search business logic
└── README.md                      # This document
```

## Global Search Services

### `search_services.py`
**Purpose**: Main search business logic and orchestration.

**Key Functions**:
- `perform_global_search()` - Main entry point for global search
- `search_courses()` - Search in Course model
- `search_forum_posts()` - Search in ForumPost model
- `search_forum_comments()` - Search in ForumPostComment model
- `search_course_reviews()` - Search in CourseReview model
- `search_wiki_pages()` - Search in WikiPage model
- `search_teachers()` - Search in Teacher model
- `search_users()` - Search in User/Profile model

### `search_algorithms.py`
**Purpose**: Search scoring algorithms and similarity calculations.

**Key Functions**:
- `get_similarity_threshold()` - Calculate similarity threshold based on query length
- `create_popularity_norm()` - Create popularity normalization expressions
- `create_final_score_expr()` - Create final score combining similarity and popularity
- `create_snippet_expr()` - Create snippet extraction expressions
- `apply_short_query_filters()` - Apply filters for short queries

### `search_utils.py`
**Purpose**: Search utility functions and input validation.

**Key Functions**:
- `get_author_name()` - Get author display name safely
- `build_search_result()` - Build consistent search result objects
- `truncate_content()` - Truncate content with ellipsis
- `validate_and_sanitize_search_query()` - Validate and sanitize search queries

### `search_exceptions.py`
**Purpose**: Search-related exception definitions.

**Exception Classes**:
- `SearchError` - Base class for search exceptions
- `SearchValidationError` - Validation-related exceptions
- `SearchQueryEmptyError` - Empty query exceptions
- `SearchQueryTooLongError` - Query too long exceptions
- `SearchQueryMaliciousError` - Malicious content exceptions

## Usage Example

```python
from core.search_services import perform_global_search, SearchQueryEmptyError

try:
    result = perform_global_search(
        query="machine learning",
        filter_types={'course', 'forum_post'},
        page=1,
        page_size=20
    )
    return Response(result)
except SearchQueryEmptyError as e:
    return Response({"error": str(e)}, status=400)
```

## Benefits of Service Layer

1. **Separation of Concerns**: Views handle HTTP, services handle business logic
2. **Testability**: Business logic can be unit tested independently
3. **Reusability**: Services can be used by multiple views or other services
4. **Maintainability**: Complex logic is organized and easier to modify
5. **Consistency**: Follows the same pattern as other apps in the project

## Search Algorithm

The search uses PostgreSQL trigram similarity with weighted scoring:

- **Text Similarity (90%)**: Based on trigram similarity for multi-language support
- **Popularity (10%)**: Based on likes, views, or review counts
- **Dynamic Thresholds**: Shorter queries use higher similarity thresholds
- **Fallback Filters**: Short queries also use prefix and text contains matching

This approach prioritizes relevance while giving a slight boost to popular content.
