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

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    
    // Default language
    fallbackLng: 'zh-CN',
    
    // Supported languages
    supportedLngs: ['zh-CN', 'zh-HK', 'en-US'],
    
    // Debug mode (set to false in production)
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      // Order and from where user language should be detected
      order: ['localStorage', 'navigator', 'htmlTag'],
      
      // Keys or params to lookup language from
      lookupLocalStorage: 'language',
      
      // Cache user language on
      caches: ['localStorage'],
      
      // Convert codes like zh to zh-CN
      convertDetectedLanguage: (lng) => {
        // 标准化语言代码
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
      escapeValue: false, // React already does escaping
    },
    
    // React specific options
    react: {
      useSuspense: false, // We don't want to use Suspense for now
    },
  });

export default i18n;
