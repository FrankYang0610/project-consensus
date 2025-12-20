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
import { fetchTeachers } from "@/lib/api/teacher";
import type { Teacher } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useRouter, useSearchParams } from "next/navigation";

function TeachersPageContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [searchInput, setSearchInput] = React.useState<string>(
    () => searchParams.get("q") || ""
  );
  const [sortBy, setSortBy] = React.useState<string>("name");

  // Committed query comes from URL (?q=); input is only committed on Enter or clear
  const committedQuery = React.useMemo(() => (searchParams.get("q") || "").trim(), [searchParams]);

  // Keep input in sync when URL ?q changes (e.g., on submit/replace)
  React.useEffect(() => {
    const qp = searchParams.get("q") || "";
    // Only update if different to avoid cursor jumps while typing
    if (qp !== searchInput) setSearchInput(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Map sort options to backend ordering (stable identity)
  const getSortOrdering = React.useCallback((sort: string): string => {
    switch (sort) {
      case "rating":
        return "-rating_overall";
      case "reviews":
        return "-rating_reviews_count";
      case "department":
        return "department";
      case "updated":
        return "-updated_at";
      case "name":
      default:
        return "name";
    }
  }, []);

  // Unified infinite list for teachers via fetcher
  const buildTeachersParams = React.useCallback(() => ({
    q: committedQuery || undefined,
    ordering: getSortOrdering(sortBy),
  }), [committedQuery, sortBy, getSortOrdering]);

  const {
    items: teachers,
    setItems: setTeachers,
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
    initialParams: buildTeachersParams(),
    pageSize: 20,
    dedupeKey: (t) => t.id,
  });

  const countForDisplay = teachersTotalCount ?? teachers.length;

  // Reload when committed query (URL) or sort changes
  React.useEffect(() => {
    reset(buildTeachersParams());
  }, [committedQuery, sortBy, buildTeachersParams, reset]);

  // Handle search form submit: commit input to URL (?q=) and reload results
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    // Reflect query in URL
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    router.replace(`/teachers${qs.toString() ? `?${qs.toString()}` : ""}`);
    // Trigger an immediate search using the current input
    reset({ q: q || undefined, ordering: getSortOrdering(sortBy) });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    // Clear query param from URL
    router.replace(`/teachers`);
    reset({ q: undefined, ordering: getSortOrdering(sortBy) });
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("teachers.title")}</h1>
        <p className="text-muted-foreground">
          {countForDisplay > 0 && t("teachers.total", { count: countForDisplay })}
        </p>
        {committedQuery && (
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
                  {t("teachers.sort")}: {sortBy === "name" && t("teachers.sortBy.name")}
                  {sortBy === "rating" && t("teachers.sortBy.rating")}
                  {sortBy === "reviews" && t("teachers.sortBy.reviews")}
                  {sortBy === "department" && t("teachers.sortBy.department")}
                  {sortBy === "updated" && t("teachers.sortBy.updated")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuRadioGroup
                  value={sortBy}
                  onValueChange={setSortBy}
                >
                  <DropdownMenuRadioItem value="name">
                    {t("teachers.sortBy.name")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="rating">
                    {t("teachers.sortBy.rating")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="reviews">
                    {t("teachers.sortBy.reviews")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="department">
                    {t("teachers.sortBy.department")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="updated">
                    {t("teachers.sortBy.updated")}
                  </DropdownMenuRadioItem>
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
                  {committedQuery
                    ? t("teachers.noResults", { query: committedQuery })
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

