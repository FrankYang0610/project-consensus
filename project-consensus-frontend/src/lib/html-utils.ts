import DOMPurify from "isomorphic-dompurify";
import { decode } from "he";

/**
 * Sanitizes HTML content using DOMPurify with a restrictive configuration
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  // Strict allowlist policy: only a small set of safe, text-formatting tags are permitted
  // - Allow minimal safe attributes for tables, code blocks, and lists
  // - Explicitly forbid rich/embedded and scriptable contexts
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
      'strong', 'em', 'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'
    ],
    ALLOWED_ATTR: {
      // Table attributes for cell merging and alignment
      'td': ['colspan', 'rowspan', 'align'],
      'th': ['colspan', 'rowspan', 'align'],
      // Code syntax highlighting
      'code': ['class'],
      'pre': ['class'],
      // Ordered list starting number
      'ol': ['start'],
    },
    SAFE_FOR_TEMPLATES: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

/**
 * Strips HTML tags and decodes HTML entities to get plain text
 * @param html - The HTML string to convert to plain text
 * @returns Plain text string with HTML tags removed and entities decoded
 */
export function stripHtmlTags(html: string): string {
  // First, decode all HTML entities using the 'he' library
  const decoded = decode(html);

  // Remove HTML tags
  return decoded.replace(/<[^>]*>/g, '').trim();
}

/**
 * Truncates HTML content to a specified length after converting to plain text
 * @param html - The HTML string to truncate
 * @param maxLength - Maximum length of the resulting text (default: 150)
 * @returns Truncated plain text string
 */
export function truncateHtmlContent(html: string, maxLength: number = 150): string {
  const plainText = stripHtmlTags(html);
  if (plainText.length <= maxLength) return plainText;
  return plainText.slice(0, maxLength) + "...";
}
