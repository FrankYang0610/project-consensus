from django.contrib import admin
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Profile


User = get_user_model()


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """
    Profile Admin Interface

    Provides a comprehensive interface for managing user profiles with filters,
    search, and useful displays.
    """
    list_display = (
        "id",
        "nickname",
        "user_email",
        "pronouns",
        "is_account_active",
        "forum_posts_count",
        "forum_post_comments_count",
        "course_reviews_count",
        "last_nickname_updated_at",
    )
    list_filter = (
        "is_account_active",
        "show_forum_posts_publicly",
        "show_forum_post_comments_publicly",
        "show_course_reviews_publicly",
    )
    search_fields = ("nickname", "user__username", "user__email")
    readonly_fields = (
        "id",
        "forum_posts_count",
        "forum_post_comments_count",
        "course_reviews_count",
        "last_nickname_updated_at",
        "days_until_nickname_change",
    )
    list_select_related = ["user"]

    fieldsets = (
        ("User", {
            "fields": ("id", "user"),
        }),
        ("Profile Info", {
            "fields": ("nickname", "avatar_url", "pronouns"),
        }),
        ("Privacy Settings", {
            "fields": (
                "show_forum_posts_publicly",
                "show_forum_post_comments_publicly",
                "show_course_reviews_publicly",
            ),
        }),
        ("Account Status", {
            "fields": ("is_account_active",),
        }),
        ("Stats (Read-only)", {
            "fields": (
                "forum_posts_count",
                "forum_post_comments_count",
                "course_reviews_count",
            ),
        }),
        ("Nickname Update", {
            "fields": ("last_nickname_updated_at", "days_until_nickname_change"),
        }),
    )

    @admin.display(description="Email", ordering="user__email")
    def user_email(self, obj):
        return obj.user.email

    @admin.display(description="Days Until Nickname Change Allowed")
    def days_until_nickname_change(self, obj):
        days = obj.days_until_nickname_update_allowed()
        if days is None:
            return "Can change now"
        return f"{days} days remaining"

    actions = ["activate_accounts", "deactivate_accounts"]

    @admin.action(description="Activate selected accounts")
    def activate_accounts(self, request, queryset):
        """Activate selected accounts"""
        updated = queryset.update(is_account_active=True)
        self.message_user(request, f"{updated} accounts activated.")

    @admin.action(description="Deactivate selected accounts")
    def deactivate_accounts(self, request, queryset):
        """Deactivate selected accounts"""
        updated = queryset.update(is_account_active=False)
        self.message_user(request, f"{updated} accounts deactivated.")

    def save_model(self, request, obj, form, change):
        """
        Override save to reset nickname cooldown when admin changes nickname.

        Admin can change nickname regardless of the cooldown restriction.
        After changing, the cooldown resets (last_nickname_updated_at = now).
        """
        if change and "nickname" in form.changed_data:
            obj.last_nickname_updated_at = timezone.now()
        super().save_model(request, obj, form, change)

