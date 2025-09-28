from django.contrib import admin

from .models import Course


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "subject_code",
        "title",
        "department",
        "term_year",
        "term_semester",
        "last_updated",
    )
    search_fields = ("subject_code", "title", "department")
    list_filter = ("department", "term_semester")
    filter_horizontal = ("teachers",)

    fieldsets = (
        ("Basic Info", {
            "fields": ("subject_code", "title", "department"),
        }),
        ("Term", {
            "fields": ("term_year", "term_semester", "terms"),
        }),
        ("Rating", {
            "fields": (
                "rating_score",
                "rating_reviews_count",
                "rating_recommend_count",
                "rating_not_recommend_count",
            ),
        }),
        ("Attributes", {
            "fields": ("attr_difficulty", "attr_workload", "attr_grading", "attr_gain"),
        }),
        ("Metadata", {
            "fields": (
                "ai_summary",
                "selection_category",
                "teaching_type",
                "course_category",
                "offering_department",
                "level",
                "credits",
                "course_homepage_url",
                "syllabus_url",
                "last_updated",
            ),
        }),
        ("Curriculum", {
            "fields": ("curriculum",),
        }),
        ("Relations", {
            "fields": ("teachers",),
        }),
    )

