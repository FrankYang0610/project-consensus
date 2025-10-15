# Course Services

This directory contains service layer functions for course-related business logic. Services encapsulate complex operations, data transformations, and cross-cutting concerns while keeping views thin and focused on HTTP handling.

## Core Services

### `course_aggregates.py`
**Purpose**: Manages course and teacher rating aggregates and review counts.

**Key Functions**:
- `recompute_course_aggregates_after_review_change()` - Updates course ratings after review changes
- `recompute_teachers_aggregates()` - Updates teacher ratings when course reviews change
- `recompute_review_replies_count()` - Updates reply counts for reviews
- `delete_review_and_cleanup_images_and_recompute_aggregates()` - Hard deletes reviews with image cleanup and recomputes aggregates
- `soft_delete_reply_and_recompute_counts()` - Soft deletes replies and updates counts

### `course_utils.py`
**Purpose**: Utility functions for course-related data retrieval and user interaction checks.

**Key Functions**:
- `get_related_teacher_courses()` - Finds courses with same subject code but different course ID
- `get_user_vote_for_course()` - Retrieves user's vote for a course
- `get_user_has_review_for_course()` - Checks if user has reviewed a course
- `get_user_liked_review()` - Checks if user liked a review
- `get_user_liked_reply()` - Checks if user liked a reply

### `course_queries.py`
**Purpose**: Database query functions for course statistics and department data.

**Key Functions**:
- `get_departments_with_counts()` - Returns departments with course counts
- `get_department_level_distribution()` - Returns level distribution for a department
- `get_distinct_departments_case_insensitive()` - Returns case-insensitive department list

### `course_filters.py`
**Purpose**: Query parameter parsing and filtering for course lists.

**Key Features**:
- `CourseFilter` class for parsing and applying filters
- Supports filtering by subject code, teacher, category, department, level, etc.
- Handles multi-value parameters and comma-separated values
- Includes validation and sanitization

## Course Review Management Services

### `course_review_create.py`
**Purpose**: Handles course review creation with business logic validation.

**Key Functions**:
- `create_course_review()` - Creates new reviews with duplicate prevention
- Includes HTML sanitization and aggregate updates

### `course_review_update.py`
**Purpose**: Manages course review updates and modifications.

### `course_review_delete.py`
**Purpose**: Handles course review deletion operations.

### `course_review_read.py`
**Purpose**: Manages course review retrieval and reading operations.

### `course_review_like.py`
**Purpose**: Handles course review like/unlike functionality.

## Course Review Reply Services

### `course_review_reply_create.py`
**Purpose**: Manages creation of replies to course reviews.

### `course_review_reply_update.py`
**Purpose**: Handles updates to course review replies.

### `course_review_reply_delete.py`
**Purpose**: Manages deletion of course review replies.

### `course_review_reply_read.py`
**Purpose**: Handles retrieval of course review replies.

### `course_review_reply_like.py`
**Purpose**: Manages like/unlike functionality for review replies.

## Supporting Services

### `course_voting.py`
**Purpose**: Manages course recommendation voting system.

**Key Functions**:
- `toggle_course_vote()` - Handles vote creation, removal, and switching
- Updates recommendation counters atomically

### `course_notification.py`
**Purpose**: Emits notifications for course-related events.

**Key Functions**:
- `emit_notifications_for_new_reply()` - Notifies users of new replies
- `emit_notification_for_review_like()` - Notifies review authors of likes
- `emit_notification_for_reply_like()` - Notifies reply authors of likes

### `course_image_cleanup.py`
**Purpose**: Manages image cleanup for course reviews and replies.

**Key Functions**:
- `cleanup_removed_images_for_review()` - Cleans up images removed during review updates
- `cleanup_removed_images_for_reply()` - Cleans up images removed during reply updates
- `delete_review_images()` - Deletes all images when hard deleting reviews
- `delete_reply_images()` - Deletes all images when soft deleting replies

### `course_review_utils.py`
**Purpose**: Utility functions for course review operations.

### `course_exceptions.py`
**Purpose**: Custom exception classes for course service layer.

**Exception Types**:
- `ServiceError` - Base service error class
- `ValidationError` - Validation-related errors
- `AlreadyReviewedError` - Duplicate review attempts
- `InvalidVoteTypeError` - Invalid vote values
- `NotFoundError` - Resource not found errors
- `CourseNotFoundError`, `ReviewNotFoundError`, `ReplyNotFoundError` - Specific not found errors
- `InvalidOperationError` - Invalid domain operations

## Design Principles

1. **Separation of Concerns**: Services handle business logic while views focus on HTTP concerns
2. **Atomic Operations**: Critical operations use database transactions
3. **Error Handling**: Custom exceptions provide clear error semantics
4. **Performance**: Optimized queries with proper prefetching and annotations
5. **Data Integrity**: Aggregate updates ensure consistency across related models
6. **Image Management**: Proper cleanup of uploaded images to prevent storage bloat
7. **Notifications**: Best-effort notification emission that doesn't block business flow

## Usage

Services are typically called from view functions and should be imported as needed:

```python
from .services.course_review_create import create_course_review
from .services.course_exceptions import AlreadyReviewedError

try:
    review = create_course_review(user, course, payload)
except AlreadyReviewedError:
    # Handle duplicate review
```
