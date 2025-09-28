# Forum App

The Forum app implements posts and flat comments with optional replies via `replyTo`. It matches the frontend types `ForumPost` and `ForumPostComment`.

## Models

- `ForumPost`
  - UUID primary key, `title`, `content` (HTML), `author` (FK to User), `created_at`
  - `tags` (JSON list), `language` (string), `likes_count` (int)
  - The session-level field `isLiked` is not stored; it can be derived by adding a Like model later

- `ForumPostComment`
  - UUID primary key
  - `post` (FK to `ForumPost`)
  - `reply_to` (nullable self-FK) — null for comments replying to the post; non-null for replies to another comment
  - `content`, `author` (FK), `created_at`
  - `is_deleted` (soft delete), `likes_count`

## Serializers

- `ForumPostSerializer`
  - Adds `author` (from Profile), `likes` (mapped from `likes_count`), `comments` (count), `isLiked` (session-derived)

- `ForumPostCommentSerializer`
  - Fields: `id`, `content`, `author`, `createdAt`, `likes`, `isDeleted`, `replyTo`, `postId`
  - Does not expose the replied-to user. Use `replyTo` on the frontend to locate parent comment
  - Common filters:
    - Comments under post: `/api/forum/comments/?postId=<postId>`
    - Direct replies of a comment: `/api/forum/comments/?replyTo=<commentId>`

## ViewSets & Routes

Base path: `/api/forum/` (via DRF Router)

- `/api/forum/posts/`
  - Standard REST actions (list/create/retrieve/update/destroy)
  - Search support on `title`, `content`, `tags` (DRF SearchFilter)

- `/api/forum/comments/`
  - Filter by `?postId=<uuid>` or `?replyTo=<uuid>`
  - Standard REST actions (list/create/retrieve/update/destroy)
  - Default ordering: ascending by `created_at` (oldest first). This allows the frontend to render a flat, chronological feed where comments and replies are shown together by time.

## Examples

List posts:

```bash
curl 'http://127.0.0.1:8000/api/forum/posts/'
```

List comments under a post:

```bash
curl 'http://127.0.0.1:8000/api/forum/comments/?postId=<post-uuid>'
```

