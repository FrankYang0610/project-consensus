"""
Wiki application URL configuration.

Defines URL patterns for wiki API endpoints using Django REST Framework routers.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WikiPageViewSet, WikiCategoryViewSet

# Create a router and register our viewsets with it
router = DefaultRouter()
router.register(r'pages', WikiPageViewSet, basename='wikipage')
router.register(r'categories', WikiCategoryViewSet, basename='wikicategory')

# The API URLs are determined automatically by the router
urlpatterns = [
    path('wiki/', include(router.urls)),
]

# Available endpoints:
#
# Wiki Pages:
#   GET    /api/wiki/pages/                  - List all pages (published only for non-staff)
#   POST   /api/wiki/pages/                  - Create new page (admin only)
#   GET    /api/wiki/pages/drafts/           - List draft pages (admin only)
#   GET    /api/wiki/pages/:slug/            - Retrieve page by slug
#   PUT    /api/wiki/pages/:slug/            - Update page (admin only)
#   PATCH  /api/wiki/pages/:slug/            - Partial update (admin only)
#   DELETE /api/wiki/pages/:slug/            - Delete page (admin only)
#   POST   /api/wiki/pages/:slug/publish/    - Publish page (admin only)
#   POST   /api/wiki/pages/:slug/unpublish/  - Unpublish page (admin only)
#
# Wiki Categories:
#   GET    /api/wiki/categories/           - List all categories
#   POST   /api/wiki/categories/           - Create new category (admin only)
#   GET    /api/wiki/categories/:slug/     - Retrieve category by slug
#   PUT    /api/wiki/categories/:slug/     - Update category (admin only)
#   PATCH  /api/wiki/categories/:slug/     - Partial update (admin only)
#   DELETE /api/wiki/categories/:slug/     - Delete category (admin only)
#
# Query parameters for pages:
#   ?search=query         - Search in title, content, and summary
#   ?category=slug        - Filter by category slug
#   ?status=draft         - Filter by status (admin only)
#   ?tags=tag1,tag2       - Filter by tags
#   ?language=zh-CN       - Filter by BCP47 language code (e.g., zh-CN, zh-HK, en)
#   ?translation_group=ID - Filter by translation group UUID

