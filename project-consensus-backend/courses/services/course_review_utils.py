from __future__ import annotations

from django.db import IntegrityError


def _is_constraint_violation(e: IntegrityError, constraint_name: str) -> bool:
    """Best-effort detection of a specific DB constraint violation.

    Supports psycopg2/psycopg3 diagnostics when available, falls back to string matching.
    """
    if hasattr(e, "__cause__") and e.__cause__ is not None:
        cause = e.__cause__
        if hasattr(cause, "diag"):
            actual = getattr(cause.diag, "constraint_name", None)
            if actual == constraint_name:
                return True
        if hasattr(cause, "constraint_name"):
            if getattr(cause, "constraint_name") == constraint_name:
                return True
    return constraint_name in str(e)
