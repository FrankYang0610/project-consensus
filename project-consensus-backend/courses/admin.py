from django.contrib import admin

from .models import Course, CourseReview, CourseReviewReply, CourseReviewLike, CourseReviewReplyLike, CourseVote


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


@admin.register(CourseReview)
class CourseReviewAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "course_code_title",
        "author_name",
        "overall_rating",
        "is_anonymous",
        "only_text",
        "likes_count",
        "replies_count",
        "created_at",
    )
    list_filter = (
        "is_anonymous",
        "only_text",
        "attr_difficulty",
        "attr_workload",
        "attr_grading",
        "attr_gain",
        "term_semester",
        "created_at",
    )
    search_fields = ("course__subject_code", "course__title", "author__username", "content")
    readonly_fields = ("id", "created_at", "updated_at", "likes_count", "replies_count")
    date_hierarchy = "created_at"
    
    fieldsets = (
        ("Basic Info", {
            "fields": ("id", "course", "author", "content"),
        }),
        ("Rating & Attributes", {
            "fields": (
                "overall_rating",
                "attr_difficulty",
                "attr_workload",
                "attr_grading",
                "attr_gain",
            ),
        }),
        ("Options", {
            "fields": ("is_anonymous", "only_text"),
        }),
        ("Term", {
            "fields": ("term_year", "term_semester"),
        }),
        ("Stats", {
            "fields": ("likes_count", "replies_count"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )
    
    def course_code_title(self, obj):
        return f"{obj.course.subject_code} - {obj.course.title}"
    course_code_title.short_description = "Course"
    course_code_title.admin_order_field = "course__subject_code"
    
    def author_name(self, obj):
        if obj.is_anonymous:
            return f"{obj.author.username} (Anonymous)"
        return obj.author.username
    author_name.short_description = "Author"
    author_name.admin_order_field = "author__username"


@admin.register(CourseReviewReply)
class CourseReviewReplyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "review_course",
        "author_name",
        "reply_to_name",
        "content_preview",
        "likes_count",
        "is_deleted",
        "created_at",
    )
    list_filter = ("is_deleted", "created_at")
    search_fields = ("review__course__subject_code", "author__username", "content")
    readonly_fields = ("id", "created_at", "likes_count")
    date_hierarchy = "created_at"
    
    fieldsets = (
        ("Basic Info", {
            "fields": ("id", "review", "author", "content"),
        }),
        ("Reply Target", {
            "fields": ("reply_to_user",),
        }),
        ("Stats & Status", {
            "fields": ("likes_count", "is_deleted"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )
    
    def review_course(self, obj):
        return f"{obj.review.course.subject_code} - Review {str(obj.review.id)[:8]}"
    review_course.short_description = "Review/Course"
    
    def author_name(self, obj):
        return obj.author.username
    author_name.short_description = "Author"
    author_name.admin_order_field = "author__username"
    
    def reply_to_name(self, obj):
        return obj.reply_to_user.username if obj.reply_to_user else "-"
    reply_to_name.short_description = "Reply To"
    
    def content_preview(self, obj):
        from django.utils.html import strip_tags
        text = strip_tags(obj.content)
        return text[:50] + "..." if len(text) > 50 else text
    content_preview.short_description = "Content Preview"


@admin.register(CourseReviewLike)
class CourseReviewLikeAdmin(admin.ModelAdmin):
    list_display = ("user", "review_course", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "review__course__subject_code")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    
    def review_course(self, obj):
        return f"{obj.review.course.subject_code} - {str(obj.review.id)[:8]}"
    review_course.short_description = "Review/Course"


@admin.register(CourseReviewReplyLike)
class CourseReviewReplyLikeAdmin(admin.ModelAdmin):
    list_display = ("user", "reply_author", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "reply__author__username")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    
    def reply_author(self, obj):
        return obj.reply.author.username
    reply_author.short_description = "Reply Author"


@admin.register(CourseVote)
class CourseVoteAdmin(admin.ModelAdmin):
    list_display = ("user", "course_code", "value", "created_at")
    list_filter = ("value", "created_at")
    search_fields = ("user__username", "course__subject_code")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    
    def course_code(self, obj):
        return obj.course.subject_code
    course_code.short_description = "Course"
    course_code.admin_order_field = "course__subject_code"

