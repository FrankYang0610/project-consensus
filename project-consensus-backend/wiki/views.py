"""
Wiki application views.

Provides ViewSets for WikiCategory and WikiPage models with appropriate permissions.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.conf import settings
import logging
from .models import WikiPage, WikiCategory
from .serializers import (
    WikiPageListSerializer,
    WikiPageDetailSerializer,
    WikiPageCreateUpdateSerializer,
    WikiCategorySerializer,
)
from .permissions import IsAdminOrReadOnly, IsStaffUser

logger = logging.getLogger(__name__)


class WikiCategoryViewSet(viewsets.ModelViewSet):
    """
    Wiki 分类视图集 / Wiki Category ViewSet
    
    Provides CRUD operations for wiki categories.
    
    - List/Retrieve: Available to all users
    - Create/Update/Delete: Admin only
    
    Endpoints:
        GET    /api/wiki/categories/        - List all categories
        POST   /api/wiki/categories/        - Create category (admin)
        GET    /api/wiki/categories/:slug/  - Retrieve category
        PUT    /api/wiki/categories/:slug/  - Update category (admin)
        DELETE /api/wiki/categories/:slug/  - Delete category (admin)
    """
    queryset = WikiCategory.objects.all()
    serializer_class = WikiCategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = 'slug'
    
    def get_serializer_context(self):
        """Provide translations_by_group to help serializer avoid N+1 for translations."""
        ctx = super().get_serializer_context()
        try:
            groups = list(self.get_queryset().values_list('translation_group', flat=True))
            items = (
                WikiCategory.objects
                .filter(translation_group__in=groups)
                .values('translation_group', 'id', 'language', 'slug')
            )
            mapping = {}
            for row in items:
                tg = row['translation_group']
                mapping.setdefault(tg, []).append({'id': row['id'], 'language': row['language'], 'slug': row['slug']})
            ctx['translations_by_group'] = mapping
        except Exception:
            # Fallback: no mapping, but log for observability
            logger.exception("Failed to build translations_by_group in WikiCategoryViewSet")
        return ctx

    def get_queryset(self):
        """
        获取查询集 / Get queryset
        
        Optionally filters by search query and language.
        """
        queryset = (
            super()
            .get_queryset()
            .annotate(
                page_count=Count('pages', filter=Q(pages__status='published'))
            )
        )
        
        # 语言过滤 / Language filter
        language = self.request.query_params.get('language', None)
        if language:
            queryset = queryset.filter(language=language)
        
        # 搜索功能 / Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        
        return queryset

    def get_object(self):
        """
        根据 slug 和 language 获取分类对象；若未提供 language，则默认 zh-CN
        """
        slug = self.kwargs.get(self.lookup_field)
        language = self.request.query_params.get('language') or settings.DEFAULT_CONTENT_LANGUAGE
        queryset = self.filter_queryset(self.get_queryset())
        return get_object_or_404(queryset, slug=slug, language=language)
    

class WikiPageViewSet(viewsets.ModelViewSet):
    """
    Wiki 页面视图集 / Wiki Page ViewSet
    
    Provides CRUD operations for wiki pages with search and filtering.
    
    - List/Retrieve: All users (only published pages for non-staff)
    - Create/Update/Delete: Admin only
    
    Endpoints:
        GET    /api/wiki/pages/        - List pages
        POST   /api/wiki/pages/        - Create page (admin)
        GET    /api/wiki/pages/:slug/  - Retrieve page
        PUT    /api/wiki/pages/:id/    - Update page (admin)
        DELETE /api/wiki/pages/:id/    - Delete page (admin)
    
    Query Parameters:
        - search: Search in title and content
        - category: Filter by category slug
        - status: Filter by status (admin only)
        - tags: Filter by tags (comma-separated)
        - language: Filter by BCP47 language code (e.g., 'zh-CN', 'zh-HK', 'en')
        - translation_group: Filter by translation group UUID
    """
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = 'slug'
    
    def get_serializer_class(self):
        """
        根据动作选择序列化器 / Choose serializer based on action
        
        - list: WikiPageListSerializer (without content)
        - retrieve: WikiPageDetailSerializer (with content)
        - create/update: WikiPageCreateUpdateSerializer
        """
        if self.action == 'list':
            return WikiPageListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return WikiPageCreateUpdateSerializer
        return WikiPageDetailSerializer
    
    def get_queryset(self):
        """
        获取查询集 / Get queryset
        
        Non-staff users can only see published pages.
        Supports filtering by search, category, status, tags, language, and translation group.
        """
        queryset = WikiPage.objects.select_related('author', 'category')
        
        # 普通用户只能看到已发布的页面
        # Non-staff users can only see published pages
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(status='published')
        
        # 语言过滤 / Language filter
        language = self.request.query_params.get('language', None)
        if language:
            queryset = queryset.filter(language=language)
        
        # 翻译组过滤 / Translation group filter
        translation_group = self.request.query_params.get('translation_group', None)
        if translation_group:
            queryset = queryset.filter(translation_group=translation_group)
        
        # 搜索功能 / Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search) |
                Q(summary__icontains=search)
            )
        
        # 分类过滤 / Category filter
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category__slug=category)
        
        # 状态过滤（仅管理员）/ Status filter (admin only)
        if self.request.user and self.request.user.is_staff:
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                queryset = queryset.filter(status=status_filter)
        
        # 标签过滤 / Tags filter
        tags = self.request.query_params.get('tags', None)
        if tags:
            # Split comma-separated tags and filter
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
            for tag in tag_list:
                queryset = queryset.filter(tags__icontains=tag)
        
        return queryset
    
    def get_object(self):
        """
        根据 slug 和 language 精确获取页面；默认 language=zh-CN
        """
        slug = self.kwargs.get(self.lookup_field)
        language = self.request.query_params.get('language') or settings.DEFAULT_CONTENT_LANGUAGE
        queryset = self.filter_queryset(self.get_queryset())
        return get_object_or_404(queryset, slug=slug, language=language)
    
    def retrieve(self, request, *args, **kwargs):
        """
        获取单个页面 / Retrieve a single page
        
        Increments view count when page is retrieved.
        """
        instance = self.get_object()
        
        # 增加浏览量（仅非管理员访问时）
        # Increment view count (only for non-staff access)
        if not (request.user and request.user.is_staff):
            instance.increment_view_count()
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """
        创建新页面 / Create new page
        
        Automatically sets the author to the current user.
        """
        serializer.save(author=self.request.user)
    
    def perform_update(self, serializer):
        """
        更新页面 / Update page
        
        Saves the updated page.
        """
        serializer.save()
    
    @action(detail=False, methods=['get'], permission_classes=[IsStaffUser])
    def drafts(self, request):
        """
        获取草稿列表（仅管理员）/ Get list of draft pages (admin only)
        
        Endpoint: GET /api/wiki/pages/drafts/
        """
        drafts = self.get_queryset().filter(status='draft')
        page = self.paginate_queryset(drafts)
        if page is not None:
            serializer = WikiPageListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = WikiPageListSerializer(drafts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsStaffUser])
    def publish(self, request, slug=None):
        """
        发布页面（仅管理员）/ Publish page (admin only)
        
        Endpoint: POST /api/wiki/pages/:slug/publish/
        """
        page = self.get_object()
        page.status = 'published'
        page.save(update_fields=['status'])
        
        serializer = WikiPageDetailSerializer(page)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsStaffUser])
    def unpublish(self, request, slug=None):
        """
        取消发布页面（仅管理员）/ Unpublish page (admin only)
        
        Endpoint: POST /api/wiki/pages/:slug/unpublish/
        """
        page = self.get_object()
        page.status = 'draft'
        page.save(update_fields=['status'])
        
        serializer = WikiPageDetailSerializer(page)
        return Response(serializer.data)

