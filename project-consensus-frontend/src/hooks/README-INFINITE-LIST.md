## `useInfiniteList` – simple, reliable infinite scrolling for paginated APIs

`useInfiniteList` is a small React hook that helps you load list data page by page (infinite scroll).

It is designed to work well with **Django REST Framework (DRF) pagination**.

### Key ideas (how it works)
- The hook loads items page by page using your fetch function (`pageFetcher`).
- It merges new items into the existing list, removes duplicates (via `dedupeKey`), and can optionally sort them (`sortFn`).
- It relies on the server’s pagination signal to know whether there are more pages: if the server returns `next` (DRF-style), `hasMore` is true; otherwise `hasMore` is false.
- It exposes a `loaderRef` you can attach to a small, empty div at the bottom of your list. When it comes into view, the hook automatically calls `loadMore()`.
- You can also call `loadMore()` manually, or `reset(params)` to clear the list and start over with new filters.

### Loading flow (step-by-step)
#### 1. Initial auto-load
- On mount (or after `reset()`), if `enabled` and `autoLoad` are both `true` and the list is empty, the hook triggers exactly one initial request. An internal guard ensures it runs only once per mount/reset (to prevent duplicate requests on empty results).

#### 2. First response
- The hook merges the page `results` into `items` (removing duplicates via `dedupeKey`).
- It sets `totalCount` when `count` is provided by the server.
- It sets `hasMore` from the server’s `next` field (`truthy` → `true`, otherwise `false`).
- If `hasMore` is `true`, `nextPage` advances to the next page number.

#### 3. Scrolling (automatic pagination)
- The hook attaches an `IntersectionObserver` to `loaderRef`.
- When the sentinel enters the viewport AND `hasMore` is `true` AND no request is in flight, it calls `loadMore()`.

#### 4. Subsequent loads (`loadMore`)
- Sends `{ ...paramsRef.current, page: nextPage, pageSize }` to your `pageFetcher`.
- Merges new `results` (de-duplicated) and applies `sortFn` if provided.
- Updates `hasMore` from `next` and increments `nextPage` when appropriate.
- Sets `error` to `false` on success; sets `error` to `true` on failure (you can show a retry UI).

#### 5. Resetting with new filters (`reset(params)`)
- Clears the list and restarts pagination: `items = []`, `nextPage = 1`, `hasMore = false` (until the first response), `error = false`, `totalCount = null`.
- Resets the internal auto-load guard so the first page will auto-load once again.

#### 6. Manual control
- Set `autoLoad: false` if you prefer to call `loadMore()` yourself.
- Typical retry pattern: when `error && hasMore`, call `setError(false); loadMore();`.

#### 7. Edge cases to expect
- Empty first page: if the server returns `results: []` and `next: null`, the list stays empty and `hasMore` is `false`. The sentinel won’t trigger further requests—render an empty state instead.
- Rapid filter changes: debounce in your component (e.g., search input) and call `reset()` with the final params; the hook will handle a single initial request per reset.

### Server expectations
Your `pageFetcher` must return a DRF-style paginated response:
`{ count: number, next: string | null, previous: string | null, results: T[] }`

The hook uses DRF’s `next`/`previous` as the single source of truth for pagination. `hasMore` is set from `next` only.

#### DRF pagination fields explained
- **`count`:** total number of items across all pages (integer). The hook exposes this as `totalCount` when provided.
- **`next`:** URL string of the next page, or `null` when there is no next page. The hook sets `hasMore` to `true` when this is truthy.
- **`previous`:** URL string of the previous page, or `null` on the first page. Not used by the hook.
- **`results`:** array of items for the current page (`T[]`). These are merged into `items` with de-duplication and optional sorting.

