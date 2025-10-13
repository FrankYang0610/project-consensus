## API Error Handling & Propagation

This document describes how the frontend handles errors from the backend API, how those errors propagate through the app, and why the approach aligns with common industry practices. It also includes concrete scenarios and examples you can follow when adding new API calls.

## Error Model

### HttpError class (frontend)

The shared API helpers throw a typed error for HTTP responses that are not ok (non-2xx):

- Type: `HttpError`
- Fields: `status` (number), `url` (string), `body` (string)
- Thrown by: `apiGet`, `apiPost`, `apiPatch`, `apiDeleteVoid`, `apiUpload`

This gives consumers a stable way to branch on status codes (e.g., 404 vs 401/403 vs 5xx) and to record useful context when needed (URL and raw body).

### Non-HTTP errors

- Network failures, CORS issues, or fetch aborts will surface as native `TypeError`/`DOMException` (not `HttpError`). Consumers should treat these as transient errors and typically offer a retry.
- JSON parse errors from invalid responses would also surface as native exceptions. These are rare; if encountered, treat as unexpected errors and log with context.

### High-level taxonomy

- 4xx user/action errors (e.g., 400 validation, 401/403 auth, 404 not found)
- 5xx server errors (unexpected; should be logged and surfaced with retry UI)
- Network/client runtime errors (transient; should offer retry)

## Propagation & Handling by Scenario

Below are the current handling policies by feature and endpoint type.

### GET: Single resource (404)

- Pattern: Return `null` (API function) or handle at page level with a friendly UI.
- Examples implemented:
  - Forum post detail: `fetchForumPostById` returns `null` on 404; the page redirects to a dedicated Not Found view.
  - Course detail (anchored to review/reply): 404s in locating a target review/reply show a small dialog (“does not exist”) and avoid extra console noise.
  - Wiki detail: API returns `null` on 404; the page calls `notFound()` to render the Next.js 404 page.

Rationale: A missing resource is an expected state (tombstone), not an application error; handle it quietly with a user-friendly message or redirect.

### GET: Collections / pagination

- Pattern: Propagate `HttpError` to the caller; list UIs (e.g., infinite lists) set an internal `loadError` flag and show a Retry action.
- If the cause is a missing anchor (e.g., target comment no longer exists), handle 404 quietly, set a soft error state for the “Retry” affordance, but do not log errors needlessly.

### POST/PATCH/DELETE (mutations)

- Pattern: Throw `HttpError` and let the caller decide:
  - For optimistic UIs (like like/unlike), revert on error and keep a concise console message for non-404 failures.
  - For destructive actions (delete), roll back local state on failure and surface minimal, actionable UI where appropriate (e.g., a toast in the future).
  - Authentication-related failures (401/403) are typically pre-guarded by `isLoggedIn` checks. If surfaced, callers may prompt login (future enhancement) or show a brief message to retry after login.

### File uploads

- Pattern: Same as POST; throw `HttpError` with status/body for the caller to branch on.

### Navigation from notifications → anchors (course reviews/replies, forum comments)

- When a target anchor (review/reply/comment/post) no longer exists (404):
  - Course page: show a friendly dialog (e.g., “This item no longer exists”) without console noise.
  - Forum: for deleted posts, route to the dedicated Not Found page; for deleted comments/replies, render the placeholder row (`isDeleted=true`, empty content) if it still exists, otherwise show a friendly message.

### Forum comments under deleted posts

- Backend now enforces industry-standard behavior:
  - `GET /api/forum/comments/?postId=<uuid>` returns 404 if the post is missing or deleted.
  - `GET /api/forum/comments/position/?postId=<uuid>&commentId=<uuid>` returns 404 if the post is missing or deleted.
  - Creating a comment on a deleted post is blocked with 400 validation: `{ postId: "post has been deleted" }`.
  - Deleting a post will remove all its comments; notifications remain visible due to snapshots.
  - Rationale: Comments should not be discoverable for deleted posts; keeps semantics consistent with post detail 404 and avoids leaking tombstoned threads.

### Wiki pages

