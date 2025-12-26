from django.apps import AppConfig


class CoursesConfig(AppConfig):
    """App config for the courses app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "courses"

    def ready(self):
        """Register models for audit logging."""
        from auditlog.registry import auditlog
        from .models import CourseReview, CourseReviewReply, CourseVote
        auditlog.register(CourseReview)
        auditlog.register(CourseReviewReply)
        auditlog.register(CourseVote)
