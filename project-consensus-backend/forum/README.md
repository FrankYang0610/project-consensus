# Forum App

The Forum app implements posts and two-level comments (main comment + reply). It matches the frontend types `ForumPost` and `ForumPostComment`.

## Models

- `ForumPost`
  - UUID primary key, `title`, `content` (HTML), `author` (FK to User), `created_at`
  - `tags` (JSON list), `language` (string), `likes_count` (int)
  - The session-level field `isLiked` is not stored; it can be derived by adding a Like model later

- `ForumComment`
  - UUID primary key
  - `post` (FK to `ForumPost`)
  - `parent` (nullable self-FK) — null for main comments, non-null for replies
  - `content`, `author` (FK), `reply_to_user` (nullable FK), `created_at`
  - `is_deleted` (soft delete), `likes_count`

## Serializers

- `ForumPostSerializer`
  - Adds `author` payload (from Profile), `likes` (mapped from `likes_count`), `comments` (count), `isLiked` (false placeholder)

- `ForumCommentSerializer`
  - Matches the frontend fields including `parentId`, `postId`, `replyToUser`, and `createdAt`

## ViewSets & Routes

Base path: `/api/forum/` (via DRF Router)

- `/api/forum/posts/`
  - Standard REST actions (list/create/retrieve/update/destroy)
  - Search support on `title`, `content`, `tags` (DRF SearchFilter)

- `/api/forum/comments/`
  - Filter by `?postId=<uuid>` or `?parentId=<uuid>`
  - Standard REST actions (list/create/retrieve/update/destroy)

## Examples

List posts:

```bash
curl 'http://127.0.0.1:8000/api/forum/posts/'
```

List comments under a post:

```bash
curl 'http://127.0.0.1:8000/api/forum/comments/?postId=<post-uuid>'
```

