from django.urls import path
from . import views


urlpatterns = [
    path("", views.notifications_list, name="notifications_list"),
    path("unread_count/", views.notifications_unread_count, name="notifications_unread_count"),
    path("mark_read/", views.notifications_mark_read, name="notifications_mark_read"),
    path("mark_all_read/", views.notifications_mark_all_read, name="notifications_mark_all_read"),
    path("delete_read/", views.notifications_delete_read, name="notifications_delete_read"),
    path("stream/", views.notifications_stream, name="notifications_stream"),
]


