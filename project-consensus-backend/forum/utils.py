from __future__ import annotations

import uuid


def generate_anonymous_id() -> str:
    """Generate a short anonymous id suitable for display only."""
    return f"anonymous_{uuid.uuid4().hex[:8]}"


