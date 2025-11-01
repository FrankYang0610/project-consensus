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
    grade = (raw.get("grade") or "").strip()
    department = (raw.get("dept_name") or "").strip()
    avatar_url = (raw.get("photo") or raw.get("avatar_url") or "").strip()
    email = (raw.get("email") or "").strip()
    phone = (raw.get("phone") or "").strip()
    # Prefer explicit office, then fallback to "location" from scraper output
    office = (raw.get("office") or raw.get("location") or "").strip()

    # Use website.url as the sole source for website_url
    website = raw.get("website") or {}
    website_name = ""
    website_url = ""
    if isinstance(website, dict):
        website_name = (website.get("name") or "").strip()
        website_url = (website.get("url") or "").strip()

    profile_url = (raw.get("profile_url") or "").strip()
    scholars_hub_url = (raw.get("scholars_hub_url") or "").strip()

    # External IDs
    orcid = raw.get("orcid") or {}
    if isinstance(orcid, dict):
        orcid_id = (orcid.get("id") or "").strip()
        orcid_url = (orcid.get("url") or "").strip()
    else:
        orcid_id = ""
        orcid_url = ""

    scopus = raw.get("scopus") or {}
    if isinstance(scopus, dict):
        scopus_id = (scopus.get("id") or "").strip()
        scopus_url = (scopus.get("url") or "").strip()
    else:
        scopus_id = ""
        scopus_url = ""

    researcherid = raw.get("researcherid") or {}
    if isinstance(researcherid, dict):
        researcherid_id = (researcherid.get("id") or "").strip()
        researcherid_url = (researcherid.get("url") or "").strip()
    else:
        researcherid_id = ""
        researcherid_url = ""

    # Simple raw fields for frontend sections
    research_interests = (raw.get("research_interests") or "").strip()
    biography = (raw.get("biography") or "").strip()
    professional_qualifications = (raw.get("professional_qualifications") or "").strip()
    
    academic_and_professional_experience = (raw.get("academic_and_professional_experience") or "").strip()
    education = (raw.get("education") or "").strip()
    
    if education and academic_and_professional_experience:
        academic_and_professional_experience = f"Education: {education}\n\nAcademic and Professional Experience: {academic_and_professional_experience}"
    elif education:
        academic_and_professional_experience = education
    elif academic_and_professional_experience:
        pass
    else:
        academic_and_professional_experience = ""

    # Respect DB column lengths (per teachers.0001_initial)
    name = _truncate(name, 100)
    if not title:
        title = grade
    title = _truncate(title, 300)
    department = _truncate(department, 200)
    avatar_url = _truncate(avatar_url, 200)
    website_name = _truncate(website_name, 200)
    website_url = _truncate(website_url, 200)
    office = _truncate(office, 200)
    email = _truncate(email, 254)
    phone = _truncate(phone, 50)
    profile_url = _truncate(profile_url, 200)
    scholars_hub_url = _truncate(scholars_hub_url, 200)
    orcid_id = _truncate(orcid_id, 100)
    orcid_url = _truncate(orcid_url, 200)
    scopus_id = _truncate(scopus_id, 100)
    scopus_url = _truncate(scopus_url, 200)
    researcherid_id = _truncate(researcherid_id, 100)
    researcherid_url = _truncate(researcherid_url, 200)

    # Defaults for rating fields to satisfy serializer expectations
    # Floats: None when no reviews; Count: 0; Grading: empty string
    rating_overall = None
    rating_difficulty = None
    rating_friendliness = None
    rating_clarity = None
    rating_grading = ""
    rating_reviews_count = 0

    return {
        "name": name,
        "title": title,
        "department": department,
        "avatar_url": avatar_url,
        "email": email,
        "phone": phone,
        "office": office,
        "website_name": website_name,
        "website_url": website_url,
        "profile_url": profile_url,
        "scholars_hub_url": scholars_hub_url,
        "biography": biography,
        "research_interests": research_interests,
        "academic_and_professional_experience": academic_and_professional_experience,
        "professional_qualifications": professional_qualifications,
        "orcid_id": orcid_id,
        "orcid_url": orcid_url,
        "scopus_id": scopus_id,
        "scopus_url": scopus_url,
        "researcherid_id": researcherid_id,
        "researcherid_url": researcherid_url,
        # Rating defaults
        "rating_overall": rating_overall,
        "rating_difficulty": rating_difficulty,
        "rating_friendliness": rating_friendliness,
        "rating_clarity": rating_clarity,
        "rating_grading": rating_grading,
        "rating_reviews_count": rating_reviews_count,
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
