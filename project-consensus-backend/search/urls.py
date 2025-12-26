"""
URL configuration for the search app.
"""

from django.urls import path

from .views import search

urlpatterns = [
    path("search/", search, name="global_search"),
]

