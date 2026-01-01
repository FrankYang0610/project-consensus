"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/hooks/use-i18n";
import { TeacherPreviewCard } from "@/components/TeacherPreviewCard";
import { fetchTeachers, fetchTeacherStats } from "@/lib/api/teacher";
import type { Teacher } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useRouter, useSearchParams } from "next/navigation";

// Sort orders
const TEACHER_SORT_ORDERS = {
  name: { ordering: "name", labelKey: "teachers.sortBy.name" },
  rating: { ordering: "-rating_overall", labelKey: "teachers.sortBy.rating" },
  reviews: { ordering: "-rating_reviews_count", labelKey: "teachers.sortBy.reviews" },
  department: { ordering: "department", labelKey: "teachers.sortBy.department" },
  updated: { ordering: "-updated_at", labelKey: "teachers.sortBy.updated" },
} as const;

type SortKey = keyof typeof TEACHER_SORT_ORDERS;
const DEFAULT_SORT: SortKey = "name";

function TeachersPageContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL is the single source of truth for filters
  const query = (searchParams.get("q") || "").trim();
  const sortKey = (searchParams.get("sort") || DEFAULT_SORT) as SortKey;
  const sortOrder = TEACHER_SORT_ORDERS[sortKey] || TEACHER_SORT_ORDERS[DEFAULT_SORT];

  // Local state for search input (only committed on Enter)
  const [searchInput, setSearchInput] = React.useState<string>(query);

  // Keep input in sync when URL ?q changes
  React.useEffect(() => {
    if (query !== searchInput) setSearchInput(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Build URL and API params from the same source
  const updateUrl = React.useCallback((params: { q?: string; sort?: SortKey }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.sort && params.sort !== DEFAULT_SORT) qs.set("sort", params.sort);
    router.replace(`/teachers${qs.toString() ? `?${qs.toString()}` : ""}`);
  }, [router]);

  // API params derived directly from URL state
  const apiParams = React.useMemo(() => ({
    q: query || undefined,
    ordering: sortOrder.ordering,
  }), [query, sortOrder.ordering]);

  const {
    items: teachers,
    loaderRef: hookLoaderRef,
    hasMore,
    loading,
    error: loadError,
    setError: setLoadError,
    loadMore,
    reset,
    totalCount: teachersTotalCount,
  } = useInfiniteList<Teacher, { q?: string; ordering?: string }>({
    pageFetcher: fetchTeachers,
    initialParams: apiParams,
    pageSize: 20,
    dedupeKey: (t) => t.id,
    cacheKey: "teachers-list",
  });

  // Fetch total teacher count from stats (only when not searching)
  const [statsTotal, setStatsTotal] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!query) {
      fetchTeacherStats()
        .then((stats) => setStatsTotal(stats.teachers))
        .catch(() => setStatsTotal(null));
    }
  }, [query]);

  // Use stats total when not searching, otherwise use search results count
  const countForDisplay = query
    ? (teachersTotalCount ?? teachers.length)
    : (statsTotal ?? teachersTotalCount ?? teachers.length);

  // Reload when URL params change
  React.useEffect(() => {
    reset(apiParams);
  }, [apiParams, reset]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({ q: searchInput.trim() || undefined, sort: sortKey });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateUrl({ q: undefined, sort: sortKey });
  };

  const handleSortChange = (newSort: string) => {
    updateUrl({ q: query || undefined, sort: newSort as SortKey });
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("teachers.title")}</h1>
        <p className="text-muted-foreground">
          {countForDisplay > 0 && t("teachers.total", { count: countForDisplay })}
        </p>
        {query && (
          <p className="text-muted-foreground text-xs mt-1">
            {t("teachers.approximateCountNote")}
          </p>
        )}
      </div>

      {/* Search and Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <Input
                type="text"
                placeholder={t("teachers.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="default">
                {t("teachers.search")}
              </Button>
              {searchInput && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearSearch}
                >
                  {t("teachers.clear")}
                </Button>
              )}
            </form>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  {t("teachers.sort")}: {t(sortOrder.labelKey)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuRadioGroup
                  value={sortKey}
                  onValueChange={handleSortChange}
                >
                  {(Object.keys(TEACHER_SORT_ORDERS) as SortKey[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {t(TEACHER_SORT_ORDERS[key].labelKey)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Loading State (Initial) */}
      {loading && teachers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("teachers.loading")}</p>
        </div>
      )}

      {/* Error State */}
      {loadError && teachers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">
              {t("common.loadFailedRetry")}
            </p>
            <Button onClick={() => { setLoadError(false); loadMore(); }} variant="outline">
              {t("teachers.retry")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Teachers Grid */}
      {!loading || teachers.length > 0 ? (
        <>
          {teachers.length === 0 && !loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {query
                    ? t("teachers.noResults", { query })
                    : t("teachers.noTeachers")}
                </p>
              </CardContent>
            </Card>
          )}

          {teachers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teachers.map((teacher) => (
                <TeacherPreviewCard key={teacher.id} teacher={teacher} />
              ))}
            </div>
          )}

          {/* Infinite Scroll Loader */}
          {hasMore && (
            <div
              ref={hookLoaderRef}
              className="text-center py-8 text-muted-foreground"
            >
              {t("teachers.loadingMore")}
            </div>
          )}

          {loadError && hasMore && (
            <div className="flex justify-center">
              <Button
                className="mt-2"
                onClick={() => { setLoadError(false); loadMore(); }}
              >
                {t("common.loadFailedRetry")}
              </Button>
            </div>
          )}

          {/* End of Results */}
          {!hasMore && teachers.length > 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t("teachers.endOfResults", { count: countForDisplay })}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

function TeachersPageLoading() {
  return (
    <>
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-40 bg-muted animate-pulse rounded mb-2"></div>
        <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
      </div>

      {/* Search and filter bar skeleton */}
      <div className="mb-6">
        <div className="h-20 bg-muted animate-pulse rounded"></div>
      </div>

      {/* Teachers grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 bg-muted animate-pulse rounded-lg"></div>
        ))}
      </div>
    </>
  );
}

export default function TeachersPage() {
  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-6 sm:py-8">
          <div className="container mx-auto px-4 max-w-7xl">
            <React.Suspense fallback={<TeachersPageLoading />}>
              <TeachersPageContent />
            </React.Suspense>
          </div>
        </main>
      </div>
    </>
  );
}

