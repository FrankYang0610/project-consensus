"use client";

import * as React from "react";

export interface UseInfiniteListOptions<T, P = Record<string, unknown>> {
  pageFetcher: (args: { page: number; pageSize: number } & P) => Promise<unknown>;
  initialParams?: P;
  pageSize?: number;
  dedupeKey: (item: T) => string;
  sortFn?: (a: T, b: T) => number;
  autoLoad?: boolean;
  enabled?: boolean;
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
 */
export function useInfiniteList<T, P = Record<string, unknown>>(options: UseInfiniteListOptions<T, P>) {
  const { pageFetcher, initialParams, pageSize = 20, dedupeKey, sortFn, autoLoad = true, enabled = true } = options;

  const [items, setItems] = React.useState<T[]>([]);
  const [nextPage, setNextPage] = React.useState<number>(1);
  const [hasMoreBool, setHasMoreBool] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<boolean>(false);
  const [totalCount, setTotalCount] = React.useState<number | null>(null);

  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef<boolean>(false);
  const paramsRef = React.useRef<P | undefined>(initialParams);
  const autoLoadedRef = React.useRef<boolean>(false);

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
      console.error(e);
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [enabled, pageFetcher, pageSize, dedupeKey, sortFn, nextPage]);

  const reset = React.useCallback((params: P) => {
    paramsRef.current = params as P;
    setItems([]);
    setNextPage(1);
    // Start with hasMore = false; will be set correctly after the first load
    setHasMoreBool(false);
    setError(false);
    setTotalCount(null);
    autoLoadedRef.current = false;
  }, []);

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


