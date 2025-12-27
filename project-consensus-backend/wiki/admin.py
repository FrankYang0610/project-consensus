"""
Wiki application Django admin configuration.

Provides admin interfaces for WikiCategory and WikiPage models.
"""

from django.contrib import admin
from django.contrib import messages
from django.db.models import Q, Count
from .models import WikiPage, WikiCategory


@admin.register(WikiCategory)
class WikiCategoryAdmin(admin.ModelAdmin):
    """
    Wiki 分类管理界面 / Wiki Category Admin
    
    Provides a clean interface for managing wiki categories with language support.
    """
    list_display = ['name', 'slug', 'language', 'order', 'page_count', 'created_at']
    list_editable = ['order']
    list_filter = ['language']
    search_fields = ['name', 'description', 'translation_group']
    prepopulated_fields = {'slug': ('name',)}
    ordering = ['language', 'order', 'name']
    
    def page_count(self, obj):
        """显示该分类下已发布页面数量（使用注解避免 N+1）/ Display published page count (uses annotation)"""
        annotated = getattr(obj, 'page_count', None)
        if annotated is not None:
            return annotated
        return obj.pages.filter(status='published').count()
    page_count.short_description = 'Pages'
    
    fieldsets = (
        ('基本信息 / Basic Information', {
            'fields': ('name', 'slug', 'description')
        }),
        ('语言设置 / Language Settings', {
            'fields': ('language', 'translation_group'),
            'description': 'Translation group links different language versions of the same category'
        }),
        ('显示设置 / Display Settings', {
            'fields': ('order',)
        }),
    )
    
    readonly_fields = ['translation_group']

    actions = ['create_zh_cn_translation', 'create_zh_hk_translation', 'create_en_translation']

    def _create_translation(self, request, queryset, target_language):
        created = 0
        skipped = 0
        conflicts = 0

        categories = list(queryset)
        groups = {c.translation_group for c in categories}
        slugs = {c.slug for c in categories}

        existing_groups = set(
            WikiCategory.objects.filter(
                translation_group__in=groups,
                language=target_language,
            ).values_list('translation_group', flat=True)
        )
        existing_by_slug = {
            row['slug']: row['translation_group']
            for row in WikiCategory.objects.filter(
                slug__in=slugs,
                language=target_language,
            ).values('slug', 'translation_group')
        }

        for category in categories:
            if category.language == target_language:
                skipped += 1
                continue

            if category.translation_group in existing_groups:
                skipped += 1
                continue

            existing_group_for_slug = existing_by_slug.get(category.slug)
            if existing_group_for_slug and existing_group_for_slug != category.translation_group:
                conflicts += 1
                continue

            WikiCategory.objects.create(
                name=category.name,
                slug=category.slug,
                description=category.description,
                order=category.order,
                language=target_language,
                translation_group=category.translation_group,
            )
            created += 1

        base_message = f"Created {created} translation(s), skipped {skipped}."
        if conflicts:
            base_message += f" {conflicts} slug conflict(s)."
        level = messages.WARNING if conflicts else messages.INFO
        self.message_user(request, base_message, level=level)

    @admin.action(description='创建简体中文翻译 / Create zh-CN translation')
    def create_zh_cn_translation(self, request, queryset):
        self._create_translation(request, queryset, 'zh-CN')

    @admin.action(description='创建繁體中文（香港）翻译 / Create zh-HK translation')
    def create_zh_hk_translation(self, request, queryset):
        self._create_translation(request, queryset, 'zh-HK')

    @admin.action(description='创建英文翻译 / Create English translation')
    def create_en_translation(self, request, queryset):
        self._create_translation(request, queryset, 'en')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(page_count=Count('pages', filter=Q(pages__status='published')))


