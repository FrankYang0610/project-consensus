'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLanguage, supportedLanguages } from '@/lib/locale';

// Import translation files
import zhCN from '@/locales/zh-cn.json';
import zhHK from '@/locales/zh-hk.json';
import enUS from '@/locales/en-us.json';

// Translation resources
const resources = {
  'zh-CN': {
    translation: zhCN
  },
  'zh-HK': {
    translation: zhHK
  },
  'en-US': {
    translation: enUS
  }
};

// 初始化 i18n（仅初始化一次）| Initialize i18n (only once)
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      // 关键：固定初始语言，避免 SSR/CSR 水合不一致
      // Key: fixed initial language to avoid SSR/CSR hydration mismatch
      lng: defaultLanguage,

      // 默认回退英语 | Default fallback to English
      fallbackLng: defaultLanguage,
      supportedLngs: supportedLanguages as unknown as string[],

      // Debug mode (set to false in production)
      debug: process.env.NODE_ENV === 'development',

      // Interpolation options
      interpolation: {
        // React 已自带转义 | React escapes by default
        escapeValue: false,
      },

      // React specific options
      react: {
        // 简化用法：不使用 Suspense | Simpler usage: disable Suspense
        useSuspense: false,
      },
    });
}

export default i18n;
