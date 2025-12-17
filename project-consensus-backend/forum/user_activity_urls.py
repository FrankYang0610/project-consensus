from django.urls import path

from . import views


urlpatterns = [
    # Current user's forum activity
    path("my-posts/", views.UserPostsListView.as_view(), name="my_posts"),
    path("my-comments/", views.UserCommentsListView.as_view(), name="my_comments"),

    # Public user forum activity
    path("users/<str:user_id>/posts/", views.UserPostsListView.as_view(), name="public_user_posts"),
    path("users/<str:user_id>/comments/", views.UserCommentsListView.as_view(), name="public_user_comments"),
]
