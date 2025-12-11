from __future__ import annotations

import re
from typing import Any, Iterable


# Common title prefixes that should be stripped from the beginning of teacher
# names before deriving a sort key. This mirrors the logic used when
# normalizing teacher names elsewhere in the codebase.
TITLE_PREFIXES = frozenset({
    "prof", "professor", "dr", "mr", "mrs", "ms", "miss",
    "assoc", "associate", "asst", "assistant", "ir", "capt",
})


def strip_title_prefixes(name: str) -> str:
    """Strip common academic/professional titles from the start of a name.

    The implementation preserves the original tokens (including punctuation)
    for the non-title part of the name, and only normalizes tokens while
    checking whether they are titles.
    """
    if not name:
        return ""

    tokens = str(name).strip().split()
    i = 0
    while i < len(tokens):
        # Remove punctuation when deciding whether a token is a title.
        raw = re.sub(r"[\.,;:()\[\]{}'`]+", "", tokens[i]).strip().lower()
        if raw in TITLE_PREFIXES:
            i += 1
        else:
            break
    return " ".join(tokens[i:]).strip()


def teacher_surname_sort_key(name: str) -> tuple[str, str]:
    """Build a stable sort key for teacher names.

    - Strips leading titles first
    - Handles "SURNAME, Given" and "Given SURNAME" styles
    - Uses an ALLCAPS-first-token heuristic for surname-first names

    Returns a tuple of (surname_lower, full_display_lower) so sorting
    is primarily by surname and secondarily by the full representation.
    """
    base = strip_title_prefixes(name)
    if not base:
        return ("", "")

    if "," in base:
        # e.g. "CHAN, Tai Man" -> surname = "CHAN"
        parts = base.split(",", 1)
        surname = parts[0].strip()
        rest = parts[1].strip() if len(parts) > 1 else ""
    else:
        parts = base.split()
        if len(parts) >= 2:
            first = parts[0]
            tail = " ".join(parts[1:])
            # Heuristic: if first token is ALLCAPS and tail has lowercase,
            # assume surname-first style (e.g. "CHAN Tai Man").
            if first.isupper() and any(ch.islower() for ch in tail):
                surname = first
                rest = tail
            else:
                surname = parts[-1]
                rest = " ".join(parts[:-1])
        else:
            surname = parts[-1] if parts else base
            rest = ""

    return (surname.lower(), f"{surname} {rest}".lower())


def sort_teachers_by_surname(teachers: Iterable[Any]) -> list[Any]:
    """Return teacher-like objects ordered by surname using teacher_surname_sort_key.

    Accepts any iterable of objects that expose a ``name`` attribute.
    """
    teachers_list = list(teachers)
    teachers_list.sort(
        key=lambda t: teacher_surname_sort_key(getattr(t, "name", "") or "")
    )
    return teachers_list
