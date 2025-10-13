# Forum Posts & Forum Post Comments

This document describes the initial backend/frontend behavior for forum posts and comments.

## Data model
- Post: `id`, `title`, `content` (HTML), `author`, `createdAt`, `tags`, `likesCount`, `isAnonymous`, `isEdited`
- Comment: `id`, `postId`, `replyTo` (optional comment id), `content` (HTML), `author`, `createdAt`, `likes`, `isDeleted`, `isAnonymous`, `replies` (count)

## Create
- Post: authenticated users can create; HTML is sanitized.
- Comment: authenticated users can create on non-deleted posts; replies require a valid non-deleted target comment; HTML is sanitized.

## Update
- Post: author can update title/content/tags/isAnonymous. When updated, `isEdited` is set to true.
- Comment: editing is not allowed.

## Delete
- Post: author can hard-delete. Behavior: remove the post row; all related comments/replies/likes are deleted via DB CASCADE. Notifications remain intact because they store snapshots and do not depend on FK relations.
- Comment: author can soft-delete. Behavior: set `isDeleted=true`, clear `content`, keep the row and thread structure (used as a placeholder in UI).

## Cascading behavior and operations on deleted content
- Creating new comments is blocked on deleted posts.
- Replying to a deleted comment is not allowed.
- Liking/unliking deleted comments is not allowed.
- When a post is deleted, all of its comments (including replies of replies, etc.) are removed entirely.
- Soft-deleted comments remain as placeholders in the UI (content cleared, `isDeleted=true`).

## Frontend notes
- Use list/retrieve APIs to display posts (hard-deleted posts are not returned).
- Render deleted comments as placeholders without interactive actions.

## Notifications & navigation
- Notifications are decoupled from forum tables (no FKs) and store `content_preview`/`referenced_content_preview` snapshots plus `metadata`.
- Deleting a post or any comment does NOT delete notifications.
- Clicking a notification targeting a deleted post should show a clear message that the item no longer exists and navigate to a Not Found page for posts.

## Edit & Delete Logic Summary

| Type | Edit Permission | Edit Method | Delete Permission | Delete Method | Special Handling |
|------|----------------|-------------|------------------|---------------|------------------|
| Forum Post | Author | Allowed | Author | Hard Delete | Set `is_edited=True` |
| Forum Post Comment | None | Forbidden | Author | Soft Delete | Clear content, preserve structure |

### Key Design Principles:
1. **Permission Control**: All edit/delete operations require user permission validation
2. **Transaction Safety**: All write operations are executed within transactions
3. **Data Consistency**: Related aggregate data is updated after delete/modify operations
4. **User Experience**: Soft delete preserves structure, hard delete completely cleans up
5. **Notification System**: Delete operations do not affect already sent notifications
