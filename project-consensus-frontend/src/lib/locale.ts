import { Language } from '@/types/app-types';

// Supported languages in the app (BCP 47)
export const supportedLanguages: readonly Language[] = ['zh-CN', 'zh-HK', 'en-US'] as const;

// Default language used for SSR and fallbacks
export const defaultLanguage: Language = 'en-US';

// Normalize arbitrary browser/user input to one of our supported Language codes
export const normalizeLanguage = (raw: string | undefined | null): Language | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Exact matches first
  if (trimmed === 'zh-CN' || trimmed === 'zh-HK' || trimmed === 'en-US') {
    return trimmed as Language;
  }

  // Handle Chinese variants
  if (lower.startsWith('zh')) {
    // Traditional Chinese markers → zh-HK
    if (lower.includes('hant') || lower.includes('tw') || lower.includes('hk') || lower.includes('mo')) {
      return 'zh-HK';
    }
    // zh / zh-CN / zh-Hans / zh-SG → zh-CN
    return 'zh-CN';
  }

  // English → en-US
  if (lower.startsWith('en')) return 'en-US';

  // Others fallback to English
  return defaultLanguage;
};


