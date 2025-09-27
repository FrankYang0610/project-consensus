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
  language: string; // 帖子语言 / Post language
}

/**
 * 论坛评论接口 / Forum comment interface
 * 设计说明：使用扁平化两级结构，便于维护和展示
 * - 主评论：直接回复帖子（parentId为undefined）
 * - 子评论：回复主评论或其他子评论（parentId有值）
 * - 子评论之间平级，通过replyToUser记录回复的是谁
 */
export interface ForumPostComment {
  id: string; // 评论唯一标识符 / Comment unique identifier
  content: string; // 评论内容 / Comment content
  author: Author; // 评论作者 / Comment author
  createdAt: string; // 创建时间 / Creation time
  likes: number; // 点赞数量 / Number of likes
  isLiked?: boolean; // 当前用户是否已点赞（可选） / Whether current user has liked (optional)
  parentId?: string; // 所属主评论ID，如果是直接回复帖子则为undefined / Parent main comment ID, undefined if replying to post
  postId: string; // 所属帖子ID / Post ID this comment belongs to
  isDeleted?: boolean; // 是否已删除 / Whether comment is deleted
  replyToUser?: Author; // 回复的目标用户，仅子评论有此字段 / Target user being replied to, only for sub-comments
  repliesCount?: number; // 直接子回复数量 / Number of direct replies
  mainCommentId?: string; // 顶层主评论ID（仅子评论会携带）/ Top-level main comment ID (only for replies)
}
