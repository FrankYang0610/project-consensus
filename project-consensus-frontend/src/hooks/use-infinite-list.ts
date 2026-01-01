"use client";

import * as React from "react";

/**
 * Cache structure stored in sessionStorage
 */
interface InfiniteListCache<T, P = unknown> {
  items: T[];
  nextPage: number;
  hasMore: boolean;
  scrollY: number;
  timestamp: number;
  params?: P;  // Store params to detect if filters changed
  totalCount?: number | null;  // Preserve total count across navigations
}

/**
 * Cache TTL: 5 minutes (in milliseconds)
 */
const CACHE_TTL = 5 * 60 * 1000;


export interface UseInfiniteListOptions<T, P = Record<string, unknown>> {
  pageFetcher: (args: { page: number; pageSize: number } & P) => Promise<unknown>;
  initialParams?: P;
  pageSize?: number;
  dedupeKey: (item: T) => string;
  sortFn?: (a: T, b: T) => number;
  autoLoad?: boolean;
  enabled?: boolean;

  /**
   * Optional cache key for sessionStorage persistence.
   * When provided, list state (items, page, scroll position) will be cached
   * and restored when navigating back to the page.
   */
  cacheKey?: string;
}

export interface PaginatedLike<T> {
  results: T[];
  next: string | null;
  count?: number | null;
}

function isPaginatedLikeShape(value: unknown): value is { results?: unknown; next?: unknown; count?: unknown } {
  if (typeof value !== "object" || value === null) return false;
  return "results" in value;
}

function normalizeResponse<T>(data: unknown): PaginatedLike<T> {
  // DRF PaginatedResponse: { count, next, previous, results }
  if (isPaginatedLikeShape(data)) {
    const results = Array.isArray(data.results) ? (data.results as T[]) : [];
    const next = typeof data.next === "string" || data.next === null ? data.next : null;
    const count = typeof data.count === "number" ? data.count : null;
    return { results, next, count };
  }
  // Non-DRF shapes are treated as empty; the app requires proper pagination.
  return { results: [], next: null, count: null };
}

/**
 * How this hook works (variables and flow)
 *
 * State
 * - items: merged list of items across pages; de-duplicated via dedupeKey and optionally sorted via sortFn.
 * - nextPage: the next page number to request; starts at 1; increments when the last response had a next page.
 * - hasMoreBool: true when the server response includes a truthy `next`; drives auto pagination.
 * - loading: true while a request is in flight (mirrors loadingRef); false when settled.
 * - error: true if the last load failed; cleared on success and on reset.
 * - totalCount: server-provided total item count if available; otherwise null.
 *
 * Refs
 * - loaderRef: attach to a sentinel element. When it enters the viewport and hasMoreBool is true, we call loadMore().
 * - loadingRef: an in-flight lock to prevent concurrent loadMore calls.
 * - paramsRef: latest filter/search params (from initialParams or reset); merged into each page request.
 * - autoLoadedRef: ensures the initial auto-load runs exactly once per mount/reset.
 *
 * Actions
 * - loadMore(): builds `{ ...paramsRef.current, page: nextPage, pageSize }`, fetches a page, merges results,
 *   updates hasMoreBool from `next`, advances nextPage when appropriate, sets totalCount, and manages error/loading flags.
 * - reset(params): stores new params, clears items, sets nextPage=1 and hasMoreBool=false (until first response),
 *   resets error/totalCount and autoLoadedRef to allow a single initial auto-load again.
 *
 * Effects
 * - Auto-load effect: when enabled && autoLoad && items are empty and not already loading, it triggers loadMore() exactly once
 *   per mount/reset (guarded by autoLoadedRef).
 * - IntersectionObserver effect: observes loaderRef and calls loadMore() when the sentinel becomes visible, hasMoreBool is true,
 *   and no request is currently in flight.
 *
 * Cache (optional)
 * - When cacheKey is provided, the list state is persisted to sessionStorage on unmount/beforeunload.
 * - On mount, if a valid (non-expired) cache exists, it restores items, nextPage, hasMore, and scroll position.
 */
