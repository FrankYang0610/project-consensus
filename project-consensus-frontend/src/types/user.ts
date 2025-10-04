/**
 * 用户相关类型定义 / User-related type definitions
 */

/**
 * 用户统计信息接口 / User statistics interface
 */
export interface UserStats {
  posts: number; // 发帖数量 / Number of posts
  comments: number; // 评论数量 / Number of comments
  reviews: number; // 评价数量 / Number of reviews
  joinedDays: number; // 加入天数 / Days since joining
}

/**
 * 公开用户信息接口 / Public user information interface
 * 
 * 用于展示其他用户的公开资料信息，不包含私密字段如 email
 * Used for displaying public profile information of other users, excludes private fields like email
 */
export interface PublicUser {
  id: string; // 用户唯一标识符 / User unique identifier
  name?: string; // 用户名称（可选） / User name (optional)
  avatar?: string; // 用户头像URL（可选） / User avatar URL (optional)
  pronouns?: string; // 用户代词（可选） / User pronouns (optional)
  showForumPostsPublicly?: boolean; // 是否公开展示自己发的forum posts（可选） / Whether forum posts are shown publicly (optional)
  showForumPostCommentsPublicly?: boolean; // 是否公开展示自己发的forum post comments（可选） / Whether forum post comments are shown publicly (optional)
  showCourseReviewsPublicly?: boolean; // 是否公开展示自己发的course reviews（可选） / Whether course reviews are shown publicly (optional)
  stats?: UserStats; // 用户统计信息（可选） / User statistics (optional)
}

/**
 * 用户信息接口（包含私密信息）/ User information interface (with private information)
 * 
 * 继承自 PublicUser 并添加私密字段如 email
 * 用于当前登录用户的个人资料
 * Extends PublicUser and adds private fields like email
 * Used for the current logged-in user's profile
 */
export interface User extends PublicUser {
  email: string; // 用户邮箱 / User email
}

/**
 * 作者信息接口 / Author information interface
 */
export interface Author {
  id: string; // 作者唯一标识符 / Author unique identifier
  name: string; // 作者名称 / Author name
  avatar?: string; // 作者头像URL（可选） / Author avatar URL (optional)
}
