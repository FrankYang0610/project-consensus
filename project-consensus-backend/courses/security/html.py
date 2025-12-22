from __future__ import annotations

import bleach

# Course review: allow images and safe hyperlinks; replies/comments may reuse text-only if desired
_COURSE_REVIEW_TAGS = [
    'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'img',
    'a',  # Safe hyperlinks for course reviews
]
_COURSE_REVIEW_ATTRS: dict[str, list[str]] = {
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align'],
    'code': ['class'],
    'pre': ['class'],
    'ol': ['start'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'a': ['href', 'title', 'target', 'rel'],  # Restrict link attributes to a minimal safe set; protocols are enforced via _PROTOCOLS.
}

_COURSE_TEXT_TAGS = [
    'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
]
_COURSE_TEXT_ATTRS: dict[str, list[str]] = {
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align'],
    'code': ['class'],
    'pre': ['class'],
    'ol': ['start'],
}

_FORUM_TAGS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'div', 'span', 'hr', 'del', 'ins', 'u', 's', 'sub', 'sup',
    'a', 'img',
]
_FORUM_ATTRS: dict[str, list[str]] = {
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align'],
    'code': ['class'],
    'pre': ['class'],
    'ol': ['start'],
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'div': ['class'],
    'span': ['class'],
}

_PROTOCOLS = ['http', 'https', 'mailto']


def sanitize_course_review_html(html: str) -> str:
    if not isinstance(html, str):
        return ""
    return bleach.clean(html, tags=_COURSE_REVIEW_TAGS, attributes=_COURSE_REVIEW_ATTRS, protocols=_PROTOCOLS, strip=True)


def sanitize_course_text_html(html: str) -> str:
    if not isinstance(html, str):
        return ""
    return bleach.clean(html, tags=_COURSE_TEXT_TAGS, attributes=_COURSE_TEXT_ATTRS, protocols=_PROTOCOLS, strip=True)


def sanitize_forum_html(html: str) -> str:
    if not isinstance(html, str):
        return ""
    return bleach.clean(html, tags=_FORUM_TAGS, attributes=_FORUM_ATTRS, protocols=_PROTOCOLS, strip=True)


