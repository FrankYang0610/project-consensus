'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AppContextType, ThemeMode } from '@/types';
import { getCookie, getAPIBaseUrl } from '@/lib/utils';
import { normalizeLanguage, defaultLanguage } from '@/lib/locale';
import { useTranslation } from 'react-i18next';

// Create Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// App Provider 组件 / App Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  // 所有 hooks 必须在组件顶层以固定顺序调用
  // All hooks must be called at the top level in a fixed order
  
  // 获取 i18n 实例 / Get i18n instance
  const { i18n } = useTranslation();

  // 用户认证状态 / User authentication state
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 登录弹窗控制 / Login modal control
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // 主题设置 / Theme settings
  const [theme, setThemeState] = useState<ThemeMode>('system');

  // 全局加载状态 / Global loading state
  const [globalLoading, setGlobalLoading] = useState(false);

  const clearStorageData = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('theme');
  }, []);

  const applyTheme = useCallback(() => {
    const root = document.documentElement;
    let effectiveTheme = theme;

    // 处理系统主题 / Handle system theme
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // 应用主题类名 / Apply theme class
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const initializeAppState = useCallback(async () => {
    try {
      // 从 localStorage 恢复设置 / Restore settings from localStorage
      const storedTheme = localStorage.getItem('theme') as ThemeMode;
      // Session-based auth: try to fetch current user using cookie session
      const restoreUser = async (): Promise<User | null> => {
        try {
          // Ensure csrftoken cookie exists to satisfy Django CSRF checks on same-site
          // (GET /csrf/ sets the cookie; GET /me/ reads session)
          await fetch(`${getAPIBaseUrl()}/api/accounts/csrf/`, {
            method: 'GET',
            credentials: 'include',
          });
        } catch {}
        try {
          const res = await fetch(`${getAPIBaseUrl()}/api/accounts/me/`, {
            method: 'GET',
            credentials: 'include',
          });
          if (!res.ok) return null;
          const data = (await res.json()) as User;
          return data;
        } catch {
          return null;
        }
      };

      // 恢复主题设置 / Restore theme settings
      if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
        setThemeState(storedTheme);
      }

      // 检查用户认证状态（基于会话） / Check user authentication status (session-based)
      const currentUser = await restoreUser();
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('App initialization failed:', error);
      // 如果出错，清除可能损坏的数据 / If error, clear possibly corrupted data
      clearStorageData();
    } finally {
      setIsLoading(false);
    }
  }, [clearStorageData]);

  // 初始化应用状态 / Initialize app state
  useEffect(() => {
    initializeAppState();
  }, [initializeAppState]);

  // 监听主题变化并应用到document / Monitor theme changes and apply to document
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // 语言自动检测（仅客户端）/ Language auto-detection (client-only)
  // - 若 localStorage 已有用户选择：使用该语言
  // - 否则：根据浏览器语言归一化为 zh-CN / zh-HK / en-US，并持久化
  // - 同步设置 <html lang="...">，避免可访问性问题
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 确保 i18n 已初始化
    // Ensure i18n is initialized
    // 
    // 检查 i18n 是否初始化，避免语言切换时出现翻译或状态异常。
    // Check i18n initialization to prevent translation/state issues during language switching.
    // See docs/i18n-language-check.md for detailed reasoning.
    if (!i18n.isInitialized) return;
    
    try {
      const stored = localStorage.getItem('language');
      const hasLanguagesArray = Array.isArray(window.navigator.languages) && window.navigator.languages.length > 0;
      const preferred: string | undefined = hasLanguagesArray
        ? window.navigator.languages[0]
        : window.navigator.language;
      const target = normalizeLanguage(stored || preferred) || defaultLanguage;

      // Persist if missing
      if (!stored) {
        localStorage.setItem('language', target);
      }

      // Update i18n if needed
      if (i18n.language !== target) {
        i18n.changeLanguage(target);
      }

      // Update document lang for accessibility and consistency
      if (document.documentElement.lang !== target) {
        document.documentElement.lang = target;
      }
    } catch { /* ignore */ }
  }, [i18n]);

  const login = (userData: User) => {
    // 会话由后端 cookie 维护 / Session is maintained by HttpOnly cookie
    // 仅在前端保存用户对象以更新 UI / Keep user in memory for UI
    setUser(userData);
  };

  const logout = async () => {
    try {
      const csrfToken = getCookie('csrftoken');
      await fetch(`${getAPIBaseUrl()}/api/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
      });
    } catch {}
    setUser(null);
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const value: AppContextType = {
    // 用户认证状态 / User authentication state
    user,
    isLoggedIn: !!user,
    login,
    logout,

    // 登录弹窗控制 / Login modal control
    loginModalOpen,
    openLoginModal: () => setLoginModalOpen(true),
    closeLoginModal: () => setLoginModalOpen(false),

    // 主题设置 / Theme settings
    theme,
    setTheme,

    // 加载状态 / Loading states
    isLoading,
    globalLoading,
    setGlobalLoading,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use App Context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

