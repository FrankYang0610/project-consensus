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
