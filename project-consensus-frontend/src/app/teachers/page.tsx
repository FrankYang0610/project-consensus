"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useDebounce } from "@/hooks/use-debounce";
import { TeacherPreviewCard } from "@/components/TeacherPreviewCard";
import { fetchTeachers } from "@/lib/api/teacher";
import type { Teacher, PaginatedResponse } from "@/types";

export default function TeachersPage() {
  const { t } = useI18n();

  // State
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchInput, setSearchInput] = React.useState("");
  const [sortBy, setSortBy] = React.useState<string>("name");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  // Debounce search input (500ms delay)
  const debouncedSearchQuery = useDebounce(searchInput, 500);

  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);

  // Map sort options to backend ordering
  const getSortOrdering = (sort: string): string => {
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
  };

  // Fetch teachers data
  const loadTeachers = React.useCallback(
    async (page: number, reset: boolean = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setIsLoading(true);

      try {
        const response: PaginatedResponse<Teacher> = await fetchTeachers({
          q: debouncedSearchQuery.trim() || undefined,
          page,
          pageSize: 20,
          ordering: getSortOrdering(sortBy),
        });

        if (reset) {
          setTeachers(response.results);
        } else {
          setTeachers((prev) => {
            const existing = new Set(prev.map((t) => t.id));
            const deduped = response.results.filter((t) => !existing.has(t.id));
            return [...prev, ...deduped];
          });
        }

        setTotalCount(response.count);
        setHasMore(!!response.next);
        setLoadError(false);
      } catch (error) {
        console.error("Failed to load teachers:", error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
      }
    },
    [debouncedSearchQuery, sortBy]
  );

  // Initial load (triggered by debounced search or sort change)
  React.useEffect(() => {
    setCurrentPage(1);
    loadTeachers(1, true);
  }, [debouncedSearchQuery, sortBy, loadTeachers]);

  // Infinite scroll observer
  React.useEffect(() => {
    if (!loaderRef.current || !hasMore || isLoading) return;

    const target = loaderRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loadingRef.current) {
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          loadTeachers(nextPage, false);
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading, currentPage, loadTeachers]);

  // Handle search form submit (optional, debounce already handles it)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is automatically triggered by debounced value
  };

  const handleClearSearch = () => {
    setSearchInput("");
  };

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-6 sm:py-8">
          <div className="container mx-auto px-4 max-w-7xl">
            {/* Notice Alert */}
            <Alert className="mb-6">
              <AlertTitle>{t("common.note")}</AlertTitle>
              <AlertDescription>
                {t("common.developmentNotice")}
              </AlertDescription>
            </Alert>

            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">{t("teachers.title")}</h1>
              <p className="text-muted-foreground">
                {totalCount > 0 && t("teachers.total", { count: totalCount })}
              </p>
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
            {isLoading && teachers.length === 0 && (
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
                  <Button onClick={() => loadTeachers(1, true)} variant="outline">
                    {t("teachers.retry")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Teachers Grid */}
            {!isLoading || teachers.length > 0 ? (
              <>
                {teachers.length === 0 && !isLoading && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        {debouncedSearchQuery
                          ? t("teachers.noResults", { query: debouncedSearchQuery })
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
                    ref={loaderRef}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("teachers.loadingMore")}
                  </div>
                )}

                {/* End of Results */}
                {!hasMore && teachers.length > 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t("teachers.endOfResults", { count: totalCount })}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>
    </>
  );
}

