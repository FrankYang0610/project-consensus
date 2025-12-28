from django.contrib import admin
from django.contrib.admin import widgets
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.forms import CharField, EmailField, ModelForm, PasswordInput
from django.utils import timezone

from .models import Profile


User = get_user_model()


class ProfileAdminForm(ModelForm):
    """Custom form for Profile admin that allows creating User when creating Profile."""
    
    # Define User creation fields at class level so Django admin validation passes.
    # These will be removed in __init__ when editing an existing Profile.
    username = CharField(
        required=True,
        help_text="Required. 150 characters or fewer (5-30 characters recommended). Only allowed characters are letters, digits, underscore (_), and period (.)",
        widget=widgets.AdminTextInputWidget(),
    )
    email = EmailField(
        required=False,
        widget=widgets.AdminEmailInputWidget(),
        help_text="Optional. Email address for the user account.",
    )
    password = CharField(
        required=True,
        widget=PasswordInput(attrs={"class": "vTextField"}),
        help_text="Raw passwords are not stored, so there is no way to see this user's password.",
    )
    
    class Meta:
        model = Profile
        fields = "__all__"
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # When editing an existing Profile, remove User creation fields
        if self.instance.pk:
            self.fields.pop("username", None)
            self.fields.pop("email", None)
            self.fields.pop("password", None)
        else:
            # When creating a new Profile, make user field optional (will be created from username/password)
            # The user field may not be present if not in fieldsets
            if "user" in self.fields:
                self.fields["user"].required = False
                self.fields["user"].widget = widgets.AdminHiddenWidget()


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """
    Profile Admin Interface

    Provides a comprehensive interface for managing user profiles with filters,
    search, and useful displays.
    
    Supports creating new accounts (User + Profile) together.
    """
    form = ProfileAdminForm
    
    list_display = (
        "id",
        "nickname",
        "user_username",
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

    def get_fieldsets(self, request, obj=None):
        """Dynamic fieldsets: show User creation fields when creating new Profile."""
        if obj is None:  # Creating new Profile
            return (
                ("User Account (New)", {
                    "fields": ("username", "email", "password"),
                    "description": "Create a new user account.",
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
            )
        else:  # Editing existing Profile
            return (
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

    @admin.display(description="Username", ordering="user__username")
    def user_username(self, obj):
        return obj.user.username

    @admin.display(description="Email", ordering="user__email")
    def user_email(self, obj):
        return obj.user.email or "-"

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
        Override save to:
        1. Create User when creating new Profile (if username/password provided, email is optional)
        2. Reset nickname cooldown when admin changes nickname.
        """
        if not change:  # When creating a new Profile
            username = form.cleaned_data.get("username")
            email = form.cleaned_data.get("email")
            password = form.cleaned_data.get("password")
            
            if username and password:
                user = None
                try:
                    user = User.objects.filter(username=username).first()  # Check if user already exists
                except Exception:
                    pass
                
                if not user and email and hasattr(User, "email"):
                    try:
                        user = User.objects.filter(email=email).first()
                    except Exception:
                        pass
                
                if not user:
                    # Create new User (email is optional)
                    user_kwargs = {
                        "username": username,
                        "password": password,
                    }
                    if email:
                        user_kwargs["email"] = email
                    user = User.objects.create_user(**user_kwargs)
                obj.user = user
            else:
                # No username/password provided, raise error
                raise ValidationError("Please provide username and password to create a new user account.")
        
        # Reset nickname cooldown when admin changes nickname
        if change and "nickname" in form.changed_data:
            obj.last_nickname_updated_at = timezone.now()
        
        super().save_model(request, obj, form, change)

