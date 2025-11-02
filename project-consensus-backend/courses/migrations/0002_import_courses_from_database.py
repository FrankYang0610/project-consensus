from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable, List, Tuple

from django.db import migrations
from django.utils import timezone



# ---------- Helpers: path & parsing ----------
def _database_courses_json_path() -> Path:
    """Return absolute path to backend/database/courses/courses.json.

    This migration file lives in backend/courses/migrations/, so we go up two
    parents to reach the backend root, then into database/courses.
    """
    here = Path(__file__).resolve()
    backend_root = here.parents[2]
    return backend_root / "database" / "courses" / "courses.json"


def _iter_records_from_json(path: Path) -> Iterable[dict]:
    """Yield course records using the standard json parser."""
    if not path.exists():
        print(f"  [courses.0002] Source JSON not found: {path}")
        return

    try:
        with path.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
            if isinstance(data, list):
                for rec in data:
                    if isinstance(rec, dict):
                        yield rec
            elif isinstance(data, dict):
                # Support object-wrapped arrays like {"records": [...]} or {"data": [...]}.
                for key in ("records", "data", "items"):
                    arr = data.get(key)
                    if isinstance(arr, list):
                        for rec in arr:
                            if isinstance(rec, dict):
                                yield rec
                        break
    except Exception as e:
        print(f"  [courses.0002] JSON parse failed: {e}")


def _parse_year_sem(record: dict) -> Tuple[int, str]:
    """Parse year/semester from record.

    yearsem_value looks like "20251" for academic year 2025/26 Semester 1.
    Map: 1->fall (year), 2->spring (year+1), 3->summer (year+1).
    """
    raw = str(record.get("yearsem_value") or "").strip()
    if len(raw) >= 5 and raw[:4].isdigit():
        base_year = int(raw[:4])
        sem_code = raw[-1]
        if sem_code == "1":
            return base_year, "fall"
        if sem_code == "2":
            return base_year + 1, "spring"
        if sem_code == "3":
            return base_year + 1, "summer"
    # Fallback: try to infer from text, otherwise default to fall/base_year
    text = str(record.get("yearsem_text") or "").lower()
    m = re.search(r"(\d{4})/(\d{2}).*semester\s*(\d)", text)
    if m:
        base_year = int(m.group(1))
        sem_code = m.group(3)
        if sem_code == "1":
            return base_year, "fall"
        if sem_code == "2":
            return base_year + 1, "spring"
        if sem_code == "3":
            return base_year + 1, "summer"
    # Last resort defaults
    year = int(text[:4] or 0) or timezone.now().year
    return year, "fall"


# ---------- Helpers: teacher name normalization & matching ----------
_TITLE_PREFIXES = {
    "prof", "professor", "dr", "mr", "mrs", "ms", "miss",
    "assoc", "associate", "asst", "assistant",
    "ir", "capt",
}


def _normalize_name(raw: str) -> str:
    if not raw:
        return ""
    text = raw.lower().strip()
    # Replace punctuation with spaces
    text = re.sub(r"[\.,;:_'`\-]+", " ", text)
    text = re.sub(r"[()\[\]{}]", " ", text)
    tokens = [t for t in text.split() if t and t not in _TITLE_PREFIXES]
    return " ".join(tokens)


def _reverse_two_token_name(normalized: str) -> str:
    tokens = normalized.split()
    if len(tokens) == 2:
        return f"{tokens[1]} {tokens[0]}"
    return normalized


def _sort_name_tokens(normalized: str) -> str:
    tokens = [t for t in normalized.split() if t]
    if not tokens:
        return ""
    return " ".join(sorted(tokens))


def _sequence_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _match_teacher_by_name(apps, raw_name: str, dept_hint: str | None = None):
    """Return the best-matching Teacher object for the given raw name, or None.

    Similar in spirit to teachers.services.splink_search.search_teachers_with_splink,
    but implemented inline with stdlib heuristics to keep migration deterministic.
    """
    Teacher = apps.get_model("teachers", "Teacher")

    query_norm = _normalize_name(raw_name)
    if not query_norm:
        return None

    # Candidate pre-filter: name contains all tokens (order-agnostic)
    from django.db.models import Q

    tokens = [t for t in query_norm.split() if t]
    q_obj = Q()
    for tok in tokens:
        q_obj &= Q(name__icontains=tok)

    candidates = list(
        Teacher.objects.filter(q_obj).only("id", "name", "department")[:50]
    )
    if not candidates:
        # very loose fallback
        candidates = list(
            Teacher.objects.filter(name__icontains=query_norm.split()[0]).only("id", "name", "department")[:50]
        )
        if not candidates:
            return None

    # Score candidates by max of direct/normalized/reversed/sorted name similarity
    best = None
    best_score = 0.0
    rev = _reverse_two_token_name(query_norm)
    sorted_q = _sort_name_tokens(query_norm)
    dept_hint_norm = _normalize_name(dept_hint or "")

    for t in candidates:
        name_norm = _normalize_name(t.name)
        score = max(
            _sequence_similarity(name_norm, query_norm),
            _sequence_similarity(name_norm, rev),
            _sequence_similarity(_sort_name_tokens(name_norm), sorted_q),
        )
        # Small boost if department hint matches
        if dept_hint_norm and t.department:
            if dept_hint_norm.split()[0] in _normalize_name(t.department):
                score += 0.03
        if score > best_score:
            best_score = score
            best = t

    # Require a modest threshold to avoid spurious matches
    return best if best_score >= 0.75 else None


