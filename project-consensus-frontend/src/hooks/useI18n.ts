 'use client';

import '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { Language } from '@/types/app-types';

/**
 * Simple i18n hook - 直接使用 i18next，不需要复杂的状态管理
 */
export function useI18n() {
    const { t, i18n } = useTranslation();

    /**
     * Change language - 直接调用 i18next
     */
    const changeLanguage = (newLanguage: Language) => {
        i18n.changeLanguage(newLanguage);
    };

    /**
     * Get current language from i18next
     */
    const language = i18n.language as Language;

    /**
     * Check if a specific language is active
     */
    const isLanguage = (lang: Language) => language === lang;

    return {
        t,
        language,
        changeLanguage,
        isLanguage,
        i18n,
    };
}

export default useI18n;
