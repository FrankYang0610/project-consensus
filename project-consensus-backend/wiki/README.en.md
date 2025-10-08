# Wiki Backend Module (Django REST Framework)

This document explains the backend architecture, data model, API surface, and operational notes for the Wiki feature.

## Overview

- Framework: Django 5 + Django REST Framework (DRF)
- Purpose: Markdown-based knowledge base with categories, tags, translations (BCP‑47 language codes), and simple search.
- Access model: Read for everyone, write/admin actions restricted to staff.

## Directory layout (wiki/)

- `models.py` — `WikiCategory`, `WikiPage`, `LanguageChoices`
- `serializers.py` — Category/Page serializers (list/detail/create-update)
- `views.py` — DRF viewsets (`WikiCategoryViewSet`, `WikiPageViewSet`) and admin-only actions
- `urls.py` — DRF `DefaultRouter` registrations under `/api/wiki/`
- `permissions.py` — `IsAdminOrReadOnly`, `IsStaffUser`
- `migrations/` — schema + seed data (`0001_initial.py`, `0002_seed_wiki_data.py`, `0003_bcp47_language_update.py`)

Global configuration of interest lives in `config/settings.py`:

- `DEFAULT_CONTENT_LANGUAGE` (default: `zh-CN`)
- CORS/CSRF/session and DRF renderer/parser settings

## Data model

### LanguageChoices

- BCP‑47 language codes: `'zh-CN' | 'zh-HK' | 'en'`

### WikiCategory

- Fields: `id`, `name`, `slug`, `description`, `order`, `language`, `translation_group (UUID)`, `created_at`
- Constraints/indices:
  - `unique_together = [['slug', 'language']]` — slug uniqueness within a language
  - Unique per translation group and language (`wiki_cat_trans_lang_unique`)
  - Indices on `(language, order)` and `translation_group`
- Behavior:
  - `save()` autogenerates `slug` from `name`, unique within the same `language`

### WikiPage

- Fields: `id`, `title`, `slug`, `content (Markdown)`, `summary`, `category (FK)`, `tags (comma‑separated)`, `status in {'draft','published'}`, `author (FK)`, `created_at`, `updated_at`, `view_count`, `order`, `language`, `translation_group (UUID)`
- Constraints/indices:
  - `unique_together = [['slug', 'language']]`
  - Indices on `(slug, language)`, `(status, -updated_at)`, `(category, order)`, `(language, -updated_at)`, and `translation_group`
- Helper methods:
  - `get_tags_list()` — splits `tags` into a list
  - `increment_view_count()` — atomic view count increment
  - `get_translations()` — other pages in the same `translation_group`
- Behavior:
  - `save()` autogenerates `slug` from `title`, unique within the same `language`

## Serializers

### WikiCategorySerializer

- Fields: `id, name, slug, description, order, page_count, language, translation_group, translations, created_at`
- `page_count`: published pages count (uses annotation where available)
- `translations`: list of `{id, language, slug}` for siblings in the same `translation_group` (excludes self). Optimized via `translations_by_group` context when available.

### WikiPageListSerializer

- List shape without full content. Fields:
  - `id, title, slug, summary, category, category_name, tags, tags_list, status, author, author_name, created_at, updated_at, view_count, order, language, translation_group`
- `tags_list` derived from `tags`
- `summary` length enforced (500)

### WikiPageDetailSerializer

- Full detail including content and translations. Fields:
  - All list fields + `content`, `translations[]` (`{id, title, slug, language, status}`)
- Validations for `title`, `content`, `slug` (unique per language during updates)

### WikiPageCreateUpdateSerializer

- Fields accepted for write: `title, slug, content, summary, category, tags, status, order, language, translation_group`
- Validations:
  - `title`/`content` not empty
  - `slug` uniqueness per language (excludes current instance)

## Permissions

- `IsAdminOrReadOnly` — everyone can read (`SAFE_METHODS`), only staff can write (POST/PUT/PATCH/DELETE)
- `IsStaffUser` — used for staff‑only actions like listing drafts, publishing/unpublishing

## Views and endpoints

Paths are mounted via `config/urls.py` → `path('api/', include('wiki.urls'))`.
`wiki/urls.py` registers DRF router under `/api/wiki/`:

### Categories

- `GET /api/wiki/categories/` — list categories
  - Query params: `language?`, `search?`
- `GET /api/wiki/categories/:slug/` — retrieve by `slug` and `language` (param; default `DEFAULT_CONTENT_LANGUAGE`)
- `POST/PUT/PATCH/DELETE` — admin only

### Pages

- `GET /api/wiki/pages/` — list pages
  - Non‑staff only see `status='published'`
  - Query params:
    - `search` — `icontains` against `title`, `content`, `summary`
    - `category` — filter by category `slug`
    - `status` — admin only
    - `tags` — comma‑separated; AND semantics by chaining `tags__icontains` filters
    - `language` — BCP‑47 code
    - `translation_group` — UUID
- `GET /api/wiki/pages/:slug/` — retrieve by `slug` and `language` (param; default `DEFAULT_CONTENT_LANGUAGE`)
  - Side effect: increments `view_count` for non‑staff requests
