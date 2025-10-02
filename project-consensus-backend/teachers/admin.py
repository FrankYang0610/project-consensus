from django.contrib import admin

from .models import Teacher


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "title", "rating_overall", "rating_reviews_count", "updated_at")
    list_filter = ("department", "title", "rating_grading")
    search_fields = ("name", "department")
    readonly_fields = ("created_at", "updated_at")

