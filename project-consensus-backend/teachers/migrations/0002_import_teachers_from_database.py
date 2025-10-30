from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict
import warnings

from django.db import migrations


def _get_database_teachers_dir() -> Path:
    backend_root = Path(__file__).resolve().parents[2]
    return backend_root / "database" / "teachers"


def _load_all_teacher_records() -> list[Dict[str, Any]]:
    data_dir = _get_database_teachers_dir()
    records: list[Dict[str, Any]] = []
    if not data_dir.exists():
        return records
    for json_file in sorted(data_dir.glob("*.json")):
        try:
            with json_file.open("r", encoding="utf-8") as f:
                data = json.load(f)
                # Parse teachers from JSON structure: {"teachers": [{"name": "...", ...}, ...], ...}
                if isinstance(data, dict) and "teachers" in data:
                    teachers = data.get("teachers", [])
                    if isinstance(teachers, list):
                        records.extend([r for r in teachers if isinstance(r, dict)])
        except Exception:
            continue
    return records


def _truncate(value: str, max_len: int) -> str:
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    if max_len <= 0:
        return value
    return value[:max_len]


def _normalize_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    name = (raw.get("name") or "").strip()
    title = (raw.get("title") or "").strip()
    department = (raw.get("dept_name") or "").strip()
    avatar_url = (raw.get("photo") or raw.get("avatar_url") or "").strip()
    email = (raw.get("email") or "").strip()
    office = (raw.get("office") or "").strip()
    homepage_url = (raw.get("homepage_url") or "").strip()

    # Build bio from biography + education + professional_qualifications
    # Format: biography + 2 empty lines + education + 2 empty lines + professional_qualifications
    # If a field is empty, don't add extra empty lines
    bio_parts = []
    
    biography = (raw.get("biography") or "").strip()
    education = (raw.get("education") or "").strip()
    # Format education: replace semicolon + optional space with newline
    # This ensures multiple education entries are displayed on separate lines
    if education:
        education = education.replace("; ", ";\n").strip()
    professional_qualifications = (raw.get("professional_qualifications") or "").strip()
    
    if biography:
        bio_parts.append(biography)
        # Add 2 empty lines only if there's a next field (education or professional_qualifications)
        if education or professional_qualifications:
            bio_parts.append("")  # First empty line
            bio_parts.append("")  # Second empty line
    
    if education:
        bio_parts.append(education)
        # Add 2 empty lines only if there's a next field (professional_qualifications)
        if professional_qualifications:
            bio_parts.append("")  # First empty line
            bio_parts.append("")  # Second empty line
    
    if professional_qualifications:
        bio_parts.append(professional_qualifications)
    
    bio = "\n".join(bio_parts)

    # Respect DB column lengths (per teachers.0001_initial)
    name = _truncate(name, 200)
    title = _truncate(title, 300)
    department = _truncate(department, 200)
    avatar_url = _truncate(avatar_url, 200)
    homepage_url = _truncate(homepage_url, 200)
    office = _truncate(office, 200)
    email = _truncate(email, 254)

    return {
        "name": name,
        "title": title,
        "department": department,
        "avatar_url": avatar_url,
        "email": email,
        "office": office,
        "homepage_url": homepage_url,
        "bio": bio,
    }


def import_teachers(apps, schema_editor):
    Teacher = apps.get_model("teachers", "Teacher")

    records = _load_all_teacher_records()
    if not records:
        print("  [teachers.0002] No teacher records found in database/teachers/")
        return

    duplicate_email_conflicts: list[str] = []
    created_count = 0
    skipped_no_name = 0

    for raw in records:
        normalized = _normalize_record(raw)
        if not normalized["name"]:
            skipped_no_name += 1
            continue

        email = normalized.get("email")
        if email and Teacher.objects.filter(email=email).exists():
            duplicate_email_conflicts.append(email)
            continue

        Teacher.objects.create(**normalized)
        created_count += 1

    print(f"  [teachers.0002] Successfully imported {created_count} teachers")
    if skipped_no_name > 0:
        print(f"  [teachers.0002] Skipped {skipped_no_name} records (no name)")
    if duplicate_email_conflicts:
        unique_emails = sorted(set(duplicate_email_conflicts))
        print(f"  [teachers.0002] Skipped {len(unique_emails)} records (duplicate emails)")
        warnings.warn(
            "Duplicate teacher emails found; refused to insert these records: "
            + ", ".join(unique_emails)
        )


class Migration(migrations.Migration):
    dependencies = [
        ("teachers", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(import_teachers, migrations.RunPython.noop),
    ]
