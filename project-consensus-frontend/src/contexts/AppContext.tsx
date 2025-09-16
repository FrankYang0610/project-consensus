'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AppContextType, ThemeMode } from '@/types/app-types';

// Create Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// App Provider 组件 / App Provider component
export function AppProvider({ children }: { children: ReactNode }) {
    // 用户认证状态 / User authentication state
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
            const storedUser = localStorage.getItem('user');
            const storedToken = localStorage.getItem('authToken');

            // 恢复主题设置 / Restore theme settings
            if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
                setThemeState(storedTheme);
            }

            // 检查用户认证状态 / Check user authentication status
            if (storedUser && storedToken) {
                const userData = JSON.parse(storedUser);
                
                // 这里可以添加令牌验证逻辑 / Here can add token validation logic
                // 例如：向后端发送请求验证令牌有效性 / For example: send request to backend to validate token validity
                // const isTokenValid = await validateToken(storedToken);
                
                // 目前假设 localStorage 中的信息是有效的 / Currently assume the information in localStorage is valid
                setUser(userData);
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

    const login = (userData: User, token: string) => {
        // 保存用户信息和令牌到 localStorage / Save user information and token to localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('authToken', token);
        setUser(userData);
    };

    const logout = () => {
        // 清除认证相关的 localStorage / Clear auth-related localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        setUser(null);
        
        // 可选：重定向到首页 / Optional: redirect to homepage
        window.location.href = '/';
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

