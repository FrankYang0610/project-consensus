import { Author } from './user';

/**
 * 论坛相关类型定义 / Forum-related type definitions
 */

/**
 * 论坛帖子接口 / Forum post interface
 */
export interface ForumPost {
  id: string; // 帖子唯一标识符 / Post unique identifier
  title: string; // 帖子标题 / Post title
  content: string; // 帖子内容 / Post content
  author: Author; // 帖子作者 / Post author
  createdAt: string; // 创建时间 / Creation time
  tags: string[]; // 标签列表 / Tags list
  likes: number; // 点赞数量 / Number of likes
  comments: number; // 评论数量 / Number of comments
  isLiked?: boolean; // 当前用户是否已点赞（可选） / Whether current user has liked (optional)
  isAnonymous?: boolean; // 是否匿名发布 / Whether author is anonymous
  isEdited?: boolean; // 是否已编辑 / Whether post has been edited
}

/**
 * 论坛评论接口 / Forum comment interface
 * 设计说明：使用扁平化结构，便于维护和展示
 * - 评论：直接回复帖子（replyTo为undefined）
 * - 回复：回复某条评论（replyTo有值）
 */
export interface ForumPostComment {
  id: string; // 评论唯一标识符 / Comment unique identifier
  content: string; // 评论内容 / Comment content
  author: Author; // 评论作者 / Comment author
  createdAt: string; // 创建时间 / Creation time
  likes: number; // 点赞数量 / Number of likes
  isLiked?: boolean; // 当前用户是否已点赞（可选） / Whether current user has liked (optional)
  replyTo?: string; // 被回复的评论ID：直接回复帖子时无此字段 / The comment ID being replied to; undefined when replying to the post
  postId: string; // 所属帖子ID / Post ID this comment belongs to
  isDeleted?: boolean; // 是否已删除 / Whether comment is deleted
  replies?: number; // 直接回复数量 / Count of direct replies
  isAnonymous?: boolean; // 是否匿名评论 / Whether author is anonymous
  canDelete?: boolean; // 当前用户是否可删除 / Whether current user can delete
}
