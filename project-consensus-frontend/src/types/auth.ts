import { User } from './user';

/**
 * 认证相关类型定义 / Authentication-related type definitions
 */

/**
 * 认证上下文类型 / Authentication context type
 */
export interface AuthContextType {
    user: User | null; // 当前用户信息 / Current user information
    isLoading: boolean; // 加载状态 / Loading state
    login: (userData: User, token: string) => void; // 登录函数 / Login function
    logout: () => void; // 登出函数 / Logout function
    isLoggedIn: boolean; // 是否已登录 / Whether user is logged in
}

/**
 * 登录响应类型 / Login response type
 */
export interface LoginResponse {
    success: boolean; // 登录是否成功 / Whether login is successful
    user?: User; // 用户信息（可选） / User information (optional)
    token?: string; // 认证令牌（可选） / Authentication token (optional)
    message?: string; // 响应消息（可选） / Response message (optional)
}
