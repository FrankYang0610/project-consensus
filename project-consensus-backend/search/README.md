# Search App

Global search functionality for the Project Consensus backend.

## Architecture

The search app follows the service layer pattern:

```
HTTP Request → View (core/views.py) → Service → Model
     ↑                                           ↓
HTTP Response ← Serializer ← Service ← Model
```

## File Structure

```
search/
├── __init__.py           # App initialization
├── apps.py               # Django app configuration
├── exceptions.py         # Search-related exception definitions
├── algorithms.py         # Search scoring and similarity algorithms
├── utils.py              # Search utility functions and validation
├── services.py           # Main search business logic
└── README.md             # This document
```

Note: The `pg_trgm` PostgreSQL extension is enabled via `core/migrations/0001_initial.py`.

## Modules

### `services.py`
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

### `algorithms.py`
**Purpose**: Search scoring algorithms and similarity calculations.

**Key Functions**:
- `get_similarity_threshold()` - Calculate similarity threshold based on query length
- `create_popularity_norm()` - Create popularity normalization expressions
- `create_final_score_expr()` - Create final score combining similarity and popularity
- `create_snippet_expr()` - Create snippet extraction expressions
- `apply_short_query_filters()` - Apply filters for short queries

### `utils.py`
**Purpose**: Search utility functions and input validation.

**Key Functions**:
- `get_author_name()` - Get author display name safely
- `build_search_result()` - Build consistent search result objects
- `truncate_content()` - Truncate content with ellipsis
- `validate_and_sanitize_search_query()` - Validate and sanitize search queries

### `exceptions.py`
**Purpose**: Search-related exception definitions.

**Exception Classes**:
- `SearchError` - Base class for search exceptions
- `SearchValidationError` - Validation-related exceptions
- `SearchQueryEmptyError` - Empty query exceptions
- `SearchQueryTooLongError` - Query too long exceptions
- `SearchQueryMaliciousError` - Malicious content exceptions

## Usage Example

```python
from search.services import perform_global_search
from search.exceptions import SearchQueryEmptyError

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

## Search Algorithm

The search uses PostgreSQL trigram similarity with weighted scoring:

- **Text Similarity (90%)**: Based on trigram similarity for multi-language support
- **Popularity (10%)**: Based on likes, views, or review counts
- **Dynamic Thresholds**: Shorter queries use higher similarity thresholds
- **Fallback Filters**: Short queries also use prefix and text contains matching

This approach prioritizes relevance while giving a slight boost to popular content.

