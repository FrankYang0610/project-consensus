'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '@/types/auth';

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider 组件
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check user information in localStorage
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            // Check user information and token in localStorage
            const storedUser = localStorage.getItem('user');
            const storedToken = localStorage.getItem('authToken');

            if (storedUser && storedToken) {
                const userData = JSON.parse(storedUser);
                
                // Here can add token validation logic
                // For example: send request to backend to validate token validity
                // const isTokenValid = await validateToken(storedToken);
                
                // Currently assume the information in localStorage is valid
                setUser(userData);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // If error, clear possibly corrupted data
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
        } finally {
            setIsLoading(false);
        }
    };

    const login = (userData: User, token: string) => {
        // Save user information and token to localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('authToken', token);
        setUser(userData);
    };

    const logout = () => {
        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        setUser(null);
        
        // Optional: redirect to homepage
        window.location.href = '/';
    };

    const value: AuthContextType = {
        user,
        isLoading,
        login,
        logout,
        isLoggedIn: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Custom hook to use Auth Context
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
