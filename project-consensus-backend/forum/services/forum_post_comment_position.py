from __future__ import annotations

from typing import Dict, List, Optional

from ..models import ForumPost, ForumPostComment


class CommentDoesNotBelongToPostError(Exception):
    """Raised when the given comment does not belong to the given post."""


def compute_forum_post_comment_position(
    *,
    post_id: str,
    comment_id: str,
    page_size_param: Optional[str],
    default_page_size: int,
    max_page_size: int,
) -> Dict[str, object]:
    """Compute anchor position info for a comment within its post feed.

    The ordering semantics follow the API list endpoint:
    - ordered by created_at ASC, then id ASC

    Returns a payload dict compatible with the existing API response:
    {
        "index": int,
        "page": int,
        "pageSize": int,
        "countBefore": int,
        "pagesBefore": int,
        "totalCount": int,
        "pageUrls": list[str],
    }

    Raises:
        ForumPostComment.DoesNotExist: if the comment is missing.
        ForumPost.DoesNotExist: if the parent post is missing.
        CommentDoesNotBelongToPostError: if comment.post_id != post_id.
    """
    # Fetch target comment with minimal fields
    target = ForumPostComment.objects.only("id", "created_at", "post_id").get(pk=comment_id)

    # Ensure the comment belongs to the given post
    if str(target.post_id) != str(post_id):
        raise CommentDoesNotBelongToPostError()

    # Ensure the parent post exists (defensive; should normally exist if the FK is valid)
    if not ForumPost.objects.filter(pk=post_id).exists():
        raise ForumPost.DoesNotExist()

    base_qs = ForumPostComment.objects.filter(post_id=post_id)

    # Count of items strictly before the target by ordering (created_at asc, id asc)
    less_count = base_qs.filter(created_at__lt=target.created_at).count()
    tie_count = base_qs.filter(created_at=target.created_at, id__lte=target.id).count()
    index = max(less_count + tie_count - 1, 0)

    total_count = base_qs.count()

    # Determine page size, clamped between 1 and max_page_size
    try:
        page_size = int(page_size_param) if page_size_param else int(default_page_size)
    except (TypeError, ValueError):
        page_size = int(default_page_size)
    page_size = max(1, min(page_size, int(max_page_size)))

    page = index // page_size + 1
    pages_before = max(page - 1, 0)

    # Convenience URLs for pages 1..page (relative path)
    page_urls: List[str] = [
        f"/api/forum/comments/?postId={post_id}&page={i}&page_size={page_size}"
        for i in range(1, page + 1)
    ]

    return {
        "index": index,
        "page": page,
        "pageSize": page_size,
        "countBefore": index,
        "pagesBefore": pages_before,
        "totalCount": total_count,
        "pageUrls": page_urls,
    }

