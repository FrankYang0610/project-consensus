# 论坛模块（Forum App）

本模块实现帖子与两层评论（主评论 + 回复），与前端 `ForumPost` 和 `ForumPostComment` 类型对齐。

## 模型（Models）

- `ForumPost`
  - 主键 UUID、`title`、`content`（HTML）、`author`（外键到用户）、`created_at`
  - `tags`（JSON 列表）、`language`（字符串）、`likes_count`（整型）
  - 会话态字段 `isLiked` 不入库，后续可通过点赞表计算

- `ForumComment`
  - 主键 UUID
  - `post`（外键到 `ForumPost`）
  - `parent`（可空自关联）—— 为空表示主评论，非空表示某条评论的回复
  - `content`、`author`（外键）、`reply_to_user`（可空外键）、`created_at`
  - `is_deleted`（软删除）、`likes_count`

## 序列化（Serializers）

- `ForumPostSerializer`
  - 输出 `author`（来自 Profile）、`likes`（映射自 `likes_count`）、`comments`（评论数量）、`isLiked`（占位）

- `ForumCommentSerializer`
  - 输出字段对齐前端：`parentId`、`postId`、`replyToUser`、`createdAt` 等

## 视图与路由（ViewSets & Routes）

基础路径：`/api/forum/`（DRF Router）

- `/api/forum/posts/`
  - 标准 REST 操作（list/create/retrieve/update/destroy）
  - 支持 `title`、`content`、`tags` 搜索（DRF SearchFilter）

- `/api/forum/comments/`
  - 通过 `?postId=<uuid>` 或 `?parentId=<uuid>` 过滤
  - 标准 REST 操作（list/create/retrieve/update/destroy）

## 示例（Examples）

列出帖子：

```bash
curl 'http://127.0.0.1:8000/api/forum/posts/'
```

列出某帖子下的评论：

```bash
curl 'http://127.0.0.1:8000/api/forum/comments/?postId=<post-uuid>'
```
