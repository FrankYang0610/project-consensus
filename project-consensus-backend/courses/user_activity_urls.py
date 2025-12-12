from django.urls import path

from . import views


urlpatterns = [
    # Current user's course review activity
    path("my-reviews/", views.UserReviewsListView.as_view(), name="my_reviews"),

    # Public user course review activity
    path("users/<str:user_id>/reviews/", views.UserReviewsListView.as_view(), name="public_user_reviews"),
]