export function useInfiniteList<T, P = Record<string, unknown>>(options: UseInfiniteListOptions<T, P>) {
  const { pageFetcher, initialParams, pageSize = 20, dedupeKey, sortFn, autoLoad = true, enabled = true, cacheKey } = options;

  // Helper functions for cache
  const getCache = React.useCallback((): InfiniteListCache<T, P> | null => {
    if (!cacheKey || typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const cached = JSON.parse(raw) as InfiniteListCache<T, P>;
      // Check TTL
      if (Date.now() - cached.timestamp > CACHE_TTL) {
        sessionStorage.removeItem(cacheKey);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const setCache = React.useCallback((data: Omit<InfiniteListCache<T, P>, "timestamp">) => {
    if (!cacheKey || typeof window === "undefined") return;
    try {
      const cacheData: InfiniteListCache<T, P> = {
        ...data,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [cacheKey]);

  const clearCache = React.useCallback(() => {
    if (!cacheKey || typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {
      // Ignore
    }
  }, [cacheKey]);

  // Compare params for equality (shallow JSON comparison to make sure full matching)
  const paramsEqual = React.useCallback((a: P | undefined, b: P | undefined): boolean => {
    return JSON.stringify(a) === JSON.stringify(b);
  }, []);

  // Initialize state from cache if available and params match
  const cachedData = React.useMemo(() => {
    const cache = getCache();
    // Only use cache if params match (or cache has no params stored)
    if (cache && (cache.params === undefined || paramsEqual(cache.params, initialParams))) {
      return cache;
    }
    return null;
  }, [getCache, initialParams, paramsEqual]);

  const [items, setItems] = React.useState<T[]>(cachedData?.items ?? []);
  const [nextPage, setNextPage] = React.useState<number>(cachedData?.nextPage ?? 1);
  const [hasMoreBool, setHasMoreBool] = React.useState<boolean>(cachedData?.hasMore ?? false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<boolean>(false);
  const [totalCount, setTotalCount] = React.useState<number | null>(cachedData?.totalCount ?? null);
  // Track if we restored from cache (to skip initial auto-load)
  const restoredFromCacheRef = React.useRef<boolean>(!!cachedData);

  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef<boolean>(false);
  const paramsRef = React.useRef<P | undefined>(initialParams);
  const autoLoadedRef = React.useRef<boolean>(!!cachedData);

  // Restore scroll position after component mounts with cached data
  React.useEffect(() => {
    if (restoredFromCacheRef.current && cachedData?.scrollY) {
      restoredFromCacheRef.current = false;
      // Use setTimeout to ensure DOM is fully rendered after hydration
      const timer = setTimeout(() => {
        window.scrollTo(0, cachedData.scrollY);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [cachedData?.scrollY]);

  // Save cache on unmount or beforeunload
  React.useEffect(() => {
    if (!cacheKey) return;

    const saveCache = () => {
      // Only save if we have items
      if (items.length > 0) {
        setCache({
          items,
          nextPage,
          hasMore: hasMoreBool,
          scrollY: window.scrollY,
          params: paramsRef.current,
          totalCount,
        });
      }
    };

    // Save on beforeunload (navigating away)
    window.addEventListener("beforeunload", saveCache);

    // Save on unmount
    return () => {
      window.removeEventListener("beforeunload", saveCache);
      saveCache();
    };
  }, [cacheKey, items, nextPage, hasMoreBool, totalCount, setCache]);

  const loadMore = React.useCallback(async (): Promise<void> => {
    if (!enabled) return;
    if (loadingRef.current) return;
    if (!pageFetcher) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      // Ensure paging arguments take precedence over any values passed in initial/reset params
      const data = await pageFetcher({ ...(paramsRef.current as P), page: nextPage, pageSize });
      const page = normalizeResponse<T>(data);
      setItems(prev => {
        const existing = new Set(prev.map(dedupeKey));
        const deduped = page.results.filter(it => !existing.has(dedupeKey(it)));
        const merged = [...prev, ...deduped];
        return sortFn ? [...merged].sort(sortFn) : merged;
      });
      const more = Boolean(page.next);
      setHasMoreBool(more);
      if (more) setNextPage(prev => prev + 1);
      setTotalCount(prev => (typeof page.count === "number" ? page.count : prev));
      setError(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e);
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [enabled, pageFetcher, pageSize, dedupeKey, sortFn, nextPage]);

  const reset = React.useCallback((params: P) => {
    // Skip reset if params are the same and we have data (avoid clearing cache on mount)
    if (paramsEqual(paramsRef.current, params) && items.length > 0) {
      return;
    }
    paramsRef.current = params;
    setItems([]);
    setNextPage(1);
    // Start with hasMore = false; will be set correctly after the first load
    setHasMoreBool(false);
    setError(false);
    setTotalCount(null);
    autoLoadedRef.current = false;
    // Clear cache when filters change
    clearCache();
  }, [clearCache, paramsEqual, items.length]);

  // Auto-load first page when mounted or when nextUrl is set/reset
  React.useEffect(() => {
    if (!enabled) return;
    if (!autoLoad) return;
    if (items.length === 0 && Boolean(pageFetcher) && !loadingRef.current && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      // fire and forget
      loadMore();
    }
  }, [enabled, autoLoad, items.length, loadMore, pageFetcher]);

  // IntersectionObserver for infinite scrolling
  React.useEffect(() => {
    if (!enabled) return;
    if (!loaderRef.current) return;
    const target = loaderRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreBool && !loadingRef.current) {
          loadMore();
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, hasMoreBool, loadMore]);

  return {
    items,
    setItems,
    hasMore: hasMoreBool,
    loading,
    error,
    setError,
    totalCount,
    loaderRef,
    loadMore,
    reset,
  } as const;
}


