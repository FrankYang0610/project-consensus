# Forum Posts & Forum Post Comments

This document describes the initial backend/frontend behavior for forum posts and comments.

## Data model
- Post: `id`, `title`, `content` (HTML), `author`, `createdAt`, `tags`, `likesCount`, `commentsCount`, `isLiked`, `isAnonymous`, `isEdited`
- Comment: `id`, `postId`, `replyTo` (optional comment id), `content` (HTML), `author`, `createdAt`, `likesCount`, `isLiked`, `isDeleted`, `isAnonymous`, `repliesCount`

## Create
- Post: authenticated users can create; HTML is sanitized (forum-specific allowlist; links/images allowed with limited attributes).
- Comment: authenticated users can create on non-deleted posts; replies require a valid non-deleted target comment; invalid `postId` returns 400 `{ postId: "invalid post id" }`; HTML is sanitized.

## Update
- Post: author can update title/content/tags/isAnonymous. When updated, `isEdited` is set to true.
- Comment: editing is not allowed.

## Delete
- Post: author can hard-delete. Behavior: remove the post row; all related comments/replies/likes are deleted via DB CASCADE. Notifications remain intact because they store snapshots and do not depend on FK relations.
- Comment: author can soft-delete. Behavior: set `isDeleted=true`, clear `content`, keep the row and thread structure (used as a placeholder in UI).

## Toggle Like
- **Toggle Like**: `POST /api/forum/posts/{id}/toggle_like/` or `POST /api/forum/comments/{id}/toggle_like/` - Smart toggle: if not liked, creates like; if already liked, removes like. Returns updated object with current `isLiked` and `likesCount`.

### Benefits of Toggle Like:
- **Simplified Frontend Logic**: Single button that toggles between "like" and "unlike" states without tracking the current state client-side.
- **Consistent UX**: Provides predictable behavior regardless of the current like state.
- **Reduced API Complexity**: Eliminates the need for separate like/unlike endpoints and client-side state management.

### Notification Behavior:
- Toggle operations that result in a like send notifications to the content author (excluding self-notifications).
- Toggle operations that result in an unlike do not send notifications.

## Cascading behavior and operations on deleted content
- Creating new comments is blocked on deleted posts.
- Replying to a deleted comment is not allowed.
- Toggle liking deleted comments is not allowed.
- When a post is deleted, all of its comments (including replies of replies, etc.) are removed entirely.
- Soft-deleted comments remain as placeholders in the UI (content cleared, `isDeleted=true`).

## Frontend notes
- Use list/retrieve APIs to display posts (hard-deleted posts are not returned).
- Render deleted comments as placeholders without interactive actions.

### Anonymous author/comment behavior
- When `isAnonymous=true`:
  - For other users, the author is masked as `{ id: anonymous_<random>, name: "Anonymous", avatar: null }`.
  - For the author themselves (authenticated, same `author_id`), the real profile is returned.

### `isLiked` semantics
- Returned as a computed, user-scoped flag for both posts and comments.
- Efficiently annotated in list/detail responses for authenticated users to avoid N+1 queries; otherwise `false`.

## Notifications & navigation
- Notifications are decoupled from forum tables (no FKs) and store `content_preview`/`referenced_content_preview` snapshots plus `metadata`.
- Deleting a post or any comment does NOT delete notifications.
- Clicking a notification targeting a deleted post should show a clear message that the item no longer exists and navigate to a Not Found page for posts.

## Endpoints

### Posts
- List: `GET /api/forum/posts/` (supports `search`, `ordering`, `tags`, `author`, `mine`)
- Retrieve: `GET /api/forum/posts/{id}/`
- Create: `POST /api/forum/posts/`
- Update: `PATCH /api/forum/posts/{id}/` (author only; sets `isEdited=true` on field changes)
- Delete: `DELETE /api/forum/posts/{id}/` (hard delete; cleans up embedded images owned by the author)
- Toggle Like: `POST /api/forum/posts/{id}/toggle_like/` (smart toggle: creates like if not liked, removes like if already liked)

### Comments
- List by post: `GET /api/forum/comments/?postId=<uuid>` (404 if post missing)
- List replies of a comment: `GET /api/forum/comments/?replyTo=<uuid>`
- Create: `POST /api/forum/comments/` (requires `postId`; optional `replyTo`)
- Delete: `DELETE /api/forum/comments/{id}/` (soft delete; clears content, keeps placeholder)
- Edit: not allowed → `PUT/PATCH` return 405
- Toggle Like: `POST /api/forum/comments/{id}/toggle_like/` (smart toggle: creates like if not liked, removes like if already liked; not allowed on deleted comments)

### Comment position helper
- `GET /api/forum/comments/position/?postId=<uuid>&commentId=<uuid>&page_size=<int>`
  - Returns the zero-based index, page number, page size, total count, and convenience page URLs to load up to the anchor.

## Edit & Delete Logic Summary

| Type | Edit Permission | Edit Method | Delete Permission | Delete Method | Special Handling |
|------|----------------|-------------|------------------|---------------|------------------|
| Forum Post | Author | Allowed | Author | Hard Delete | Set `is_edited=true`; clean removed images |
| Forum Post Comment | None | Forbidden | Author | Soft Delete | Clear content, preserve structure |

### Key Design Principles:
1. **Permission Control**: All edit/delete operations require user permission validation
2. **Transaction Safety**: All write operations are executed within transactions
3. **Data Consistency**: Related aggregate data is updated after delete/modify operations
4. **User Experience**: Soft delete preserves structure, hard delete completely cleans up
5. **Notification System**: Delete operations do not affect already sent notifications
