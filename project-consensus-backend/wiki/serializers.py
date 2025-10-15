"""
Wiki application serializers.

Provides serializers for WikiCategory and WikiPage models.
"""

from rest_framework import serializers
from django.conf import settings
from .models import WikiPage, WikiCategory


class WikiCategorySerializer(serializers.ModelSerializer):
    """
    Wiki 分类序列化器 / Wiki Category Serializer
    
    Serializes WikiCategory with page count and language support.
    """
    page_count = serializers.SerializerMethodField()
    translations = serializers.SerializerMethodField()
    
    class Meta:
        model = WikiCategory
        fields = [
            'id', 'name', 'slug', 'description', 'order', 'page_count',
            'language', 'translation_group', 'translations', 'created_at'
        ]
        read_only_fields = ['created_at', 'translation_group']
    
    def get_page_count(self, obj):
        """
        返回该分类下已发布的页面数量（优先使用注解，避免 N+1）
        Returns count of published pages in this category (use annotation to avoid N+1).
        """
        annotated = getattr(obj, 'page_count', None)
        if annotated is not None:
            return annotated
        return obj.pages.filter(status='published').count()
    
    def get_translations(self, obj):
        """
        返回该分类的其他语言版本
        Returns other language versions of this category
        """
        mapping = self.context.get('translations_by_group') if hasattr(self, 'context') else None
        if mapping is not None:
            items = mapping.get(obj.translation_group, [])
            return [t for t in items if t.get('id') != obj.id]
        from .models import WikiCategory
        translations = WikiCategory.objects.filter(
            translation_group=obj.translation_group
        ).exclude(id=obj.id).values('id', 'language', 'slug')
        return list(translations)


class WikiPageListSerializer(serializers.ModelSerializer):
    """
    Wiki 页面列表序列化器 / Wiki Page List Serializer
    
    Simplified serializer for list views (without full content).
    Includes language support.
    """
    author_name = serializers.CharField(source='author.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    tags_list = serializers.SerializerMethodField()
    
    # Enforce API-level length constraint for summary
    summary = serializers.CharField(max_length=500, allow_blank=True, required=False)

    class Meta:
        model = WikiPage
        fields = [
            'id',
            'title',
            'slug',
            'summary',
            'category',
            'category_name',
            'tags',
            'tags_list',
            'status',
            'author',
            'author_name',
            'created_at',
            'updated_at',
            'view_count',
            'order',
            'language',
            'translation_group',
        ]
        read_only_fields = ['author', 'view_count', 'created_at', 'updated_at', 'translation_group']
    
    def get_tags_list(self, obj):
        """返回标签列表 / Return tags as a list"""
        return obj.get_tags_list()


class WikiPageDetailSerializer(serializers.ModelSerializer):
    """
    Wiki 页面详情序列化器 / Wiki Page Detail Serializer
    
    Full serializer including page content for detail views.
    Includes language and translation information.
    """
    author_name = serializers.CharField(source='author.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    tags_list = serializers.SerializerMethodField()
    translations = serializers.SerializerMethodField()
    
    class Meta:
        model = WikiPage
        fields = [
            'id',
            'title',
            'slug',
            'content',
            'summary',
            'category',
            'category_name',
            'tags',
            'tags_list',
            'status',
            'author',
            'author_name',
            'created_at',
            'updated_at',
            'view_count',
            'order',
            'language',
            'translation_group',
            'translations',
        ]
        read_only_fields = ['author', 'view_count', 'created_at', 'updated_at', 'translation_group']
    
    def get_tags_list(self, obj):
        """返回标签列表 / Return tags as a list"""
        return obj.get_tags_list()
    
    def get_translations(self, obj):
        """
        返回该页面的其他语言版本
        Returns other language versions of this page
        """
        translations = obj.get_translations().values(
            'id', 'title', 'slug', 'language', 'status'
        )
        return list(translations)
    
    def validate_title(self, value):
        """验证标题不为空 / Validate title is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty")
        return value.strip()
    
    def validate_content(self, value):
        """验证内容不为空 / Validate content is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Content cannot be empty")
        return value
    
    def validate_slug(self, value):
        """
        验证 slug 在相同语言下的唯一性 / Validate slug uniqueness per language
        
        Checks if slug is unique for the same language, excluding the current instance during updates.
        """
        if not value:
            return value
        
        # Get the instance being updated (if any)
        instance = self.instance
        language = self.initial_data.get('language') or settings.DEFAULT_CONTENT_LANGUAGE
        
        # Check if slug already exists for this language (excluding current instance)
        queryset = WikiPage.objects.filter(slug=value, language=language)
        if instance:
            queryset = queryset.exclude(pk=instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                f"A page with this slug already exists for language '{language}'"
            )

        return value


class WikiPageCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Wiki 页面创建/更新序列化器 / Wiki Page Create/Update Serializer
    
    Serializer for creating and updating wiki pages (admin only).
    Supports language and translation group management.
    """
    
    # Enforce API-level length constraint for summary
    summary = serializers.CharField(max_length=500, allow_blank=True, required=False)

    class Meta:
        model = WikiPage
        fields = [
            'title',
            'slug',
            'content',
            'summary',
            'category',
            'tags',
            'status',
            'order',
            'language',
            'translation_group',
        ]
        read_only_fields = ['translation_group']
    
    def validate_title(self, value):
        """验证标题不为空 / Validate title is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty")
        return value.strip()
    
    def validate_content(self, value):
        """验证内容不为空 / Validate content is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Content cannot be empty")
        return value
    
    def validate_slug(self, value):
        """
        验证 slug 在相同语言下的唯一性 / Validate slug uniqueness per language
        
        Checks if slug is unique for the same language, excluding the current instance during updates.
        """
        if not value:
            return value
        
        # Get the instance being updated (if any)
        instance = self.instance
        language = self.initial_data.get('language') or settings.DEFAULT_CONTENT_LANGUAGE
        
        # Check if slug already exists for this language (excluding current instance)
        queryset = WikiPage.objects.filter(slug=value, language=language)
        if instance:
            queryset = queryset.exclude(pk=instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError(
                f"A page with this slug already exists for language '{language}'"
            )
        
        return value
    
    def create(self, validated_data):
        """
        创建新的 Wiki 页面 / Create new wiki page
        
        Automatically sets the author from the request context.
        """
        # Author will be set by the view's perform_create method
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """
        更新 Wiki 页面 / Update wiki page
        
        Updates all provided fields.
        """
        return super().update(instance, validated_data)

