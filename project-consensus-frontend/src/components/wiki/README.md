# Wiki Frontend Module

This document explains the architecture, data flow, interfaces, and key components used by the Wiki feature in the frontend.

## Directory layout

- `src/app/wiki/`
  - `page.tsx`: Wiki index page. Lists pages with filters via query params.
  - `[slug]/page.tsx`: Wiki detail page. Renders a single page by slug.
  - `categories/page.tsx`: Category index listing.
  - `layout.tsx`: Shared layout for `/wiki/*` routes (sidebar + main content).
- `src/components/wiki/`
  - `MarkdownRenderer.tsx`: Server component that renders Markdown/MDX with remark/rehype pipeline and sanitization.
  - `MdxComponents.tsx`: MDX element/component mapping and link behavior policy.
  - `WikiSidebar.tsx`: Left sidebar with categories and navigation links.
  - `WikiToc.tsx`: In‑page Table of Contents (TOC) generated from Markdown headings.
  - `WikiPageList.tsx`: Paginated/filtered page list for the index view.
  - `WikiCategoryList.tsx`: Category list widget.
  - `WikiLanguageSwitcher.tsx`: Client component to switch language on a detail page.
  - `WikiPageHeader.tsx`: Title, meta info (author, updated, views).
- `src/types/wiki.ts`: Shared TypeScript types used across Wiki components.
- `src/lib/markdown.ts`: Utilities for extracting headings, slugging, and a minimal Markdown→HTML prototype (used mainly by TOC extraction).
- `src/lib/api/`
  - `api-utils.ts`: API helpers and fetch wrappers.
  - `wiki.ts`: Wiki-specific API functions.

## Routing and query parameters

Routes are implemented via Next.js App Router (React Server Components by default):

- `GET /wiki`
  - Consumes query params in `page.tsx`:
    - `language`: `LanguageCode` (`'zh-CN' | 'zh-HK' | 'en'`)
    - `search`: free text
    - `category`: category slug
    - `tags`: comma-separated tags
- `GET /wiki/[slug]`
  - Optional `language` query param to select a specific translation.
- `GET /wiki/categories`
  - Optional `language` query param.

`src/app/wiki/layout.tsx` derives a preferred language from the `accept-language` header and renders a shared `WikiSidebar` and `children`.

## Data fetching and freshness

All read APIs go through `apiGet()` in `src/lib/api/api-utils.ts`. To ensure fresh data:

- `apiGet()` sets `cache: 'no-store'` by default. Callers can override via `init.cache` if needed.
- `getAPIBaseUrl()` uses `process.env.NEXT_PUBLIC_API_BASE_URL` or falls back to `http://localhost:8000`.
- Cookies are included via `credentials: 'include'`. If your backend requires authenticated requests on the server, consider forwarding cookies/headers explicitly in server actions or route handlers.

Wiki-specific requests in `src/lib/api/wiki.ts`:

- `fetchWikiCategories(params?: WikiCategoryQuery): Promise<WikiCategory[]>`
  - GET `/api/wiki/categories/?...`
- `fetchWikiPages(params?: WikiPageQuery): Promise<WikiPageListItem[]>`
  - GET `/api/wiki/pages/?...`
- `fetchWikiPageDetail(slug: string, language?: LanguageCode): Promise<WikiPageDetail>`
  - GET `/api/wiki/pages/{slug}/?language=...`

A small internal `qs()` helper builds the query string from optional params.

## Rendering pipeline (Markdown/MDX)

`MarkdownRenderer.tsx` renders page content using `next-mdx-remote/rsc` with the following pipeline:

- remark: `remark-gfm` (tables, autolists, strikethrough, task lists)
- rehype:
  - `rehype-slug`: generates stable `id` attributes for headings
  - `rehype-autolink-headings`: wraps or appends anchor links to headings
  - `rehype-sanitize`: whitelists safe elements/attributes

Sanitizer schema is extended to allow the following attributes:

- Code blocks: `code.className`, `pre.className`
- Anchors: `a.className`, `a.href`, `a.rel`, `a.target`
- Headings: `h1`–`h6` allow `id` and `className` so in‑page anchors work

MDX element/component mapping is defined in `MdxComponents.tsx` (typography, callouts, etc.). Link behavior is controlled there:

- External links (`http(s)://`) open in a new tab and set `rel="noopener noreferrer"`.
- Internal links (`/`, `./`, `../`) and hash links (`#...`) stay in the same tab.

## Table of Contents (TOC) and slugging

