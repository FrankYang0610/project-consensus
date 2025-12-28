/**
 * 用户相关类型定义 / User-related type definitions
 */

/**
 * 用户统计信息接口 / User statistics interface
 */
export interface UserStats {
  forumPostsCount: number; // Number of forum posts
  forumPostCommentsCount: number; // Number of forum post comments
  courseReviewsCount: number; // Number of course reviews
  joinedDays: number; // Days since joining
}

/**
 * 公开用户信息接口 / Public user information interface
 * 
 * 用于展示其他用户的公开资料信息，不包含私密字段如 email
 * Used for displaying public profile information of other users, excludes private fields like email
 */
export interface PublicUser {
  id: string; // 用户唯一标识符 / User unique identifier
  nickname: string; // 用户昵称（必填，注册时必须提供） / User nickname (required, must be provided at registration)
  avatar?: string; // 用户头像URL（可选） / User avatar URL (optional)
  pronouns?: string; // 用户代词（可选） / User pronouns (optional)
  showForumPostsPublicly?: boolean; // 是否公开展示自己发的forum posts（可选） / Whether forum posts are shown publicly (optional)
  showForumPostCommentsPublicly?: boolean; // 是否公开展示自己发的forum post comments（可选） / Whether forum post comments are shown publicly (optional)
  showCourseReviewsPublicly?: boolean; // 是否公开展示自己发的course reviews（可选） / Whether course reviews are shown publicly (optional)
  isAccountActive?: boolean; // 账户是否激活（可选） / Whether account is active (optional)
  lastProfileUpdatedAt?: string; // 最后一次修改昵称的时间（ISO格式，可选） / Last nickname update time in ISO format (optional)
  daysUntilNextUpdate?: number | null; // 距离下次可修改昵称还剩多少天（可选，null表示可以立即修改） / Days until next nickname update is allowed (optional, null means can update now)
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
  username: string; // Username (unique identifier for login)
}

/**
 * 作者信息接口 / Author information interface
 */
export interface Author {
  id: string; // 作者唯一标识符 / Author unique identifier
  name: string; // 作者名称 / Author name
  avatar?: string; // 作者头像URL（可选） / Author avatar URL (optional)
}
