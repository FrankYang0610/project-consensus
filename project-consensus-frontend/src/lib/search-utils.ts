import { stripHtmlTags } from './html-utils';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Get localized labels for search result types
 * @param t - Translation function
 * @returns Object mapping search types to localized labels
 */
export function getSearchTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    course: t('search.types.course'),
    forum_post: t('search.types.forum_post'),
    forum_comment: t('search.types.forum_comment'),
    course_review: t('search.types.course_review'),
    wiki: t('search.types.wiki'),
    teacher: t('search.types.teacher'),
    user: t('search.types.user')
  };
}

/**
 * Get localized label for search result type
 * @param type - Search result type
 * @param t - Translation function
 * @returns Localized type label
 */
export function getSearchTypeLabel(type: string, t: (key: string) => string): string {
  const labels = getSearchTypeLabels(t);
  return labels[type] || type;
}

/**
 * Strip HTML tags and return plain text (SSR-safe)
 * Uses the existing html-utils stripHtmlTags function
 */
export function stripHtml(html: string): string {
  if (typeof window === 'undefined') return html; // SSR safety
  return stripHtmlTags(html);
}

/**
 * Validation result for search queries
 */
export interface SearchQueryValidationResult {
  isValid: boolean;
  sanitizedValue?: string;
  error?: string;
}

/**
 * Validate and sanitize search query using professional security libraries
 * Uses validator.js and DOMPurify for enterprise-grade input validation
 * 
 * @param query - Raw search query from user input
 * @returns Validation result with sanitized value or error
 */
export function validateSearchQuery(query: string): SearchQueryValidationResult {
  // Basic type and empty validation using validator.js
  if (!query || typeof query !== 'string') {
    return {
      isValid: false,
      error: 'Search query cannot be empty'
    };
  }

  // Sanitize and validate using validator.js methods
  let sanitized = validator.trim(query);
  
  if (validator.isEmpty(sanitized)) {
    return {
      isValid: false,
      error: 'Search query cannot be empty'
    };
  }

  // Length validation using validator.js
  const MAX_QUERY_LENGTH = 500;
  if (!validator.isLength(sanitized, { min: 1, max: MAX_QUERY_LENGTH })) {
    return {
      isValid: false,
      error: `Search query must be between 1 and ${MAX_QUERY_LENGTH} characters`
    };
  }

  // Advanced HTML sanitization using DOMPurify
  // For search queries, we want plain text only - no HTML allowed
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [],       // No HTML tags allowed in search queries
    ALLOWED_ATTR: [],       // No attributes allowed
    KEEP_CONTENT: true,     // Keep text content, remove tags
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
  });

  // Remove control characters using validator.js
  sanitized = validator.stripLow(sanitized, true); // Keep newlines for search

  // Additional security: check for suspicious content using validator.js
  // Note: These are search-specific validations beyond basic HTML sanitization
  const suspiciousPatterns = [
    'javascript:',
    'vbscript:',
    'data:text/html',
    'data:application/',
    '<script',
    '</script>',
    'eval(',
    'Function(',
    'setTimeout(',
    'setInterval(',
  ];

  const queryLower = sanitized.toLowerCase();
  for (const pattern of suspiciousPatterns) {
    if (queryLower.includes(pattern)) {
      return {
        isValid: false,
        error: 'Search query contains potentially harmful content'
      };
    }
  }

  // Final cleanup and validation
  sanitized = validator.trim(sanitized);
  
  if (validator.isEmpty(sanitized)) {
    return {
      isValid: false,
      error: 'Search query invalid after security processing'
    };
  }

  // Additional validation: check for excessively repeated characters (potential DoS)
  if (validator.matches(sanitized, /(.)\1{50,}/)) {
    return {
      isValid: false,
      error: 'Search query contains excessive repeated characters'
    };
  }

  // Validate that the query doesn't consist entirely of special characters
  if (validator.matches(sanitized, /^[^\w\s\u4e00-\u9fff]+$/)) {
    return {
      isValid: false,
      error: 'Search query must contain alphanumeric characters'
    };
  }

  return {
    isValid: true,
    sanitizedValue: sanitized
  };
}

/**
 * Represents a text part that can be highlighted or normal
 */
export interface TextPart {
  text: string;
  isHighlighted: boolean;
}

/**
 * Split text into parts based on search query for highlighting
 * Returns an array of text parts that can be rendered by components
 * @param text - Text to split
 * @param query - Search query to highlight
 * @returns Array of text parts with highlight information
 */
export function getHighlightParts(text: string, query?: string): TextPart[] {
  if (!query || !text) {
    return [{ text, isHighlighted: false }];
  }
  
  // Escape special regex characters for safety
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  
  return parts.map(part => ({
    text: part,
    isHighlighted: part.toLowerCase() === query.toLowerCase()
  })).filter(part => part.text.length > 0); // Remove empty parts
}

