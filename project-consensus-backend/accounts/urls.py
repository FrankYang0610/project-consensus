from django.urls import path

from . import views


urlpatterns = [
    # CSRF helper (sets csrftoken cookie)
    path("csrf/", views.csrf, name="csrf"),
    # Send register email verification code (POST: { email })
    path(
        "send_verification_code/",
        views.send_verification_code,
        name="send_verification_code",
    ),
    # Register with a verification code (POST: { nickname, email, verification_code, password })
    path("register/", views.register, name="register"),
    # Login with email/password (POST: { email, password })
    path("login/", views.login_view, name="login"),
    # Logout (POST, clears session)
    path("logout/", views.logout_view, name="logout"),
    # Current user info
    path("me/", views.me, name="me"),
    # Update profile (PATCH)
    path("profile/", views.update_profile, name="update_profile"),
    # Password reset endpoints
    path(
        "password-reset/request/",
        views.request_password_reset,
        name="password_reset_request",
    ),
    path(
        "password-reset/confirm/",
        views.confirm_password_reset,
        name="password_reset_confirm",
    ),
    # Public user base profile endpoint (posts/comments/reviews live in forum/courses)
    path("users/<str:user_id>/", views.public_user, name="public_user"),
]
