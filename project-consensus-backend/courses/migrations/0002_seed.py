"""
Data seed migration for local/dev testing.

Creates:
- 500 seed courses
- 5000 course reviews
- 1000 review replies

Rules (deterministic with fixed seed):
- Seeded courses have subject codes prefixed with "SEED-" and course_category="seed"
- Reasonable random distributions for attributes and terms
- Reviews correlate rating with difficulty/gain a bit

Reverse migration removes only the seeded courses (by marker), cascading their
reviews/replies. It intentionally does not delete users/teachers created to
meet minimum counts.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from django.conf import settings
from django.db import migrations
from django.utils import timezone


# Constants
N_COURSES = 500
N_REVIEWS = 5000
N_REPLIES = 1000
RANDOM_SEED = 20240930
MIN_USERS = 400
MIN_TEACHERS = 120


def _rand_choice_weighted(pairs):
    keys = [k for k, _ in pairs]
    weights = [w for _, w in pairs]
    return random.choices(keys, weights=weights, k=1)[0]


def _rand_words(min_w: int = 4, max_w: int = 12) -> str:
    words = [
        "advanced", "introductory", "applied", "theoretical", "practical",
        "comprehensive", "modern", "fundamental", "experimental", "systematic",
        "algorithm", "data", "analysis", "structures", "optimization",
        "design", "modeling", "simulation", "networks", "computing",
        "chemistry", "physics", "algebra", "history", "psychology",
        "economics", "engineering", "biology", "art", "statistics",
    ]
    n = random.randint(min_w, max_w)
    return " ".join(random.choices(words, k=n)).capitalize()


def _rand_html_paragraphs(n: int = 2) -> str:
    paras = []
    for _ in range(n):
        s = _rand_words(20, 40)
        paras.append(f"<p>{s}.</p>")
    return "\n".join(paras)


def _rand_semester() -> str:
    return random.choice(["spring", "summer", "fall"])


def _maybe(prob: float) -> bool:
    return random.random() < prob


def _ensure_min_users(apps, min_users: int):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    Profile = apps.get_model("accounts", "Profile")

    existing = User.objects.count()
    if existing >= min_users:
        return

    to_create = min_users - existing
    base_index = existing + 1
    for i in range(base_index, base_index + to_create):
        username = f"seeduser{i:04d}"
        email = f"{username}@example.com"
        # Idempotent-ish: skip if email already exists
        if User.objects.filter(email=email).exists():
            continue
        user = User(username=username, email=email, is_active=True)
        # Set a simple password for dev usage
        try:
            user.set_password("password123")
        except Exception:
            # Historical model still provides set_password; this is a safeguard
            user.password = "password123"
        user.save()
        # Create profile
        try:
            Profile.objects.create(user=user, nickname=f"User {i}")
        except Exception:
            # If Profile model or relation differs in historical state, ignore
            pass


def _ensure_min_teachers(apps, min_teachers: int):
    Teacher = apps.get_model("teachers", "Teacher")
    total = Teacher.objects.count()
    if total >= min_teachers:
        return
    for i in range(total + 1, min_teachers + 1):
        Teacher.objects.create(
            name=f"Teacher {i}",
            title=random.choice(["Professor", "Associate Professor", "Lecturer", "Dr."]),
            department=random.choice([
                "Computer Science", "Mathematics", "Physics", "Chemistry", "Economics",
                "Psychology", "Electrical Engineering", "Biology", "History", "Art",
            ]),
            # avatar_url留空，将使用教师姓名首字母作为默认头像
            email=f"teacher{i}@university.edu",
            office=f"Bldg {random.randint(1,9)}-{random.randint(101, 699)}",
            office_hours=random.choice(["Mon 14:00-16:00", "Wed 10:00-12:00", "Fri 13:00-15:00"]),
            website_url="",
            biography=_rand_words(12, 24),
            tags=[random.choice(["AI", "ML", "Systems", "Theory", "HCI", "Statistics"]) for _ in range(random.randint(1, 3))],
            languages=random.sample(["English", "Chinese", "Portuguese", "Spanish"], k=random.randint(1, 2)),
            years_experience=random.randint(1, 30),
            rating_overall=round(random.uniform(3.0, 9.5), 1),
            rating_difficulty=round(random.uniform(2.0, 8.0), 1),
            rating_friendliness=round(random.uniform(3.0, 9.5), 1),
            rating_clarity=round(random.uniform(3.0, 9.5), 1),
            rating_grading=random.choice(["lenient", "balanced", "strict"]),
            rating_reviews_count=random.randint(0, 200),
        )


def _gen_subject_code(dept_code: str, used_codes: set[str]) -> str:
    # Generate a SEED-prefixed subject code, ensuring uniqueness within this run
    # e.g., SEED-CS-0123
    for _ in range(10000):
        code = f"SEED-{dept_code}-{random.randint(0, 9999):04d}"
        if code not in used_codes:
            used_codes.add(code)
            return code
    # Fallback; extremely unlikely
    n = len(used_codes) + 1
    code = f"SEED-{dept_code}-{n:04d}"
    used_codes.add(code)
    return code


def _generate_courses(apps):
    Course = apps.get_model("courses", "Course")
    Teacher = apps.get_model("teachers", "Teacher")

    departments = [
        ("CS", "Computer Science"), ("MATH", "Mathematics"), ("PHYS", "Physics"), ("CHEM", "Chemistry"),
        ("ECON", "Economics"), ("PSY", "Psychology"), ("EE", "Electrical Engineering"), ("BIO", "Biology"),
        ("HIST", "History"), ("ART", "Art"),
    ]
    selection_categories = ["major", "elective", "core", "general", "minor"]
    teaching_types = ["lecture", "seminar", "lab", "project"]
    # align with frontend detailedCategory options used for filtering
    course_categories = ["projectHeavy", "examHeavy", "writingIntensive", "presentationHeavy"]

    teachers = list(Teacher.objects.all())
    used_codes: set[str] = set()
    created_courses = []

    for _ in range(N_COURSES):
        dept_code, dept_name = random.choice(departments)
        subject_code = _gen_subject_code(dept_code, used_codes)
        title = _rand_words(3, 7)
        term_year = random.randint(datetime.now().year - 4, datetime.now().year)
        term_semester = _rand_semester()

        # Terms history: include 1–3 terms including current
        terms = []
        for _i in range(random.randint(1, 3)):
            y = term_year - random.randint(0, 2)
            s = _rand_semester()
            terms.append({"year": y, "semester": s})

        c = Course.objects.create(
            subject_code=subject_code,
            title=title,
            term_year=term_year,
            term_semester=term_semester,
            rating_score=0.0,
            rating_reviews_count=0,
            rating_recommend_count=random.randint(0, 30),
            rating_not_recommend_count=random.randint(0, 10),
            attr_difficulty=random.choice(["veryEasy", "easy", "medium", "hard", "veryHard"]),
            attr_workload=random.choice(["light", "moderate", "heavy", "veryHeavy"]),
            attr_grading=random.choice(["lenient", "balanced", "strict", "killer"]),
            attr_gain=random.choice(["low", "decent", "high"]),
            terms=terms,
            department=dept_name,
            last_updated=timezone.now(),
            ai_summary=_rand_words(24, 48),
            selection_category=random.choice(selection_categories),
            teaching_type=random.choice(teaching_types),
            course_category=random.choice(course_categories),  # marker
            offering_department=dept_name,
            level=random.choice(["1", "2", "3", "4", "5", "6"]),
            credits=random.choice(["2.0", "2.5", "3.0", "3.5", "4.0"]),
            course_homepage_url="",
            syllabus_url="",
            curriculum=(
                []
                if _maybe(0.6)
                else [
                    {
                        "id": dept_code.lower(),
                        "name": f"Faculty of {dept_name}",
                        "majors": [
                            {
                                "id": dept_code.lower() + "-major",
                                "name": f"{dept_name} Major",
                                "semesters": [
                                    {
                                        "id": f"{dept_code.lower()}-{term_year}-{term_semester}",
                                        "year": term_year,
                                        "semester": term_semester,
                                        "url": f"/programs/{dept_code.lower()}/{term_year}-{term_semester}",
                                        "yearLevel": random.choice(["y1", "y2", "y3", "y4"]),
                                    }
                                ],
                            }
                        ],
                    }
                ]
            ),
        )

        # Attach 1–2 teachers if available
        if teachers:
            try:
                for t in random.sample(teachers, k=random.randint(1, min(2, len(teachers)))):
                    c.teachers.add(t)
            except Exception:
                # Fallback: ignore M2M issues in historical context
                pass
        created_courses.append(c)

    return created_courses


def _generate_reviews(apps, courses):
    CourseReview = apps.get_model("courses", "CourseReview")
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)

    users = list(User.objects.all())
    out = []
    now = timezone.now()
    # Ensure uniqueness (author, course) to satisfy unique_course_review_per_user
    seen_pairs = set()
    try:
        # Include any pre-existing pairs (should be none in fresh seed)
        existing = CourseReview.objects.values_list("course_id", "author_id")
        seen_pairs.update(existing)
    except Exception:
        pass

    attempts = 0
    target = N_REVIEWS
    max_attempts = N_REVIEWS * 8  # cap to avoid infinite loop in small user/course sets
    while len(out) < target and attempts < max_attempts:
        attempts += 1
        course = random.choice(courses)
        author = random.choice(users)
        pair = (course.pk, author.pk)
        if pair in seen_pairs:
            continue
        only_text = _maybe(0.12)
        is_anon = _maybe(0.15)
        rating = 0.0 if only_text else round(random.uniform(3.0, 9.8), 1)
        difficulty = _rand_choice_weighted([
            ("veryEasy", 1.0 if rating >= 8.0 else 0.3),
            ("easy", 1.5 if rating >= 7.0 else 0.8),
            ("medium", 2.0),
            ("hard", 1.2 if rating <= 6.0 else 0.7),
            ("veryHard", 0.6 if rating <= 5.0 else 0.3),
        ])
        workload = random.choice(["light", "moderate", "heavy", "veryHeavy"])
        grading = random.choice(["lenient", "balanced", "strict", "killer"])
        gain = _rand_choice_weighted([
            ("low", 0.4 if rating <= 5.0 else 0.2),
            ("decent", 2.0),
            ("high", 1.8 if rating >= 7.0 else 0.9),
        ])

        created_at = now - timedelta(days=random.randint(0, 730), hours=random.randint(0, 23), minutes=random.randint(0, 59))
        term_year = course.term_year if _maybe(0.5) else max(course.term_year - random.randint(0, 2), course.term_year - 2)
        term_semester = course.term_semester if _maybe(0.5) else _rand_semester()

        review = CourseReview.objects.create(
            course=course,
            author=author,
            overall_rating=rating,
            attr_difficulty=difficulty,
            attr_workload=workload,
            attr_grading=grading,
            attr_gain=gain,
            content=_rand_html_paragraphs(random.randint(1, 3)),
            is_anonymous=is_anon,
            only_text=only_text,
            likes_count=random.randint(0, 25),
            created_at=created_at,
            term_year=term_year,
            term_semester=term_semester,
        )
        out.append(review)
        seen_pairs.add(pair)
    return out


def _generate_replies(apps, reviews):
    CourseReviewReply = apps.get_model("courses", "CourseReviewReply")
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)

    users = list(User.objects.all())
    out = []
    now = timezone.now()
    if not reviews:
        return out
    for _ in range(N_REPLIES):
        review = random.choice(reviews)
        author = random.choice(users)
        reply_to_user = author if _maybe(0.3) else None
        created_at = now - timedelta(days=random.randint(0, 730), hours=random.randint(0, 23), minutes=random.randint(0, 59))
        reply = CourseReviewReply.objects.create(
            review=review,
            author=author,
            content=_rand_html_paragraphs(1),
            created_at=created_at,
            likes_count=random.randint(0, 10),
            reply_to_user=reply_to_user,
            is_deleted=False,
        )
        out.append(reply)
    # Soft-delete a subset (e.g., ~5%) to simulate placeholders
    if out:
        k = max(1, len(out) // 20)
        for r in random.sample(out, k=k):
            # Clear content and mark as deleted to match soft-delete contract
            CourseReviewReply.objects.filter(pk=r.pk).update(is_deleted=True, content="")
    return out


def _recompute_course_aggregates(apps, courses):
    from django.db.models import Avg, Count
    Course = apps.get_model("courses", "Course")
    CourseReview = apps.get_model("courses", "CourseReview")
    for c in courses:
        # Count all reviews (including text-only) for reviewsCount
        total_count = CourseReview.objects.filter(course=c).count()
        # Only use reviews with ratings for score calculation
        qs = CourseReview.objects.filter(course=c, only_text=False)
        res = qs.aggregate(avg=Avg("overall_rating"), cnt=Count("id"))
        rated_cnt = int(res.get("cnt") or 0)
        avg = float(res.get("avg") or 0.0)
        score = round(avg, 1) if rated_cnt > 0 else 0.0
        Course.objects.filter(pk=c.pk).update(rating_reviews_count=total_count, rating_score=score)


def _recompute_replies_count(apps, reviews):
    from django.db.models import Count
    CourseReview = apps.get_model("courses", "CourseReview")
    CourseReviewReply = apps.get_model("courses", "CourseReviewReply")
    # Only count non-deleted replies for UI display
    counts = CourseReviewReply.objects.filter(is_deleted=False).values("review_id").annotate(cnt=Count("id"))
    mapping = {row["review_id"]: row["cnt"] for row in counts}
    for r in reviews:
        CourseReview.objects.filter(pk=r.pk).update(replies_count=mapping.get(r.pk, 0))


def _recompute_teacher_aggregates(apps):
    """Recompute rating for all teachers based on their course reviews."""
    from django.db.models import Avg, Count
    Teacher = apps.get_model("teachers", "Teacher")
    CourseReview = apps.get_model("courses", "CourseReview")
    
    for teacher in Teacher.objects.all():
        # Find all reviews for courses taught by this teacher
        qs = CourseReview.objects.filter(
            course__teachers=teacher,
            only_text=False
        )
        agg = qs.aggregate(avg=Avg("overall_rating"), cnt=Count("id"))
        count = int(agg.get("cnt") or 0)
        avg = float(agg.get("avg") or 0.0)
        score = round(avg, 1) if count > 0 else None
        
        Teacher.objects.filter(pk=teacher.pk).update(
            rating_overall=score,
            rating_reviews_count=count,
        )


def seed_forward(apps, schema_editor):
    random.seed(RANDOM_SEED)
    _ensure_min_users(apps, MIN_USERS)
    _ensure_min_teachers(apps, MIN_TEACHERS)

    courses = _generate_courses(apps)
    reviews = _generate_reviews(apps, courses)
    _generate_replies(apps, reviews)
    _recompute_course_aggregates(apps, courses)
    _recompute_replies_count(apps, reviews)
    _recompute_teacher_aggregates(apps)


def seed_reverse(apps, schema_editor):
    # Remove only the seeded courses; related reviews/replies cascade.
    Course = apps.get_model("courses", "Course")
    Course.objects.filter(course_category="seed").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0001_initial"),
        ("accounts", "0002_create_demo_user"),
        ("teachers", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_reverse),
    ]
