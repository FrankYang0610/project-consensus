import { User } from './user';

// Re-export User type for convenience
export type { User };

/**
 * 应用全局状态相关类型定义 / App global state related type definitions
 */

/**
 * 主题模式类型 / Theme mode type
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 语言类型 / Language type (BCP 47 标准格式)
 */
export type Language = 'zh-CN' | 'zh-HK' | 'en-US';

/**
 * 应用上下文类型 / Application context type
 */
export interface AppContextType {
  // 用户认证状态 / User authentication state
  user: User | null; // 当前用户信息 / Current user information
  isLoggedIn: boolean; // 是否已登录 / Whether user is logged in
  login: (userData: User, token: string) => void; // 登录函数 / Login function
  logout: () => void; // 登出函数 / Logout function
  updateUser?: (updates: Partial<User>) => void; // 更新当前用户信息（可选，前端本地） / Update current user info (optional, frontend-local)

  // 主题设置 / Theme settings
  theme: ThemeMode; // 主题模式 / Theme mode
  setTheme: (theme: ThemeMode) => void; // 设置主题函数 / Set theme function

  // 加载状态 / Loading states
  isLoading: boolean; // 认证加载状态 / Auth loading state
  globalLoading: boolean; // 全局加载状态 / Global loading state
  setGlobalLoading: (loading: boolean) => void; // 设置全局加载状态函数 / Set global loading state function
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
