from django.urls import path
from . import views


urlpatterns = [
    # CSRF helper (sets csrftoken cookie)
    path("csrf/", views.csrf, name="csrf"),
    # Send register email verification code (POST: { email })
    path("send_verification_code/", views.send_verification_code, name="send_verification_code"),
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
    # User activity endpoints
    path("my-posts/", views.my_posts, name="my_posts"),
    path("my-comments/", views.my_comments, name="my_comments"),
    path("my-reviews/", views.my_reviews, name="my_reviews"),
    # Public user endpoints
    path("users/<str:user_id>/", views.public_user, name="public_user"),
    path("users/<str:user_id>/posts/", views.public_user_posts, name="public_user_posts"),
    path("users/<str:user_id>/comments/", views.public_user_comments, name="public_user_comments"),
    path("users/<str:user_id>/reviews/", views.public_user_reviews, name="public_user_reviews"),
]