@admin.register(WikiPage)
class WikiPageAdmin(admin.ModelAdmin):
    """
    Wiki 页面管理界面 / Wiki Page Admin
    
    Provides a comprehensive interface for managing wiki pages with filters,
    search, and bulk actions.
    """
    list_display = [
        'title',
        'language',
        'category',
        'status',
        'author',
        'view_count',
        'updated_at',
        'created_at',
    ]
    list_filter = [
        'language',
        'status',
        'category',
        'created_at',
        'updated_at',
    ]
    search_fields = [
        'title',
        'content',
        'summary',
        'tags',
        'translation_group',
    ]
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'created_at'
    ordering = ['-updated_at']
    list_select_related = ['author', 'category']
    
    # 只读字段 / Read-only fields
    readonly_fields = ['view_count', 'created_at', 'updated_at', 'author', 'translation_group']
    
    fieldsets = (
        ('基本信息 / Basic Information', {
            'fields': ('title', 'slug', 'status')
        }),
        ('语言设置 / Language Settings', {
            'fields': ('language', 'translation_group'),
            'description': 'Translation group links different language versions of the same page'
        }),
        ('内容 / Content', {
            'fields': ('summary', 'content'),
            'classes': ('wide',)
        }),
        ('分类和标签 / Category and Tags', {
            'fields': ('category', 'tags')
        }),
        ('显示设置 / Display Settings', {
            'fields': ('order',)
        }),
        ('元数据 / Metadata', {
            'fields': ('author', 'view_count', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """
        保存模型时自动设置作者 / Auto-set author when saving
        
        Sets the author to the current user when creating a new page.
        """
        if not change:  # Creating new object
            obj.author = request.user
        super().save_model(request, obj, form, change)
    
    actions = [
        'publish_pages',
        'unpublish_pages',
        'create_zh_cn_translation',
        'create_zh_hk_translation',
        'create_en_translation',
    ]

    def _create_translation(self, request, queryset, target_language):
        created = 0
        skipped = 0
        conflicts = 0
        category_fallbacks = 0

        pages = list(queryset.select_related('category'))
        groups = {p.translation_group for p in pages}
        slugs = {p.slug for p in pages}
        category_groups = {p.category.translation_group for p in pages if p.category is not None}

        existing_groups = set(
            WikiPage.objects.filter(
                translation_group__in=groups,
                language=target_language,
            ).values_list('translation_group', flat=True)
        )
        existing_by_slug = {
            row['slug']: row['translation_group']
            for row in WikiPage.objects.filter(
                slug__in=slugs,
                language=target_language,
            ).values('slug', 'translation_group')
        }
        translated_categories_by_group = {
            c.translation_group: c
            for c in WikiCategory.objects.filter(
                translation_group__in=category_groups,
                language=target_language,
            )
        }

        for page in pages:
            if page.language == target_language:
                skipped += 1
                continue

            if page.translation_group in existing_groups:
                skipped += 1
                continue

            existing_group_for_slug = existing_by_slug.get(page.slug)
            if existing_group_for_slug and existing_group_for_slug != page.translation_group:
                conflicts += 1
                continue

            target_category = page.category
            if page.category is not None:
                translated_category = translated_categories_by_group.get(page.category.translation_group)
                if translated_category is not None:
                    target_category = translated_category
                else:
                    category_fallbacks += 1

            WikiPage.objects.create(
                title=page.title,
                slug=page.slug,
                content=page.content,
                summary=page.summary,
                category=target_category,
                tags=page.tags,
                status='draft',
                order=page.order,
                language=target_language,
                translation_group=page.translation_group,
                author=page.author,
            )
            created += 1

        base_message = f"Created {created} translation(s), skipped {skipped}."
        if conflicts:
            base_message += f" {conflicts} slug conflict(s)."
        if category_fallbacks:
            base_message += (
                f" {category_fallbacks} page(s) kept the original category because no "
                f"translated category exists for '{target_language}'."
            )
        level = messages.WARNING if (conflicts or category_fallbacks) else messages.INFO
        self.message_user(request, base_message, level=level)

    @admin.action(description='发布选中的页面 / Publish selected pages')
    def publish_pages(self, request, queryset):
        """批量发布页面 / Bulk publish pages"""
        updated = queryset.update(status='published')
        self.message_user(
            request,
            f'{updated} pages were successfully published.'
        )

    @admin.action(description='创建简体中文翻译 / Create zh-CN translation')
    def create_zh_cn_translation(self, request, queryset):
        self._create_translation(request, queryset, 'zh-CN')

    @admin.action(description='创建繁體中文（香港）翻译 / Create zh-HK translation')
    def create_zh_hk_translation(self, request, queryset):
        self._create_translation(request, queryset, 'zh-HK')

    @admin.action(description='创建英文翻译 / Create English translation')
    def create_en_translation(self, request, queryset):
        self._create_translation(request, queryset, 'en')
    
    @admin.action(description='取消发布选中的页面 / Unpublish selected pages')
    def unpublish_pages(self, request, queryset):
        """批量取消发布页面 / Bulk unpublish pages"""
        updated = queryset.update(status='draft')
        self.message_user(
            request,
            f'{updated} pages were successfully unpublished.'
        )


# Optional: Customize the admin site header and title
# admin.site.site_header = "Project Consensus Wiki Admin"
# admin.site.site_title = "Wiki Admin Portal"
# admin.site.index_title = "Welcome to Wiki Administration"

