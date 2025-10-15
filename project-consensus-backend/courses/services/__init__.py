from __future__ import annotations

from .course_queries import (
    get_departments_with_counts,
    get_department_level_distribution,
    get_distinct_departments_case_insensitive,
)
from .course_aggregates import (
    delete_review_and_cleanup_images_and_recompute_aggregates,
    soft_delete_reply_and_recompute_counts,
    recompute_course_aggregates_after_review_change,
    recompute_review_replies_count,
    recompute_teachers_aggregates,
)
from .course_image_cleanup import (
    cleanup_removed_images_for_review,
)
from .course_review_create import (
    create_course_review,
)
from .course_review_read import (
    prepare_course_review_for_serialization,
)
from .course_review_update import (
    mark_review_edited_if_fields_changed,
    update_course_review,
)
from .course_review_delete import (
    delete_course_review,
)
from .course_review_reply_create import (
    find_reply_to_user,
    create_course_review_reply,
)
from .course_review_reply_read import (
    find_review_for_reply_id,
)
from .course_review_reply_delete import (
    delete_course_review_reply,
)
from .course_notification import emit_notifications_for_new_reply
from .course_review_like import (
    toggle_course_review_like,
)
from .course_review_reply_like import (
    toggle_course_review_reply_like,
)
from .course_voting import toggle_course_vote

__all__ = [
    # Course Review CRUD
    "create_course_review",
    "prepare_course_review_for_serialization",
    "update_course_review",
    "delete_course_review",
    
    # Course Review Reply CRUD
    "create_course_review_reply",
    "find_review_for_reply_id",
    "delete_course_review_reply",
    
    # Course Review/Reply Utils
    "mark_review_edited_if_fields_changed",
    "find_reply_to_user",
    "toggle_course_review_like",
    "toggle_course_review_reply_like",
    "toggle_course_vote",
    "emit_notifications_for_new_reply",
    
    # Aggregates & Cleanup
    "recompute_teachers_aggregates",
    "recompute_course_aggregates_after_review_change",
    "recompute_review_replies_count",
    "delete_review_and_cleanup_images_and_recompute_aggregates",
    "soft_delete_reply_and_recompute_counts",
    "cleanup_removed_images_for_review",
    
    # Queries
    "get_departments_with_counts",
    "get_department_level_distribution",
    "get_distinct_departments_case_insensitive",
]

