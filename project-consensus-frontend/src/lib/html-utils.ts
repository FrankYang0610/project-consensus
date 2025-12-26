import DOMPurify from "isomorphic-dompurify";
import { decode } from "he";

/**
 * Normalizes a bare domain URL (e.g., "apple.com" or "www.apple.com") by prepending https://
 * Returns the normalized URL if valid, otherwise returns the original value.
 * @param value - The URL string to normalize
 * @returns Normalized URL with https:// prefix, or original value if not a bare domain
 */
function normalizeBareDomainUrl(value: string): string {
  const v = String(value ?? "").trim();
  if (!v) return v;
  const startsWithSpecial = v.startsWith('/') || v.startsWith('#') || v.startsWith('?') || v.startsWith('.');
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(v);

  if (!hasScheme && !startsWithSpecial) {
    try {
      new URL(`https://${v}`); // Validate before applying
      return `https://${v}`;
    } catch {
      // Not a valid URL even with https://, return original
    }
  }
  return v;
}

function normalizeAllowedHttpsOrigin(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = normalizeBareDomainUrl(raw);
  try {
    const u = new URL(normalized);
    if (u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

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
      'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre', 'blockquote',
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

  const allowedImageOrigins = (process.env.NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS || 'https://image.polyu.life')
    .split(',')
    .map((h) => normalizeAllowedHttpsOrigin(h))
    .filter((h): h is string => Boolean(h));

  if (allowedImageOrigins.length === 0) {
    allowedImageOrigins.push('https://image.polyu.life');
  }

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

    // Normalize and validate <a href> to http/https only
    if (node.nodeName === 'A' && data.attrName === 'href') {
      // If user typed a bare domain like "apple.com", normalize to https://
      let value = normalizeBareDomainUrl((data.attrValue || '').trim());
      data.attrValue = value;

      try {
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : (process.env.NEXT_PUBLIC_SITE_URL || 'https://polyu.life');
        const url = new URL(value, baseUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          data.keepAttr = false;
        }
      } catch {
        data.keepAttr = false;
      }
    }

    // Validate <img src> to allowed image hosts only
    if (node.nodeName === 'IMG' && data.attrName === 'src') {
      // If user typed a bare domain like "image.polyu.life/xxx.png", normalize to https://
      let value = normalizeBareDomainUrl((data.attrValue || '').trim());
      data.attrValue = value;

      try {
        // Base URL is only used for resolving relative paths in both browser and SSR. 
        // Absolute http/https URLs will ignore Base URL.
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : (process.env.NEXT_PUBLIC_SITE_URL || 'https://polyu.life');

        const url = new URL(value, baseUrl);
        const isAllowedOrigin = url.protocol === 'https:' && allowedImageOrigins.includes(url.origin);
        if (!isAllowedOrigin) {
          data.keepAttr = false;
        }
      } catch {
        data.keepAttr = false;
      }
    }
  };

  // Add hook to this isolated instance only
  purify.addHook('uponSanitizeAttribute', attributeHook);

  // Ensure all links open in a new tab with safe rel attributes
  purify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.nodeName === 'A') {
      const href = (node.getAttribute('href') || '').trim();
      if (href) {
        // Force opening in a new tab
        node.setAttribute('target', '_blank');

        // Always ensure safe rel attributes
        const rel = (node.getAttribute('rel') || '').toLowerCase();
        const needed = ['noopener', 'noreferrer', 'nofollow'];
        const parts = new Set(rel.split(/\s+/).filter(Boolean));
        needed.forEach((t) => parts.add(t));
        node.setAttribute('rel', Array.from(parts).join(' '));
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