- `fetchWikiPageDetail` returns `null` on 404, and the page calls `notFound()` (Next.js-native behavior) to render the standard 404 page.

### Teachers

- `fetchTeacherById` returns `null` on 404 (render Not Found state in the page).
- `fetchTeacherCourses` returns an empty list on 404.

## Patterns and Examples

### Catching by status

```ts
import { HttpError } from '@/lib/api/api-utils';

try {
  const result = await findReviewByReplyId(replyId);
  // proceed with happy path
} catch (e) {
  if (e instanceof HttpError && e.status === 404) {
    // Missing – show friendly UI, don’t log
    setDialog({ open: true, message: t('courses.detail.reviews.missing.replyNotExist') });
  } else {
    // Unexpected – log with context and optionally show retry
    console.error('Failed to find review for reply', e);
    setDialog({ open: true, message: t('common.loadFailedRetry') });
  }
}
```

### Returning null for single-resource fetchers

```ts
import { apiGet, HttpError } from './api-utils';

export async function fetchThingById(id: string): Promise<Thing | null> {
  try {
    return await apiGet<Thing>(`/api/things/${id}/`);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e; // or log-and-return null if the caller expects null-on-error
  }
}
```

### Infinite list retry pattern

```ts
const { items, hasMore, error, setError, loadMore } = useInfiniteList(...);

{error && hasMore && (
  <Button onClick={() => { setError(false); loadMore(); }}>
    {t('common.loadFailedRetry')}
  </Button>
)}
```

## Design Rationale & Industry Practices

- Typed errors with status: A widely used practice in TypeScript apps to branch on `status` (e.g., 404 vs 401/403 vs 5xx). We avoid string-parsing generic `Error.message`.
- 404 ≠ exceptional: Treat missing resources as expected states; provide friendly UX and avoid noisy logs. This mirrors REST semantics and is common in production apps.
- Separation of concerns: API helpers are small, composable, and throw standardized errors; features decide the UX (redirect, dialog, retry, rollback), which is consistent with React/Next.js best practices.
- Progressive enhancement: We pre-guard write actions with `isLoggedIn` on the client and keep room for future 401/403 flows (e.g., centralized login prompts).
- Observability: Logging is reserved for unexpected errors (5xx, non-404 4xx, and client/runtime errors). This keeps logs meaningful and reduces alert fatigue.

Overall, the approach aligns with industry norms: typed error surfaces, explicit 404 handling, optimistic UI with reconciliation, and minimal console noise for expected states.

## Internationalization (i18n)

- User-facing strings for missing resources and retry prompts are localized (e.g., course review/reply missing messages; generic "Retry" actions).
- When adding new error messages, prefer short, action-oriented copy and reuse existing common keys (e.g., `common.loadFailedRetry`).

## Testing & QA Suggestions

- 404 paths: Manually verify that clicking a notification to a deleted review/reply shows the friendly dialog and does not print extra console errors.
- Retry UIs: Temporarily simulate 5xx (or go offline) to ensure list pages show the retry control and recover when the network returns.
- Not Found pages: Confirm that wiki and forum post detail flows render expected Not Found states where applicable.

## Migration Notes

- Prior to the change, `apiGet` threw generic `Error` without status, making it harder to branch on 404. Now, all HTTP helpers throw `HttpError` with `status`, `url`, and `body`.
- Single-resource API functions have been updated to return `null` on 404 where a “missing” state is normal (e.g., forum post, teacher, wiki page), or to handle 404 at the page level (e.g., course anchors).
- Callers that need status-specific behavior should use `instanceof HttpError` checks.

## FAQ

### Should we always avoid logging 404s?
Yes, if the 404 corresponds to a normal user flow (deleted content, stale links). Log 404s only when they indicate a real bug or misconfiguration.

### How should we handle 401/403?
We pre-guard most mutations behind `isLoggedIn`. If a 401/403 still bubbles up, treat it as a recoverable user action error. A centralized login-prompt flow can be added later.

### What about toasts for failures?
We currently minimize user-facing toasts for known-expected states (like missing content). For unexpected errors, it’s fine to show a concise toast with a retry affordance.
