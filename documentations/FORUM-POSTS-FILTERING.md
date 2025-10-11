## Forum Posts Filtering (Frontend + Backend)

This document focuses exclusively on filtering: what parameters exist, how the frontend reads/writes them, and how the backend applies them.

### Shared Filtering Contract (URL Query)
- `ordering`: server ordering key
  - `-created_at` → newest
  - `-likes_count` → most liked
  - `-comments_count` → most commented
  - omitted → server default
- `search`: full-text query string
- `tags`: multi-value parameter; use repeated keys (e.g., `?tags=analysis&tags=bug`)
- Optional filters:
  - `author`: filter by author id
  - `mine`: if `1` and authenticated, only current user's posts

---

## Frontend Filtering

### Single Source of Truth
- The URL is the single source of truth for filtering state.
- All filtering changes are expressed by updating the URL; data fetching reacts to the URL.

### Home Page (`project-consensus-frontend/src/app/page.tsx`)
- On initial load: read `ordering`, `search`, `tags` via `useSearchParams` and pass them to `useInfiniteList.initialParams`.
- On URL change: a `useEffect` computes next params from the updated URL and calls `reset(nextParams)` (first run is skipped to avoid duplicate fetch).
- UI props: derive and pass `initialSort`, `initialSearch`, `initialTags` to the filter bar so its controls mirror the URL.

### Filter Bar (`project-consensus-frontend/src/components/ForumFilterBar.tsx`)
- Controlled by the initial props above; synchronizes internal state on prop changes.
- Apply: map UI sort to `ordering`, write `ordering`, `search`, and each `tags` entry to the URL using `router.push(pathname?qs)`.
- Clear: navigate to `pathname` with no query to reset filters.

### Tags as Filters
- Preview card (`project-consensus-frontend/src/components/ForumPostPreviewCard.tsx`): clicking a tag merges it into the current URL params (preserves existing `search`/`ordering`/`tags`), dedupes, and pushes the URL.
- Detail card (`project-consensus-frontend/src/components/ForumPostDetailCard.tsx`): clicking a tag navigates to `/?tags=<tag>`; the homepage refetches according to the URL.

### Sort Mapping (UI → Server)
- default → omit `ordering`
- newest → `-created_at`
- likes → `-likes_count`
- comments → `-comments_count`

### Filter Examples
- Only search: `/?search=cache`
- Tags + search + ordering: `/?tags=analysis&tags=bug&search=cache&ordering=-likes_count`

---

## Backend Filtering

### Endpoint
- Filtered list: `GET /api/forum/posts/`

### Accepted Filtering Parameters
- `ordering`: `-created_at`, `-likes_count`, `-comments_count`, `id` (DRF `OrderingFilter`)
- `search`: full-text across `title`, `content`, `tags` (DRF `SearchFilter`)
- `tags`: repeated keys; server applies AND semantics via `tags__contains=[...]` (post must include all requested tags)
- `author`: filter by author id
- `mine`: if `1` and authenticated, only current user's posts

### Semantics
- Search fields: `title`, `content`, `tags`.
- Ordering fields: `created_at`, `likes_count`, `comments_count`, `id`; default is `-created_at, -likes_count, -id` for feed-like behavior.
- Tags: normalize/dedupe input; require post JSON `tags` to contain all selected values (predictable narrowing as more tags are added).

---

## File Map (Filtering-related)
- Frontend page: `project-consensus-frontend/src/app/page.tsx`
- Filter UI: `project-consensus-frontend/src/components/ForumFilterBar.tsx`
- Tag interactions: `project-consensus-frontend/src/components/ForumPostPreviewCard.tsx`, `project-consensus-frontend/src/components/ForumPostDetailCard.tsx`
- Backend viewset: `project-consensus-backend/forum/views.py` (filters, search, ordering)


