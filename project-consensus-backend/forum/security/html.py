from __future__ import annotations

import bleach

_FORUM_TAGS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br',
    'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote',
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


def sanitize_forum_html(html: str) -> str:
    if not isinstance(html, str):
        return ""
    return bleach.clean(html, tags=_FORUM_TAGS, attributes=_FORUM_ATTRS, protocols=_PROTOCOLS, strip=True)
