from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple
import logging
import re

from django.db import models

from teachers.models import Teacher


logger = logging.getLogger(__name__)


_TITLE_PREFIXES = {
    "prof", "professor", "dr", "mr", "mrs", "ms", "miss",
    "assoc", "associate", "asst", "assistant",
    "ir", "capt"
}


def _normalize_name(raw: str) -> str:
    """Normalize a person's name for fuzzy matching.

    - Lowercase
    - Remove punctuation and extra whitespace
    - Drop common title prefixes like "Prof.", "Dr"
    - Collapse multiple spaces
    """
    if not raw:
        return ""
    text = raw.lower()
    # Replace punctuation with spaces
    text = re.sub(r"[\.,;:_'`\-]+", " ", text)
    # Remove parentheses/brackets content often used for titles
    text = re.sub(r"[()\[\]{}]", " ", text)
    # Split into tokens and drop title-like tokens
    tokens = [t for t in text.split() if t and t not in _TITLE_PREFIXES]
    # Collapse to single-spaced normalized form
    return " ".join(tokens)


def _reverse_two_token_name(normalized: str) -> str:
    """If exactly two tokens, return "last first" variant; otherwise return input.
    This helps matching "chen si" with "si chen".
    """
    tokens = normalized.split()
    if len(tokens) == 2:
        return f"{tokens[1]} {tokens[0]}"
    return normalized


def _sort_name_tokens(normalized: str) -> str:
    """Return tokens sorted alphabetically to make comparison order-invariant.
    Useful for matching names with the same set of tokens in different orders.
    """
    tokens = [t for t in normalized.split() if t]
    if not tokens:
        return ""
    return " ".join(sorted(tokens))


@dataclass
class SplinkSearchResult:
    """Structured result for Splink-backed teacher search."""

    teachers: List[Teacher]
    total_fetched: int
    has_more: bool


