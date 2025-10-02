import DOMPurify from "isomorphic-dompurify";
import { decode } from "he";

/**
 * Sanitizes HTML content using DOMPurify with a restrictive configuration
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  // Create an isolated DOMPurify instance to avoid hook conflicts in concurrent/recursive scenarios
  // This ensures each sanitization call has its own hook context
  const purify = DOMPurify();

  // Strict allowlist policy: only a small set of safe, text-formatting tags are permitted
  // - Allow minimal safe attributes for tables, code blocks, and lists
  // - Explicitly forbid rich/embedded and scriptable contexts
  const config = {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
      'strong', 'em', 'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'
    ],
    // ALLOWED_ATTR expects a string array of globally allowed attributes
    // Tag-specific attribute control is done via hooks below
    ALLOWED_ATTR: ['colspan', 'rowspan', 'align', 'start', 'class'],
    SAFE_FOR_TEMPLATES: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  };

  // Hook function for tag-specific attribute validation
  const attributeHook = (node: Element, data: { attrName: string; attrValue: string; keepAttr?: boolean }) => {
    // Only allow 'class' attribute on code/pre elements with valid syntax highlighting patterns
    if (data.attrName === 'class') {
      if (node.nodeName === 'CODE' || node.nodeName === 'PRE') {
        const attrValue = data.attrValue;
        // Only allow syntax highlighting class patterns:
        // - language-* (common standard for syntax highlighters like Prism.js, highlight.js)
        // - hljs-* (highlight.js specific classes)
        // - hljs (base highlight.js class)
        const allowedPatterns = [
          /^language-[\w-]+$/,  // e.g., language-javascript, language-python
          /^hljs-[\w-]+$/,       // e.g., hljs-keyword, hljs-string
          /^hljs$/,              // base hljs class
        ];

        const classes = attrValue.split(/\s+/).filter(Boolean);
        const validClasses = classes.filter(cls =>
          allowedPatterns.some(pattern => pattern.test(cls))
        );

        if (validClasses.length > 0) {
          data.attrValue = validClasses.join(' ');
        } else {
          // If no valid classes, remove the attribute
          data.keepAttr = false;
        }
      } else {
        // Remove 'class' attribute from all other elements
        data.keepAttr = false;
      }
    }

    // Only allow 'colspan', 'rowspan', 'align' on table cells
    if (['colspan', 'rowspan', 'align'].includes(data.attrName)) {
      if (node.nodeName !== 'TD' && node.nodeName !== 'TH') {
        data.keepAttr = false;
      }
    }

    // Only allow 'start' on ordered lists
    if (data.attrName === 'start' && node.nodeName !== 'OL') {
      data.keepAttr = false;
    }
  };

  // Add hook to this isolated instance only
  purify.addHook('uponSanitizeAttribute', attributeHook);

  // Sanitize the HTML using the isolated instance
  const sanitized = purify.sanitize(html, config);
  
  // DOMPurify.sanitize returns string | TrustedHTML depending on config
  return String(sanitized);
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