- Admin actions (detail routes):
  - `POST /api/wiki/pages/:slug/publish/`
  - `POST /api/wiki/pages/:slug/unpublish/`
- Staff‑only list action:
  - `GET /api/wiki/pages/drafts/`

Notes:

- Default ordering: pages are ordered by `-updated_at` (most recent first). No ordering query param is exposed yet.
- Pagination is not configured; lists return all items.

## URL lookups and language behavior

- Both categories and pages use `lookup_field = 'slug'`. Requests can specify `?language=...`.
- If `language` is absent, backend uses `settings.DEFAULT_CONTENT_LANGUAGE` (default `zh-CN`).
- Slugs are unique per language; the same slug can exist in multiple languages.

## Example responses

### Category list item

```json
{
  "id": 12,
  "name": "Getting Started",
  "slug": "getting-started",
  "description": "Introductory docs",
  "order": 0,
  "page_count": 5,
  "language": "en",
  "translation_group": "e0fe1b4d-268a-4fb1-a1a2-72b9a4b8a0b7",
  "translations": [{ "id": 7, "language": "zh-CN", "slug": "ru-men" }],
  "created_at": "2025-10-01T12:00:00Z"
}
```

### Page list item

```json
{
  "id": 101,
  "title": "Install",
  "slug": "install",
  "summary": "How to install...",
  "category": 12,
  "category_name": "Getting Started",
  "tags": "setup,install",
  "tags_list": ["setup", "install"],
  "status": "published",
  "author": 3,
  "author_name": "alice",
  "created_at": "2025-10-01T12:00:00Z",
  "updated_at": "2025-10-05T12:00:00Z",
  "view_count": 42,
  "order": 0,
  "language": "en",
  "translation_group": "c5c2f6bd-bf2f-4f3a-a3d7-d1a6b6f0e9cd"
}
```

### Page detail

```json
{
  "id": 101,
  "title": "Install",
  "slug": "install",
  "content": "# Install\n...markdown...",
  "summary": "How to install...",
  "category": 12,
  "category_name": "Getting Started",
  "tags": "setup,install",
  "tags_list": ["setup", "install"],
  "status": "published",
  "author": 3,
  "author_name": "alice",
  "created_at": "2025-10-01T12:00:00Z",
  "updated_at": "2025-10-05T12:00:00Z",
  "view_count": 43,
  "order": 0,
  "language": "en",
  "translation_group": "c5c2f6bd-bf2f-4f3a-a3d7-d1a6b6f0e9cd",
  "translations": [
    {
      "id": 88,
      "title": "安装",
      "slug": "an-zhuang",
      "language": "zh-CN",
      "status": "published"
    }
  ]
}
```

## Query parameter reference

- `language`: BCP‑47 (`zh-CN`, `zh-HK`, `en`)
- `search`: case‑insensitive substring search
- `category`: category slug
- `status`: `draft|published` (admin only)
- `tags`: comma‑separated list; AND semantics
- `translation_group`: UUID

## Settings & middleware

- `DEFAULT_CONTENT_LANGUAGE` — fallback language used when `?language` is absent
- `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOW_CREDENTIALS = True` — configure for browser clients
- DRF JSON‑only renderers/parsers by default (Browsable API enabled only in `DEBUG`)
- Cache backend is configured (LocMem by default); endpoints themselves don’t set HTTP cache headers

## Migrations & seed data

- `0001_initial.py` — base schema for categories/pages
- `0002_seed_wiki_data.py` — sample data for development
- `0003_bcp47_language_update.py` — language code normalization and/or related changes

Apply migrations:

```bash
python manage.py migrate wiki
```

## Known limitations / improvement ideas

- Pagination: not enabled; large datasets will return full lists. Consider DRF `PageNumberPagination` and exposing `page`/`page_size`.
- Ordering: no `ordering` query param; consider enabling DRF `OrderingFilter` on fields like `updated_at`, `view_count`, `order`.
- Tags filter semantics: currently AND; consider `tags_mode=any|all`.
- Language/caching: if enabling caching layers, consider `Vary` headers or explicit cache keys for `language`.
- Search: simple `icontains`; consider full‑text search or trigram indexes if needed.
- View tracking: to avoid accidental double‑counts from server prefetching, consider moving to an explicit client‑side tracking endpoint.

## Extending the system

1. Add fields to `WikiPage`/`WikiCategory` → create migration → expose in serializers → handle in viewsets.
2. Add new query filters → update `get_queryset()` logic and document the contract.
3. Add new admin actions → create DRF `@action` methods with proper `permission_classes`.
4. For translations, keep `translation_group` stable across language variants and validate uniqueness per `(translation_group, language)`.

## Troubleshooting

- 404 on detail route: ensure `slug` exists for the requested `?language=...`.
- Drafts not visible: confirm user is staff or remove `status` filter.
- CORS/CSRF issues: ensure frontend origin is listed in `CORS_ALLOWED_ORIGINS` and (if posting) in `CSRF_TRUSTED_ORIGINS`.
