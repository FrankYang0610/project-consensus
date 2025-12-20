"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CourseBackgroundCard } from "@/components/CourseBackgroundCard";
import { CourseReviewPreviewCard } from "@/components/CourseReviewPreviewCard";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { fetchCourseReviews, toggleLikeReview } from "@/lib/api/course";
import type { CourseReview, FetchCourseReviewsParams } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { MessageSquare, Loader2 } from "lucide-react";

/**
 * Latest Course Reviews Page
 * Display the latest course reviews from the community with infinite scroll loading
 */
export default function LatestReviewsPage() {
  const { t } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();

  // Fetch reviews using infinite list hook (lazy loading strategy aligned with advanced-search)
  const {
    items: reviews,
    setItems: setReviews,
    loaderRef,
    hasMore,
    loading,
    error: loadError,
    setError: setLoadError,
    totalCount,
    loadMore,
  } = useInfiniteList<CourseReview, FetchCourseReviewsParams>({
    pageFetcher: fetchCourseReviews,
    initialParams: { page: 1, pageSize: 20, ordering: '-created_at' },
    pageSize: 20,
    dedupeKey: (r) => r.id,
    autoLoad: true, // Auto-load first page, consistent with advanced-search
  });

  // Handle like action
  const handleLike = React.useCallback(async (reviewId: string) => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }

    try {
      const updatedReview = await toggleLikeReview(reviewId);
      setReviews(prev =>
        prev.map(r => r.id === reviewId ? updatedReview : r)
      );
    } catch (err) {
      console.error('Failed to like review:', err);
    }
  }, [isLoggedIn, openLoginModal, setReviews]);

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-6 sm:py-8">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <CourseBackgroundCard>
                {/* Page title */}
                <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 p-2.5 rounded-lg bg-primary/10">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-bold text-foreground">
                        {t("courses.latestReviews.title")}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        {t("courses.latestReviews.subtitle")}
                      </p>
                      {totalCount !== null && totalCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("courses.latestReviews.totalReviews", { count: totalCount })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Loading state */}
                {loading && reviews.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {t("courses.latestReviews.loading")}
                    </span>
                  </div>
                )}

                {/* Error state */}
                {loadError && reviews.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-destructive mb-2">{t("common.loadFailedRetry")}</p>
                    <button
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors"
                      onClick={() => { setLoadError(false); loadMore(); }}
                    >
                      {t("search.retry")}
                    </button>
                  </div>
                )}

                {/* Reviews list */}
                {!loading && !loadError && reviews.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <MessageSquare className="w-12 h-12 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium text-muted-foreground">
                        {t("courses.latestReviews.noReviews")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {t("courses.latestReviews.noReviewsDesc")}
                      </p>
                    </div>
                  </div>
                )}

                {reviews.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {reviews.map((review) => (
                      <CourseReviewPreviewCard
                        key={review.id}
                        review={review}
                        onLike={handleLike}
                      />
                    ))}
                  </div>
                )}

                {/* Infinite scroll loading indicator (aligned with advanced-search)*/}
                <div className="flex justify-center mt-6">
                  <div ref={loaderRef} className="h-8 w-full" aria-hidden="true" />
                </div>
                {loadError && (hasMore || reviews.length > 0) && (
                  <div className="flex justify-center mt-2">
                    <button
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-md transition-colors text-sm"
                      onClick={() => { setLoadError(false); loadMore(); }}
                    >
                      {t("common.loadFailedRetry")}
                    </button>
                  </div>
                )}

                {/* No more content message */}
                {!hasMore && reviews.length > 0 && (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-sm text-muted-foreground">
                      {t("common.noMore")}
                    </span>
                  </div>
                )}
              </CourseBackgroundCard>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
