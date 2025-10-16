"""
Search-related exceptions for the core app service layer.
"""


class SearchError(Exception):
    """Base class for search-related exceptions."""
    pass


class SearchValidationError(SearchError):
    """Validation-related search exceptions."""
    pass


class SearchQueryEmptyError(SearchValidationError):
    """Raised when search query is empty or invalid."""
    pass


class SearchQueryTooLongError(SearchValidationError):
    """Raised when search query exceeds maximum length."""
    pass


class SearchQueryMaliciousError(SearchValidationError):
    """Raised when search query contains potentially malicious content."""
    pass