### Quick start
```tsx
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { fetchCourses } from "@/lib/api/course"; // returns DRF-style pages
import type { Course } from "@/types";
import type { FetchCoursesParams } from "@/lib/api/course";

export default function CoursesPage() {
  const {
    items: courses,
    loaderRef,
    hasMore,
    loading,
    error,
    setError,
    loadMore,
    reset,
  } = useInfiniteList<Course, FetchCoursesParams>({
    pageFetcher: fetchCourses,
    initialParams: { page: 1, pageSize: 20, ordering: "-last_updated" },
    pageSize: 20,
    dedupeKey: (c) => c.courseId,
    // Optional: enforce a client sort
    // sortFn: (a, b) => a.title.localeCompare(b.title),
  });

  return (
    <div>
      <div className="grid">
        {courses.map((c) => (
          <div key={c.courseId}>{c.title}</div>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={loaderRef} className="h-8" aria-hidden="true" />

      {/* Optional retry button when a load failed and there are more pages */}
      {error && hasMore && (
        <button onClick={() => { setError(false); loadMore(); }}>Retry</button>
      )}
    </div>
  );
}
```

### API
Hook signature:
```ts
function useInfiniteList<T, P = Record<string, unknown>>(options: {
  pageFetcher: (args: { page: number; pageSize: number } & P) => Promise<unknown>;
  initialParams?: P;
  pageSize?: number;               // default 20
  dedupeKey: (item: T) => string;  // used to remove duplicates when merging
  sortFn?: (a: T, b: T) => number; // optional client-side sort
  autoLoad?: boolean;              // default true, loads first page automatically
  enabled?: boolean;               // default true, disables all behavior when false
})
```

Returns:
```ts
{
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>; // you can optimistically update items
  hasMore: boolean;               // true if server returned a next page
  loading: boolean;               // true while a page is being fetched
  error: boolean;                 // true if last load failed
  setError: (v: boolean) => void; // use with your retry button
  totalCount: number | null;      // from server count, if provided
  loaderRef: React.RefObject<HTMLDivElement>; // attach to your sentinel element
  loadMore: () => Promise<void>;  // manually load the next page
  reset: (params: P) => void;     // clear list and start over with new params
}
```

### Notes on `pageFetcher`
- The hook passes `{ page, pageSize, ...params }` to `pageFetcher`.
- If your API expects `page_size` instead of `pageSize`, convert it inside your fetcher (see our API modules for examples).
- Return the raw JSON you get from the server; the hook will normalize it.

### Changing filters (reset)
Use `reset(newParams)` to clear the current list and restart from page 1 with the new filters.

```tsx
// Example: apply filters and reset the list
reset({ page: 1, pageSize: 20, ordering: "-rating_score", subjectCode: "CS" });
```

### Error and retry
If a request fails, `error` becomes true. Show a Retry button and call `setError(false); loadMore();` to try again.

### Deduplication and sorting
- Make sure `dedupeKey` returns a stable unique key (e.g., `id`, `uuid`, or `courseId`).
- When `sortFn` is provided, the hook sorts the merged list after each page load. If the backend order is already correct, you can omit `sortFn`.

### `IntersectionObserver` details
- The hook creates an observer with `{ root: null, rootMargin: "200px 0px", threshold: 0 }`.
- When the sentinel (`loaderRef`) enters the viewport and `hasMore` is true (and not already loading), it triggers `loadMore()`.
- If you prefer manual pagination (e.g., “Load more” button), you can ignore `loaderRef` and call `loadMore()` yourself.

### Common patterns
1) Basic infinite list with retry button (see Quick start).
2) Filtered search with debounce: when filters change, call `reset({ page: 1, pageSize, ...filters })`.
3) Optimistic updates: use `setItems(prev => /* modify prev */)` to reflect user actions instantly, then reconcile with server.

### Design choices (why rely on `next`)
- The hook uses the server’s `next` to decide `hasMore`. This avoids client-side guesswork (like counting items), works with server-side dedup/filter logic, and matches industry practice (DRF, GraphQL `hasNextPage`, etc.).

### Troubleshooting
- `loadMore` never fires: make sure the sentinel element with `ref={loaderRef}` actually renders and can intersect the viewport; check CSS height and parent overflow.
- Items repeat: verify `dedupeKey` is stable and unique across pages.
- Wrong sort order: provide a `sortFn` or have the backend return the desired order.
- Nothing loads on mount: ensure `autoLoad` is true (default) and `enabled` is true; also that `pageFetcher` is a stable function reference (not recreated every render).
