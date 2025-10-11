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

  // Strict allowlist policy with safe support for links and images.
  // - Permit basic text formatting and tables
  // - Allow <a> (http/https only) and <img> (restricted hosts and https only)
  const config = {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
      'strong', 'em', 'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      // Links and images
      'a', 'img'
    ],
    // ALLOWED_ATTR expects a string array of globally allowed attributes; tag-specific
    // filtering is applied via hooks below
    ALLOWED_ATTR: [
      'colspan', 'rowspan', 'align', 'start', 'class',
      // Link attrs
      'href', 'title', 'target', 'rel',
      // Image attrs
      'src', 'alt', 'width', 'height'
    ],
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

    // Validate <a href> to http/https only
    if (node.nodeName === 'A' && data.attrName === 'href') {
      try {
        const u = new URL(data.attrValue, typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          data.keepAttr = false;
        }
      } catch {
        data.keepAttr = false;
      }
    }

    // Validate <img src> to https and allowed hosts only
    if (node.nodeName === 'IMG' && data.attrName === 'src') {
      const raw = (data.attrValue || '').trim();
      try {
        const u = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
        const allowedHosts = (process.env.NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS || 'image.polyu.life')
          .split(',')
          .map(h => h.trim().toLowerCase())
          .filter(Boolean);
        const host = u.host.toLowerCase();
        // Only https and within allowlist
        if (u.protocol !== 'https:' || !allowedHosts.includes(host)) {
          data.keepAttr = false;
        }
      } catch {
        data.keepAttr = false;
      }
    }
  };

  // Add hook to this isolated instance only
  purify.addHook('uponSanitizeAttribute', attributeHook);

  // Ensure external links open safely
  purify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.nodeName === 'A') {
      const href = (node.getAttribute('href') || '').trim();
      if (href) {
        const target = node.getAttribute('target');
        if (target === '_blank') {
          const rel = (node.getAttribute('rel') || '').toLowerCase();
          const needed = ['noopener', 'noreferrer', 'nofollow'];
          const parts = new Set(rel.split(/\s+/).filter(Boolean));
          needed.forEach((t) => parts.add(t));
          node.setAttribute('rel', Array.from(parts).join(' '));
        }
      }
    }
  });

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