`WikiToc.tsx` builds an in‑page TOC from Markdown using `extractHeadings(content)` from `markdown.ts`.

- `extractHeadings()` and the minimal `renderMarkdownToHtml()` both use `github-slugger` to create slugs.
- This matches the IDs produced by `rehype-slug`, ensuring links like `#section-id` work consistently.
- TOC links use native `<a href="#...">` for reliable in‑page navigation.

## Internationalization (i18n)

- Language codes: `LanguageCode = 'zh-CN' | 'zh-HK' | 'en'` in `types.ts`.
- `layout.tsx` detects preferred language via the `accept-language` request header.
- `WikiLanguageSwitcher` (client component) pushes a new URL with `?language={code}` for the same slug.
- `WikiSidebar` and list components accept an optional `language` prop and propagate it in navigation links.

## Components overview

- `WikiPageList.tsx`
  - Server component that calls `fetchWikiPages()` with optional filters and renders a list of pages with summary and updated date.
- `WikiCategoryList.tsx`
  - Server component that calls `fetchWikiCategories()` and shows basic counts and descriptions, linking to `/wiki?category=...`.
- `WikiSidebar.tsx`
  - Server component showing a back-to-home link, quick link to `/wiki`, and a categorized list with counts. Uses `fetchWikiCategories()`.
- `WikiPageHeader.tsx`
  - Displays title and meta info (category name, author, updated date, views).
- `WikiLanguageSwitcher.tsx`
  - Client component using `useRouter()` and `useTransition()` to switch language for the current slug.
- `WikiToc.tsx`
  - Generates in‑page TOC using `extractHeadings()`; links are anchors to headings within the same page.
- `MarkdownRenderer.tsx`
  - Renders sanitized Markdown/MDX with consistent heading IDs for anchor navigation.

## Types (API data shapes)

`src/lib/wiki/types.ts` describes the shapes returned by the backend:

- `WikiCategory`, `WikiCategoryTranslation`, `WikiCategoryQuery`
- `WikiPageListItem`, `WikiPageDetail`, `WikiPageTranslation`, `WikiPageQuery`
- `LanguageCode`, `WikiStatus`

These are used for component props and API responses.

## Security and sanitization

- All rendered HTML produced by the Markdown→HTML prototype is sanitized with `isomorphic-dompurify` (`DOMPurify.sanitize`).
- The MDX pipeline uses `rehype-sanitize` with an extended schema to allow necessary attributes while blocking unsafe content.
- External links use `rel="noopener noreferrer"` to mitigate reverse‑tabnabbing.

## Known limitations / TODOs

- Code highlighting is not configured; consider `rehype-pretty-code` or similar.
- 404 and loading states can be improved with route-level `not-found.tsx` and `loading.tsx` for `/wiki` and `/wiki/[slug]`.
- Date formatting currently uses `toLocaleDateString()`; for consistent formatting across environments, consider `Intl.DateTimeFormat` with explicit locales/timezones.
- If authenticated server-side data is required, consider forwarding cookies/headers explicitly when using Server Components.

## Extending the system

- Adding new MDX elements:
  - Extend `MdxComponents.tsx` with new mappings (e.g., custom callouts).
  - If new attributes are required on sanitized elements, update the `rehype-sanitize` schema in `MarkdownRenderer.tsx`.
- Adding filters or sort options:
  - Extend `WikiPageQuery` in `types.ts`, propagate through `fetchWikiPages()`, and update `page.tsx` to read new `searchParams`.
- Adding new pages:
  - Create new routes under `src/app/wiki/` and reuse existing components and API helpers.

## Quick references

- Pages
  - `src/app/wiki/page.tsx`
  - `src/app/wiki/[slug]/page.tsx`
  - `src/app/wiki/categories/page.tsx`
- Components
  - `src/components/wiki/MarkdownRenderer.tsx`
  - `src/components/wiki/MdxComponents.tsx`
  - `src/components/wiki/WikiSidebar.tsx`
  - `src/components/wiki/WikiToc.tsx`
  - `src/components/wiki/WikiPageList.tsx`
  - `src/components/wiki/WikiCategoryList.tsx`
  - `src/components/wiki/WikiLanguageSwitcher.tsx`
  - `src/components/wiki/WikiPageHeader.tsx`
- Lib
  - `src/lib/api/api-utils.ts`
  - `src/lib/api/wiki.ts`
  - `src/types/wiki.ts`
  - `src/lib/markdown.ts`