def _extract_teacher_names(rec: dict) -> List[str]:
    details = rec.get("details") or {}
    # Prefer list field if available
    names_field = details.get("teaching_staff_all")

    def _split_pairs(s: str) -> List[str]:
        # Split a string like "CHEUNG, Wan Chuen, FOK, WH Thomas" into
        # ["CHEUNG Wan Chuen", "FOK WH Thomas"].
        parts = [p.strip() for p in str(s).split(",") if p and p.strip()]
        if len(parts) <= 1:
            return parts
        out: List[str] = []
        i = 0
        while i < len(parts):
            if i + 1 < len(parts):
                out.append(f"{parts[i]} {parts[i+1]}".strip())
                i += 2
            else:
                out.append(parts[i])
                i += 1
        return out

    names: List[str] = []
    if isinstance(names_field, list) and names_field:
        for item in names_field:
            if not item:
                continue
            s = str(item).strip()
            if "," in s:
                names.extend(_split_pairs(s))
            else:
                names.append(s)
    else:
        raw = details.get("teaching_staff") or ""
        s = str(raw).strip()
        if "," in s:
            names = _split_pairs(s)
        elif s:
            names = [s]
    # Clean common sentinels
    cleaned = []
    for n in names:
        if not n:
            continue
        if str(n).strip().lower() in {"n/a", "na", "not applicable", "tba", "to be announced"}:
            continue
        cleaned.append(str(n).strip())
    return cleaned


# ---------- Forward / reverse ----------
def import_courses_forward(apps, schema_editor):
    Course = apps.get_model("courses", "Course")
    Teacher = apps.get_model("teachers", "Teacher")  # noqa: F401 - ensures historical state is loaded

    json_path = _database_courses_json_path()
    if not json_path.exists():
        # No-op if source data not present
        print(f"  [courses.0002] Source JSON not found: {json_path}")
        return

    now = timezone.now()
    created_count = 0
    updated_count = 0
    processed_count = 0
    skipped_count = 0
    first_errors: list[str] = []
    for rec in _iter_records_from_json(json_path):
        try:
            subject_code = (rec.get("subject_code") or "").strip()
            title = (rec.get("subject_title") or "").strip()
            if not subject_code or not title:
                continue

            term_year, term_semester = _parse_year_sem(rec)

            details = rec.get("details") or {}
            offering_department = (
                details.get("offering_department")
                or rec.get("subject_offering_department")
                or ""
            )
            department = rec.get("subject_offering_department") or offering_department or ""
            level = str(rec.get("subject_level") or details.get("level") or "").strip()
            credits = str(rec.get("credits") or details.get("credits") or "").strip()

            # Create or update a Course matched by (subject_code, term_year, term_semester)
            obj = (
                Course.objects.filter(
                    subject_code=subject_code,
                    term_year=term_year,
                    term_semester=term_semester,
                ).first()
            )

            if obj is None:
                obj = Course(
                    subject_code=subject_code,
                    title=title,
                    term_year=term_year,
                    term_semester=term_semester,
                )
                created = True
            else:
                created = False

            # Assign fields
            obj.title = title
            obj.department = department[:200]
            obj.offering_department = (offering_department or "")[:200]
            obj.level = level[:1] if level else ""
            obj.credits = credits[:20] if credits else ""
            obj.course_homepage_url = ""
            obj.syllabus_url = ""
            obj.selection_category = ""
            obj.teaching_type = ""
            obj.ai_summary = ""
            obj.course_category = "imported"  # marker for easy reverse
            obj.last_updated = now
            obj.terms = [{"year": term_year, "semester": term_semester}]

            obj.save()

            # Attach teachers by best-match name
            names = _extract_teacher_names(rec)
            matched: List[object] = []
            seen_ids = set()
            for name in names:
                t = _match_teacher_by_name(apps, name, dept_hint=department)
                if t and t.id not in seen_ids:
                    matched.append(t)
                    seen_ids.add(t.id)
            if matched:
                obj.teachers.set(matched)
            else:
                obj.teachers.clear()

            processed_count += 1
            if created:
                created_count += 1
            else:
                updated_count += 1

        except Exception as e:
            skipped_count += 1
            if len(first_errors) < 3:
                first_errors.append(repr(e))
            continue

    print(
        f"  [courses.0002] Imported courses: total={processed_count}, created={created_count}, updated={updated_count}, skipped={skipped_count}"
    )
    if first_errors:
        print("  [courses.0002] First errors:")
        for msg in first_errors:
            print(f"    - {msg}")


def import_courses_reverse(apps, schema_editor):
    Course = apps.get_model("courses", "Course")
    # Remove only the records we imported in this migration
    Course.objects.filter(course_category="imported").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0001_initial"),
        ("teachers", "0002_import_teachers_from_database"),
    ]

    operations = [
        migrations.RunPython(import_courses_forward, import_courses_reverse),
    ]


