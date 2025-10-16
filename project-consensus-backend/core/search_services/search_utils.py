"""
Search utility functions for the core app service layer.
"""

import bleach
import re
from .search_exceptions import (
    SearchQueryEmptyError,
    SearchQueryTooLongError,
    SearchQueryMaliciousError,
)

# Search query validation
MAX_QUERY_LENGTH = 500       # Maximum characters in search query


def get_author_name(user) -> str:
    """Get author display name, safely handling Profile access."""
    try:
        return user.profile.nickname
    except AttributeError:
        return user.get_username()


def build_search_result(result_type: str, obj_id: str, title: str, snippet: str, url: str, metadata: dict) -> dict:
    """Helper function to build consistent search result objects."""
    return {
        'type': result_type,
        'id': str(obj_id),
        'title': title,
        'snippet': snippet,
        'url': url,
        'metadata': metadata
    }


def truncate_content(content: str, max_length: int = 200) -> str:
    """Helper function to truncate content with ellipsis."""
    if len(content) <= max_length:
        return content
    return content[:max_length] + '...'


def validate_and_sanitize_search_query(query: str) -> str:
    """
    Validate and sanitize search query to prevent security issues.
    
    Security measures:
    1. Strip HTML tags to prevent XSS
    2. Limit length to prevent DoS attacks
    3. Remove control characters
    4. Validate allowed characters
    
    Args:
        query: Raw search query from user input
        
    Returns:
        Sanitized and validated search query
        
    Raises:
        SearchQueryEmptyError: If query is empty or invalid
        SearchQueryTooLongError: If query exceeds maximum length
        SearchQueryMaliciousError: If query contains potentially malicious content
    """
    if not query:
        raise SearchQueryEmptyError("Search query cannot be empty")
    
    # Remove HTML tags completely (search queries should be plain text)
    sanitized = bleach.clean(
        query,
        tags=[],  # No HTML tags allowed in search
        attributes={},  # No attributes allowed
        protocols=[],  # No protocols needed
        strip=True  # Strip disallowed tags
    )
    
    # Strip whitespace
    sanitized = sanitized.strip()
    
    # Check minimum length after sanitization
    if not sanitized:
        raise SearchQueryEmptyError("Search query cannot be empty after sanitization")
    
    # Limit maximum length to prevent DoS attacks
    if len(sanitized) > MAX_QUERY_LENGTH:
        raise SearchQueryTooLongError(f"Search query too long (max {MAX_QUERY_LENGTH} characters)")
    
    # Remove control characters (but allow common punctuation and unicode)
    # Keep: letters, numbers, spaces, common punctuation, Chinese/Unicode characters
    sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', sanitized)
    
    # Check for suspicious patterns that might indicate injection attempts
    suspicious_patterns = [
        r'<script',  # Script tags
        r'javascript:',  # JavaScript URLs
        r'data:',  # Data URLs
        r'vbscript:',  # VBScript URLs
        r'onload=',  # Event handlers
        r'onerror=',  # Event handlers
        r'eval\(',  # Eval function calls
    ]
    
    query_lower = sanitized.lower()
    for pattern in suspicious_patterns:
        if re.search(pattern, query_lower):
            raise SearchQueryMaliciousError("Search query contains potentially malicious content")
    
    # Final check: query should not be empty after all processing
    if not sanitized.strip():
        raise SearchQueryEmptyError("Search query invalid after security processing")
    
    return sanitized
