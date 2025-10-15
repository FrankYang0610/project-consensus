from __future__ import annotations

from functools import wraps
from rest_framework import status
from rest_framework.response import Response


def handle_service_error(func):
    """Decorator to convert service-layer errors into HTTP responses.

    Notes:
        - Imports are performed lazily inside the wrapper to avoid import-time
          coupling between apps.
        - Only known service exceptions are converted; unknown exceptions are
          re-raised so default handlers/logging can process them.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:  # defer type checks until needed
            try:
                from courses.services.course_exceptions import (
                    ServiceError,
                    ValidationError as ServiceValidationError,
                    NotFoundError,
                )
            except Exception:  # pragma: no cover - fallback if import fails
                raise

            if isinstance(e, ServiceValidationError):
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            if isinstance(e, NotFoundError):
                return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
            if isinstance(e, ServiceError):
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            raise

    return wrapper