def _raw_splink_query(query: str, top_k: int) -> List[Tuple[Teacher, float]]:
    """
    Low-level Splink search that returns up to ``top_k`` (Teacher, score) pairs.

    This encapsulates all interaction with Splink / DuckDB and the fallback
    queryset logic. Callers should layer pagination logic on top of this.
    """
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return []

    # Optional pre-fetch restriction; include all fields we need downstream
    base_qs = Teacher.objects.all().only("id", "name", "department", "tags")

    try:
        # Lazy imports to keep dependency optional
        import pandas as pd  # type: ignore
        import splink.comparison_library as cl  # type: ignore
        from splink import DuckDBLinker  # type: ignore

        # Build left dataset from teachers
        left_records = list(
            base_qs.values("id", "name", "department", "tags")
        )
        if not left_records:
            return []

        left_df = pd.DataFrame(left_records)
        left_df["source_dataset"] = "teachers"
        # Precompute normalized and reversed-name variants
        left_df["name_norm"] = left_df["name"].apply(_normalize_name)
        left_df["name_rev"] = left_df["name_norm"].apply(_reverse_two_token_name)
        left_df["last_initial"] = left_df["name_norm"].apply(
            lambda s: (s.split()[-1][0] if s and s.split() else "")
        )
        left_df["name_sorted"] = left_df["name_norm"].apply(_sort_name_tokens)
        # Normalize tags into a single comparable string
        def _tags_to_norm(tags: object) -> str:
            try:
                if not tags:
                    return ""
                # Join list-like structures; fallback to str for anything else
                if isinstance(tags, (list, tuple)):
                    joined = " ".join(str(t) for t in tags if t)
                else:
                    joined = str(tags)
                return _normalize_name(joined)
            except Exception:
                return ""
        left_df["tags_str"] = left_df["tags"].apply(_tags_to_norm)

        # Right dataset: a single-row "query table"
        right_df = pd.DataFrame([
            {
                "id": "query:0",
                "name": cleaned_query,
                # Use the raw query for department and tags as well so that
                # fuzzy comparisons can pick up department/tag tokens present
                # in the free-text query.
                "department": cleaned_query,
                "tags": [cleaned_query],
                "source_dataset": "query",
            }
        ])
        # Same normalization for the query side
        right_df["name_norm"] = right_df["name"].apply(_normalize_name)
        right_df["name_rev"] = right_df["name_norm"].apply(_reverse_two_token_name)
        right_df["last_initial"] = right_df["name_norm"].apply(
            lambda s: (s.split()[-1][0] if s and s.split() else "")
        )
        right_df["name_sorted"] = right_df["name_norm"].apply(_sort_name_tokens)
        right_df["tags_str"] = right_df["tags"].apply(lambda ts: _normalize_name(" ".join(str(t) for t in (ts or []) if t)))

        # Splink settings: link-only between query and teachers
        settings = {
            "link_type": "link_only",
            "unique_id_column_name": "id",
            # Light blocking: by first char of normalized name and last-token initial
            "blocking_rules_to_generate_predictions": [
                "substr(l.name_norm, 1, 1) = substr(r.name_norm, 1, 1)",
                "l.last_initial = r.last_initial",
                # Enable candidates when department/tag lead characters align as well
                "substr(l.department, 1, 1) = substr(r.department, 1, 1)",
                "substr(l.tags_str, 1, 1) = substr(r.tags_str, 1, 1)",
            ],
            "comparisons": [
                # Compare raw name as-is
                cl.jaro_winkler_at_thresholds("name", [0.95, 0.9, 0.85, 0.8, 0.7]),
                # Compare normalized name (no titles, punctuation)
                cl.jaro_winkler_at_thresholds("name_norm", [0.98, 0.95, 0.9, 0.85, 0.8]),
                # Compare reversed two-token variant to catch "chen si" vs "si chen"
                cl.jaro_winkler_at_thresholds("name_rev", [0.98, 0.95, 0.9, 0.85, 0.8]),
                # Compare token-sorted variant to catch multi-token reordering like
                # "yang ping tat" vs "yang tat ping"
                cl.exact_match("name_sorted", term_frequency_adjustments=True),
                # Department: both exact and fuzzy
                cl.exact_match("department", term_frequency_adjustments=True),
                cl.jaro_winkler_at_thresholds("department", [0.98, 0.95, 0.9, 0.85]),
                # Tags as a normalized free-text string
                cl.jaro_winkler_at_thresholds("tags_str", [0.98, 0.95, 0.9, 0.85, 0.8]),
            ],
        }

        linker = DuckDBLinker([left_df, right_df], settings)

        # Run prediction and convert to pandas
        predictions = linker.predict()
        pred_df = predictions.as_pandas_dataframe(limit=None)

        if pred_df is None or pred_df.empty:
            return []

        # Filter to edges that involve the query row on the right side
        # Column names follow Splink convention: id_l, id_r, match_probability
        pred_df = pred_df[(pred_df["id_r"] == "query:0")]
        if pred_df.empty:
            return []

        # Sort by probability descending and take top_k
        pred_df = pred_df.sort_values("match_probability", ascending=False).head(top_k)

        id_to_prob = {
            str(row["id_l"]): float(row["match_probability"]) for _, row in pred_df.iterrows()
        }

        if not id_to_prob:
            return []

        # Fetch Teacher objects and preserve order by probability
        teachers = list(Teacher.objects.filter(id__in=id_to_prob.keys()))
        teacher_map = {str(t.id): t for t in teachers}
        ordered = [
            (teacher_map[teacher_id], id_to_prob[teacher_id])
            for teacher_id in sorted(id_to_prob.keys(), key=lambda k: id_to_prob[k], reverse=True)
            if teacher_id in teacher_map
        ]
        return ordered

    except Exception as exc:
        # Fallback: token-based icontains filtering with normalized query.
        # Consider name (AND over tokens), department (icontains over query),
        # and tags (icontains over tokens/query). Return deterministic 0.0 scores.
        logger.exception("Splink search failed; falling back to icontains. Error: %s", exc)
        normalized = _normalize_name(cleaned_query)
        tokens = [t for t in normalized.split() if t]
        # Build name condition: all tokens must appear in name
        name_q = models.Q()
        for tok in tokens:
            name_q &= models.Q(name__icontains=tok)

        # Department condition: loose contains of the whole query
        dept_q = models.Q()
        if cleaned_query:
            dept_q |= models.Q(department__icontains=cleaned_query)

        # Tags condition: allow any token or the whole query to match tags
        tags_q = models.Q()
        for tok in tokens:
            tags_q |= models.Q(tags__icontains=tok)
        if cleaned_query:
            tags_q |= models.Q(tags__icontains=cleaned_query)

        q_obj = name_q | dept_q | tags_q
        fallback_qs = (
            base_qs.filter(q_obj)
            .order_by("name")[:top_k]
        )
        return [(t, 0.0) for t in fallback_qs]


def search_teachers_with_splink(
    query: str,
    page: int = 1,
    page_size: int = 20,
) -> SplinkSearchResult:
    """
    High-level Splink search that understands pagination.

    View layer passes in ``page`` and ``page_size``; this function hides
    the underlying ``top_k`` and slicing math, returning a structured
    result that can be fed directly into response builders.
    """
    # Defensive guards; views already sanitize but keep this robust for reuse.
    page = max(page, 1)
    page_size = max(page_size, 1)

    top_k = page * page_size + 1
    pairs = _raw_splink_query(query, top_k=top_k)
    total_fetched = len(pairs)

    has_more = total_fetched > (top_k - 1)

    start = (page - 1) * page_size
    end = start + page_size

    if start >= total_fetched:
        current_page_pairs: List[Tuple[Teacher, float]] = []
    else:
        current_page_pairs = pairs[start:min(end, total_fetched)]

    page_teachers = [t for (t, _score) in current_page_pairs]

    return SplinkSearchResult(
        teachers=page_teachers,
        total_fetched=total_fetched,
        has_more=has_more,
    )

