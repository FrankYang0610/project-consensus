'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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

// 是否在浏览器环境 | Whether we are running in the browser
const isBrowser = typeof window !== 'undefined';

// 仅在客户端启用浏览器语言检测，避免 SSR/CSR 初始语言不一致导致水合问题
// Only enable browser language detection on the client to avoid SSR/CSR hydration mismatches
(isBrowser ? i18n.use(LanguageDetector) : i18n)
  .use(initReactI18next)
  .init({
    resources,
    // 确保在没有用户偏好的情况下，SSR 与 CSR 起始语言一致（稳定默认）
    // Ensure SSR and CSR start from the same deterministic language when no stored preference
    // SSR 强制使用默认值；客户端可由检测/本地存储覆盖
    // During SSR, force a stable default; on the client, detector/localStorage may override
    lng: isBrowser ? undefined : 'zh-HK',
    
    // 默认回退语言设为繁体中文 | Set fallback language to Traditional Chinese
    fallbackLng: 'zh-HK',
    supportedLngs: ['zh-CN', 'zh-HK', 'en-US'],
    
    // Debug mode (set to false in production)
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      // 优先使用持久化的用户选择；避免使用 navigator/htmlTag，以保持 SSR/CSR 一致
      // Prefer persisted user choice; avoid navigator/htmlTag to keep SSR/CSR consistent
      order: ['localStorage'],
      
      // Keys or params to lookup language from
      lookupLocalStorage: 'language',
      
      // Cache user language on
      caches: ['localStorage'],
      
      // 规范化检测到的语言代码（兼容多种变体）
      // Normalize detected language codes (support common variants)
      convertDetectedLanguage: (lng) => {
        // 标准化语言代码
        // Normalize detected language codes
        const languageMap: { [key: string]: string } = {
          'zh': 'zh-CN',
          'zh-cn': 'zh-CN',
          'zh-CN': 'zh-CN',
          'zh-Hans': 'zh-CN',
          'zh-hk': 'zh-HK',
          'zh-HK': 'zh-HK',
          'zh-Hant': 'zh-HK',
          'en': 'en-US',
          'en-us': 'en-US',
          'en-US': 'en-US'
        };
        
        return languageMap[lng] || 'zh-CN';
      }
    },

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

export default i18n;
