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

function normalizeResponse<T>(data: unknown): PaginatedLike<T> {
  // DRF PaginatedResponse: { count, next, previous, results }
  if (data && typeof data === "object" && "results" in (data as any)) {
    const d = data as { results?: T[]; next?: string | null; count?: number };
    return {
      results: Array.isArray(d.results) ? d.results : [],
      next: d.next ?? null,
      count: typeof d.count === "number" ? d.count : null,
    };
  }
  // Non‑DRF shapes are treated as empty; the app requires proper pagination.
  return { results: [], next: null, count: null };
}

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

  const loadMore = React.useCallback(async (): Promise<void> => {
    if (!enabled) return;
    if (loadingRef.current) return;
    if (!pageFetcher) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      // Ensure paging arguments take precedence over any values passed in initial/reset params
      const data = await (pageFetcher as NonNullable<typeof pageFetcher>)({ ...(paramsRef.current as P), page: nextPage, pageSize });
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
    setHasMoreBool(true);
    setError(false);
    setTotalCount(null);
  }, []);

  // Auto-load first page when mounted or when nextUrl is set/reset
  React.useEffect(() => {
    if (!enabled) return;
    if (!autoLoad) return;
    if (items.length === 0 && Boolean(pageFetcher)) {
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

  const hasMore = React.useMemo(() => hasMoreBool, [hasMoreBool]);

  return {
    items,
    setItems,
    hasMore,
    loading,
    error,
    setError,
    totalCount,
    loaderRef,
    loadMore,
    reset,
  } as const;
}


