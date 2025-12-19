## Course Reviews & Replies

This document describes the initial behavior for course reviews and replies.

### Data model
- Review: `id`, `courseId`, `author`, `overallRating`, `attributes`, `content` (HTML), `isAnonymous`, `onlyText`, `likesCount`, `isDeleted`, `isEdited`, `createdAt`, `updatedAt`, `term`, `repliesCount`
- Reply: `id`, `reviewId`, `author`, `content` (HTML), `createdAt`, `likes`, `isDeleted`, `replyToUser` (optional)

### Create
- Review: authenticated users can create; HTML is sanitized. When onlyText=true, rating/attributes are omitted and overallRating is saved as 0. One review per user per course.
- Reply: authenticated users can create; review must exist; HTML is sanitized.

### Update
- Review: author can update. When updated, `isEdited` becomes true. If onlyText=true, numeric rating is not updated.
- Reply: editing is not allowed.

### Delete
- Review: author can hard-delete. Behavior: remove the review row; all related replies/likes are deleted via DB CASCADE; recompute the course/teacher aggregates; increment the `Course.deleted_reviews_count` counter.
- Reply: author can soft-delete. Behavior: set `isDeleted=true`, clear `content`, keep the row; the parent review's `repliesCount` is recomputed.

### Toggle Like
- **Toggle Like**: `POST /api/reviews/{id}/toggle_like/` or `POST /api/replies/{id}/toggle_like/` - Smart toggle: if not liked, creates like; if already liked, removes like. Returns updated object with current `isLiked` and `likesCount`.

#### Toggle Like Benefits:
- **Frontend UI**: Single button that toggles between "like" and "unlike" states without tracking the current state client-side.
- **Simplified Logic**: Avoids the need to check `isLiked` before deciding whether to call `like` or `unlike`.
- **Consistent UX**: Provides predictable behavior regardless of the current like state.
- **Reduced API Surface**: Only one endpoint needed instead of separate like/unlike endpoints.

#### Notification Behavior:
- Like operations (including toggle that results in a like) send notifications to the content author (excluding self-notifications).
- Unlike operations (including toggle that results in an unlike) do not send notifications.

### Cascading behavior and operations on deleted content
- When a review is deleted, all of its replies are removed entirely.
- Soft-deleted replies remain as placeholders in the UI (content cleared, `isDeleted=true`).

### Notifications & navigation
- Notifications are decoupled from course review tables (no FKs) and store `content_preview`/`referenced_content_preview` snapshots plus `metadata`.
- Deleting a review or any reply does NOT delete notifications.
- Clicking a notification that targets a deleted review or reply should show a clear message that the item no longer exists.

## Edit & Delete Logic Summary

| Type | Edit Permission | Edit Method | Delete Permission | Delete Method | Special Handling |
|------|----------------|-------------|------------------|---------------|------------------|
| Course Review | Author/Admin | Allowed | Author/Admin | Hard Delete | Recompute rating aggregates |
| Course Review Reply | None | Forbidden | Author/Admin | Soft Delete | Recompute reply count |

#### Key Design Principles:
1. **Permission Control**: All edit/delete operations require user permission validation
2. **Transaction Safety**: All write operations are executed within transactions
3. **Data Consistency**: Related aggregate data is updated after delete/modify operations
4. **User Experience**: Soft delete preserves structure, hard delete completely cleans up
5. **Notification System**: Delete operations do not affect already sent notifications

