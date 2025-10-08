"""
Wiki application models.

Provides WikiCategory and WikiPage models for a Markdown-based knowledge base.
"""

from django.db import models
from django.db.models import F
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from django.core.exceptions import ValidationError
import uuid

User = get_user_model()


class LanguageChoices(models.TextChoices):
    """
    支持的语言选项 / Supported language options (subset of BCP 47)

    Only the following BCP 47 language codes are supported:
        - zh-CN: 简体中文
        - zh-HK: 繁體中文（香港）
        - en: English
    """
    ZH_CN = 'zh-CN', '简体中文'
    ZH_HK = 'zh-HK', '繁體中文（香港）'
    EN = 'en', 'English'


class WikiCategory(models.Model):
    """
    Wiki 分类 / Wiki Category
    
    Organizes wiki pages into categories for better navigation.
    Supports multiple languages with translation groups.
    """
    name = models.CharField(
        max_length=100,
        verbose_name="分类名称",
        help_text="Category name"
    )
    language = models.CharField(
        max_length=35,
        choices=LanguageChoices.choices,
        default=LanguageChoices.ZH_CN,
        verbose_name="语言",
        help_text="Content language"
    )
    translation_group = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        verbose_name="翻译组",
        help_text="UUID linking translations of the same category"
    )
    slug = models.SlugField(
        max_length=100,
        verbose_name="URL Slug",
        help_text="URL-friendly identifier (auto-generated from name if empty)"
    )
    description = models.TextField(
        blank=True,
        verbose_name="描述",
        help_text="Category description"
    )
    order = models.IntegerField(
        default=0,
        verbose_name="显示顺序",
        help_text="Display order (lower numbers appear first)"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="创建时间"
    )
    
    class Meta:
        verbose_name = "Wiki Category"
        verbose_name_plural = "Wiki Categories"
        ordering = ['order', 'name']
        unique_together = [['slug', 'language']]  # slug unique per language
        indexes = [
            models.Index(fields=['language', 'order'], name='wiki_cat_lang_order_idx'),
            models.Index(fields=['translation_group'], name='wiki_cat_trans_grp_idx'),
        ]
        constraints = [
            models.UniqueConstraint(fields=['translation_group', 'language'], name='wiki_cat_trans_lang_unique')
        ]
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """Auto-generate slug from name if not provided"""
        if not self.slug:
            base_slug = slugify(self.name)
            if not base_slug:
                base_slug = uuid.uuid4().hex[:8]
            slug = base_slug
            counter = 1
            # Ensure slug is unique per language
            while WikiCategory.objects.filter(slug=slug, language=self.language).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class WikiPage(models.Model):
    """
    Wiki 页面 / Wiki Page
    
    Individual wiki page with Markdown content, category, tags, and metadata.
    Supports multiple languages with translation groups.
    """
    
    STATUS_CHOICES = [
        ('draft', '草稿 / Draft'),
        ('published', '已发布 / Published'),
    ]
    
    # 基本信息 / Basic Information
    title = models.CharField(
        max_length=200,
        verbose_name="标题",
        help_text="Page title"
    )
    slug = models.SlugField(
        max_length=200,
        verbose_name="URL Slug",
        help_text="URL-friendly identifier (auto-generated from title if empty)"
    )
    language = models.CharField(
        max_length=35,
        choices=LanguageChoices.choices,
        default=LanguageChoices.ZH_CN,
        verbose_name="语言",
        help_text="Content language"
    )
    translation_group = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        verbose_name="翻译组",
        help_text="UUID linking translations of the same page"
    )
    
    # 内容 / Content
    content = models.TextField(
        verbose_name="内容",
        help_text="Page content in Markdown format"
    )
    summary = models.TextField(
        max_length=500,
        blank=True,
        verbose_name="摘要",
        help_text="Brief summary for listings (max 500 characters)"
    )
    
    # 分类和标签 / Category and Tags
    category = models.ForeignKey(
        WikiCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pages',
        verbose_name="分类",
        help_text="Page category"
    )
    tags = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="标签",
        help_text="Comma-separated tags (e.g., 'tutorial, beginner, setup')"
    )
    
    # 状态 / Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name="状态",
        help_text="Page status (draft or published)"
    )
    
    # 作者和时间 / Author and Timestamps
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='wiki_pages',
        verbose_name="作者",
        help_text="Page author"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="创建时间"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="更新时间"
    )
    
    # 元数据 / Metadata
    view_count = models.IntegerField(
        default=0,
        verbose_name="浏览次数",
        help_text="Number of times this page has been viewed"
    )
    order = models.IntegerField(
        default=0,
        verbose_name="显示顺序",
        help_text="Display order within category (lower numbers appear first)"
    )
    
    class Meta:
        verbose_name = "Wiki Page"
        verbose_name_plural = "Wiki Pages"
        ordering = ['-updated_at']
        unique_together = [['slug', 'language']]  # slug unique per language
        indexes = [
            models.Index(fields=['slug', 'language'], name='wiki_page_slug_lang_idx'),
            models.Index(fields=['status', '-updated_at'], name='wiki_page_status_updated_idx'),
            models.Index(fields=['category', 'order'], name='wiki_page_cat_order_idx'),
            models.Index(fields=['language', '-updated_at'], name='wiki_page_lang_updated_idx'),
            models.Index(fields=['translation_group'], name='wiki_page_trans_grp_idx'),
        ]
        constraints = [
            models.UniqueConstraint(fields=['translation_group', 'language'], name='wiki_page_trans_lang_unique')
        ]
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """Auto-generate slug from title if not provided"""
        if not self.slug:
            base_slug = slugify(self.title)
            if not base_slug:
                base_slug = uuid.uuid4().hex[:8]
            slug = base_slug
            counter = 1
            
            # Ensure slug is unique per language
            while WikiPage.objects.filter(slug=slug, language=self.language).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            self.slug = slug
        
        super().save(*args, **kwargs)
    
    def clean(self):
        """Validate model fields"""
        super().clean()
        
        # Ensure title is not empty after stripping whitespace
        if not self.title or not self.title.strip():
            raise ValidationError({'title': 'Title cannot be empty'})
        
        # Ensure content is not empty
        if not self.content or not self.content.strip():
            raise ValidationError({'content': 'Content cannot be empty'})
    
    def get_tags_list(self):
        """
        返回标签列表 / Return list of tags
        
        Returns:
            list: List of tag strings
        """
        if not self.tags:
            return []
        return [tag.strip() for tag in self.tags.split(',') if tag.strip()]
    
    def increment_view_count(self):
        """增加浏览次数（原子操作）/ Increment view count atomically"""
        type(self).objects.filter(pk=self.pk).update(view_count=F('view_count') + 1)
        self.refresh_from_db(fields=['view_count'])
    
    def get_translations(self):
        """
        获取此页面的所有翻译版本 / Get all translations of this page
        
        Returns:
            QuerySet: All pages in the same translation group
        """
        return WikiPage.objects.filter(
            translation_group=self.translation_group
        ).exclude(pk=self.pk)

