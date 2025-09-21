/**
 * 用户相关类型定义 / User-related type definitions
 */

/**
 * 用户信息接口 / User information interface
 */
export interface User {
  id: string; // 用户唯一标识符 / User unique identifier
  email: string; // 用户邮箱 / User email
  name?: string; // 用户名称（可选） / User name (optional)
  avatar?: string; // 用户头像URL（可选） / User avatar URL (optional)
}

/**
 * 作者信息接口 / Author information interface
 */
export interface Author {
  id: string; // 作者唯一标识符 / Author unique identifier
  name: string; // 作者名称 / Author name
  avatar?: string; // 作者头像URL（可选） / Author avatar URL (optional)
}
