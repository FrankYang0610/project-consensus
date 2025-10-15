from __future__ import annotations


class ServiceError(Exception):
    """Base class for domain/service layer errors.

    View layer should map these to appropriate HTTP responses.
    This allows for unified error handling across the application.
    """


# Validation Errors
class ValidationError(ServiceError):
    """Base class for validation-related service errors."""
    pass


class AlreadyReviewedError(ValidationError):
    """Raised when a user attempts to create a duplicate review for a course."""
    pass


class InvalidVoteTypeError(ValidationError):
    """Raised when an invalid vote type is provided."""
    pass


# Not Found Errors
class NotFoundError(ServiceError):
    """Base class for resource not found errors."""
    pass


class CourseNotFoundError(NotFoundError):
    """Raised when a course cannot be found by the given identifier."""
    pass


class ReviewNotFoundError(NotFoundError):
    """Raised when a review cannot be found by the given identifier."""
    pass


class ReplyNotFoundError(NotFoundError):
    """Raised when a reply cannot be found by the given identifier."""
    pass


# Operation Errors
class InvalidOperationError(ServiceError):
    """Raised for invalid domain operations (generic)."""
    pass


