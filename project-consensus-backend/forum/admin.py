"""
Forum application Django admin configuration.

Provides admin interfaces for ForumPost, ForumPostComment, ForumPostLike,
and ForumCommentLike models.
"""

from django.contrib import admin
from django.db.models import Case, Count, Value, When
from django.utils.html import strip_tags

from .models import (
    ForumPost,
    ForumPostComment,
    ForumPostLike,
    ForumCommentLike,
    ForumCommentContentBackup,
)


@admin.register(ForumCommentContentBackup)
class ForumCommentContentBackupAdmin(admin.ModelAdmin):
    """Admin interface for viewing comment backups (read-only)."""
    list_display = ("comment_id", "content_preview", "deleted_by", "deleted_at")
    readonly_fields = ("comment_id", "content", "deleted_at", "deleted_by")
    search_fields = ("comment_id", "content")
    date_hierarchy = "deleted_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="Content Preview")
    def content_preview(self, obj):
        text = strip_tags(obj.content)
        return text[:80] + "..." if len(text) > 80 else text


@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    """
    Forum Post Admin Interface

    Provides a comprehensive interface for managing forum posts with filters,
    search, and bulk actions.
    """
    list_display = (
        "id",
        "title",
        "author_name",
        "tags_display",
        "likes_count",
        "comments_count",
        "is_anonymous",
        "is_edited",
        "has_content_warning",
        "created_at",
    )
    list_filter = (
        "is_anonymous",
        "is_edited",
        "has_content_warning",
        "created_at",
    )
    search_fields = ("title", "content", "author__username", "tags")
    readonly_fields = ("id", "created_at", "likes_count")
    date_hierarchy = "created_at"
    list_select_related = ["author"]

    fieldsets = (
        ("Basic Info", {
            "fields": ("id", "title", "author", "content"),
        }),
        ("Tags", {
            "fields": ("tags",),
        }),
        ("Options", {
            "fields": ("is_anonymous", "is_edited", "has_content_warning"),
        }),
        ("Stats", {
            "fields": ("likes_count",),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )

    @admin.display(description="Author", ordering="author__username")
    def author_name(self, obj):
        if obj.is_anonymous:
            return f"{obj.author.username} (Anonymous)"
        return obj.author.username

    @admin.display(description="Tags")
    def tags_display(self, obj):
        if obj.tags:
            return ", ".join(obj.tags[:3]) + ("..." if len(obj.tags) > 3 else "")
        return "-"

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        queryset = queryset.annotate(_comments_count=Count("comments"))
        return queryset

    @admin.display(description="Comments", ordering="_comments_count")
    def comments_count(self, obj):
        return obj._comments_count

    actions = ["toggle_content_warning", "clear_content_warning"]

    @admin.action(description="Toggle content warning on selected posts")
    def toggle_content_warning(self, request, queryset):
        """Toggle content warning for selected posts"""
        count = queryset.count()
        queryset.update(
            has_content_warning=Case(
                When(has_content_warning=True, then=Value(False)),
                default=Value(True),
            )
        )
        self.message_user(request, f"Content warning toggled for {count} posts.")

    @admin.action(description="Clear content warning on selected posts")
    def clear_content_warning(self, request, queryset):
        """Clear content warning for selected posts"""
        updated = queryset.update(has_content_warning=False)
        self.message_user(request, f"Content warning cleared for {updated} posts.")


@admin.register(ForumPostComment)
class ForumPostCommentAdmin(admin.ModelAdmin):
    """
    Forum Post Comment Admin Interface

    Provides interface for managing forum comments with soft deletion support.
    """
    list_display = (
        "id",
        "post_title",
        "author_name",
        "reply_to_name",
        "content_preview",
        "likes_count",
        "is_anonymous",
        "is_deleted",
        "created_at",
    )
    list_filter = (
        "is_deleted",
        "is_anonymous",
        "created_at",
    )
    search_fields = ("post__title", "author__username", "content")
    readonly_fields = ("id", "created_at", "likes_count")
    date_hierarchy = "created_at"
    list_select_related = ["author", "post", "reply_to"]

    fieldsets = (
        ("Basic Info", {
            "fields": ("id", "post", "author", "content"),
        }),
        ("Reply Target", {
            "fields": ("reply_to",),
        }),
        ("Options", {
            "fields": ("is_anonymous",),
        }),
        ("Stats & Status", {
            "fields": ("likes_count", "is_deleted"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )

    @admin.display(description="Post", ordering="post__title")
    def post_title(self, obj):
        return obj.post.title[:40] + "..." if len(obj.post.title) > 40 else obj.post.title

    @admin.display(description="Author", ordering="author__username")
    def author_name(self, obj):
        if obj.is_anonymous:
            return f"{obj.author.username} (Anonymous)"
        return obj.author.username

    @admin.display(description="Reply To")
    def reply_to_name(self, obj):
        if obj.reply_to and obj.reply_to.author:
            return obj.reply_to.author.username
        return "-"

    @admin.display(description="Content Preview")
    def content_preview(self, obj):
        if obj.is_deleted:
            return "[DELETED]"
        text = strip_tags(obj.content)
        return text[:50] + "..." if len(text) > 50 else text

    actions = ["soft_delete_comments", "restore_comments"]

    @admin.action(description="Soft delete selected comments (with backup)")
    def soft_delete_comments(self, request, queryset):
        """Soft delete comments: backup content, then mark as deleted and clear content."""
        # Only process comments that are not already deleted
        to_delete = queryset.filter(is_deleted=False).exclude(content="")

        # Backup content before deletion
        backups = []
        for comment in to_delete:
            backups.append(ForumCommentContentBackup(
                comment_id=comment.id,
                content=comment.content,
                deleted_by=request.user.username,
            ))

        # Bulk create backups (update if already exists)
        if backups:
            ForumCommentContentBackup.objects.bulk_create(
                backups,
                update_conflicts=True,
                unique_fields=["comment_id"],
                update_fields=["content", "deleted_at", "deleted_by"],
            )

        # Perform soft delete
        updated = to_delete.update(is_deleted=True, content="")
        already_deleted = queryset.filter(is_deleted=True).count()

        if already_deleted:
            self.message_user(
                request,
                f"{updated} comments soft deleted (content backed up). "
                f"{already_deleted} were already deleted."
            )
        else:
            self.message_user(
                request,
                f"{updated} comments soft deleted (content backed up)."
            )

    @admin.action(description="Restore selected comments (from backup)")
    def restore_comments(self, request, queryset):
        """Restore deleted comments from backup."""
        # Only process deleted comments
        to_restore = queryset.filter(is_deleted=True)

        restored_count = 0
        no_backup_count = 0

        for comment in to_restore:
            try:
                backup = ForumCommentContentBackup.objects.get(comment_id=comment.id)
                comment.content = backup.content
                comment.is_deleted = False
                comment.save(update_fields=["content", "is_deleted"])
                backup.delete()  # Remove backup after successful restore
                restored_count += 1
            except ForumCommentContentBackup.DoesNotExist:
                no_backup_count += 1

        not_deleted = queryset.filter(is_deleted=False).count()

        messages = []
        if restored_count:
            messages.append(f"{restored_count} comments restored")
        if no_backup_count:
            messages.append(f"{no_backup_count} had no backup")
        if not_deleted:
            messages.append(f"{not_deleted} were not deleted")

        if messages:
            self.message_user(request, ". ".join(messages) + ".")
        else:
            self.message_user(request, "No comments to restore.", level="warning")


@admin.register(ForumPostLike)
class ForumPostLikeAdmin(admin.ModelAdmin):
    """
    Forum Post Like Admin Interface

    Provides interface for viewing and managing post likes.
    """
    list_display = ("id", "user_name", "post_title", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "post__title")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    list_select_related = ["user", "post"]

    @admin.display(description="User", ordering="user__username")
    def user_name(self, obj):
        return obj.user.username

    @admin.display(description="Post", ordering="post__title")
    def post_title(self, obj):
        return obj.post.title[:40] + "..." if len(obj.post.title) > 40 else obj.post.title


@admin.register(ForumCommentLike)
class ForumCommentLikeAdmin(admin.ModelAdmin):
    """
    Forum Comment Like Admin Interface

    Provides interface for viewing and managing comment likes.
    """
    list_display = ("id", "user_name", "comment_author", "comment_preview", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "comment__author__username", "comment__content")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    list_select_related = ["user", "comment", "comment__author"]

    @admin.display(description="User", ordering="user__username")
    def user_name(self, obj):
        return obj.user.username

    @admin.display(description="Comment Author", ordering="comment__author__username")
    def comment_author(self, obj):
        return obj.comment.author.username

    @admin.display(description="Comment Preview")
    def comment_preview(self, obj):
        if obj.comment.is_deleted:
            return "[DELETED]"
        text = strip_tags(obj.comment.content)
        return text[:30] + "..." if len(text) > 30 else text

