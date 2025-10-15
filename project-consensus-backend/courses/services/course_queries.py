from __future__ import annotations

from ..models import Course


def get_departments_with_counts() -> list[dict[str, int | str]]:
    """Return list of departments with course counts.

    Performs a single aggregation grouped by `department`, then merges
    case variants in Python while preserving the first-seen casing.
    """
    from django.db.models import Count

    departments_qs = (
        Course.objects
        .exclude(department="")
        .values("department")
        .annotate(count=Count("course_id"))
        .order_by("department")
    )

    seen: dict[str, dict[str, int | str]] = {}
    for item in departments_qs:
        name = str(item["department"]).strip()
        if not name:
            continue
        key = name.lower()
        if key not in seen:
            seen[key] = {"name": name, "count": int(item["count"])}
        else:
            # merge counts for case-insensitive duplicates
            seen[key]["count"] = int(seen[key]["count"]) + int(item["count"])  # type: ignore[index]

    return sorted(seen.values(), key=lambda d: str(d["name"]).lower())


def get_department_level_distribution(department_name: str) -> list[dict[str, int | str]]:
    """Return level distribution for a specific department.

    Performs aggregation to get level counts for courses in the specified department.
    Groups levels 1-6 separately and aggregates all other levels as "Other".

    Args:
        department_name: The department name to filter by (case-insensitive)

    Returns:
        List of dictionaries with 'level' and 'count' keys, sorted by level
    """
    from django.db.models import Count

    # Get level distribution for the specified department
    levels_qs = (
        Course.objects
        .filter(department__iexact=department_name.strip())
        .exclude(level="")
        .values("level")
        .annotate(count=Count("course_id"))
        .order_by("level")
    )
    
    # Format and sort levels (1, 2, 3, 4, 5, 6, Other)
    levels_data = []
    other_count = 0
    
    for item in levels_qs:
        level = str(item["level"]).strip()
        count = item["count"]
        if level in {"1", "2", "3", "4", "5", "6"}:
            levels_data.append({"level": level, "count": count})
        else:
            other_count += count
    
    # Sort numeric levels
    levels_data.sort(key=lambda x: int(x["level"]))
    
    # Add "Other" at the end if exists
    if other_count > 0:
        levels_data.append({"level": "Other", "count": other_count})
    
    return levels_data


def get_distinct_departments_case_insensitive() -> list[str]:
    """Return a case-insensitive distinct list of department names.

    Mirrors previous view logic but keeps it in the service layer.
    """
    values = (
        Course.objects.exclude(department="")
        .values_list("department", flat=True)
    )
    seen: dict[str, str] = {}
    for name in values:
        if not name:
            continue
        key = str(name).strip().lower()
        if key not in seen:
            seen[key] = str(name).strip()
    return sorted(seen.values(), key=lambda s: s.lower())


