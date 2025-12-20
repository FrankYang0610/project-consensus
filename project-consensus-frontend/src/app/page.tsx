"use client";

import * as React from "react";
import { Suspense } from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { ForumPostPreviewCard } from "@/components/ForumPostPreviewCard";
import { CourseReviewPreviewCard } from "@/components/CourseReviewPreviewCard";
import { useI18n } from "@/hooks/use-i18n";
import CreateForumPostButton from "@/components/CreateForumPostButton";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toggleLikeForumPost, fetchForumPosts } from "@/lib/api/forum-post";
import { fetchCourseReviews, toggleLikeReview } from "@/lib/api/course";
import { ForumPost, CourseReview } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { ForumFilterBar } from "@/components/ForumFilterBar";
import { useSearchParams, useRouter } from "next/navigation";

function HomePageContent() {
  const { t } = useI18n();
  const { user } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL is the single source of truth for filters
  const orderingParam = searchParams.get("ordering") || undefined;
  const searchQuery = searchParams.get("search") || undefined;
  const tagParams = searchParams.getAll("tags").filter(Boolean);

  const {
    items: posts,
    setItems: setPosts,
    loaderRef,
    hasMore,
    error: loadError,
    setError: setLoadError,
    loadMore,
    reset,
  } = useInfiniteList<ForumPost, import("@/types").FetchForumPostsParams>({
    pageFetcher: fetchForumPosts,
    // Initialize from URL to avoid a redundant first reset
    initialParams: {
      page: 1,
      pageSize: 12,
      ...(orderingParam ? { ordering: orderingParam } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(tagParams.length ? { tags: tagParams } : {}),
    },
    pageSize: 12,
    dedupeKey: (p) => p.id,
  });

  // Light-weight lock to prevent UI and backend state from fighting when "clicking like/unlike" multiple times
  const postLikeInFlightRef = React.useRef<Set<string>>(new Set());

  const handleLike = React.useCallback((id: string) => {
    const target = posts.find(p => p.id === id);
    if (!target) return;
    if (postLikeInFlightRef.current.has(id)) return;
    postLikeInFlightRef.current.add(id);

    const wasLiked = target.isLiked ?? false;
    const prevLikes = target.likesCount ?? 0;
    const willLike = !wasLiked;

    // Optimistic UI update
    setPosts(prev => prev.map(p => p.id === id
      ? { ...p, isLiked: willLike, likesCount: Math.max(0, (p.likesCount ?? 0) + (willLike ? 1 : -1)) }
      : p
    ));

    toggleLikeForumPost(id)
      .then((data) => {
        setPosts(prev => prev.map(p => p.id === id
          ? { ...p, isLiked: !!data.isLiked, likesCount: Math.max(0, data.likesCount) }
          : p
        ));
        postLikeInFlightRef.current.delete(id);
      })
      .catch(() => {
        setPosts(prev => prev.map(p => p.id === id
          ? { ...p, isLiked: wasLiked, likesCount: Math.max(0, prevLikes) }
          : p
        ));
        postLikeInFlightRef.current.delete(id);
      });
  }, [posts, setPosts]);

  const visiblePosts = posts; // All loaded posts are shown

  // Latest course reviews for horizontal scroller
  const [latestReviews, setLatestReviews] = React.useState<CourseReview[]>([]);
  const [latestReviewsLoading, setLatestReviewsLoading] = React.useState(false);
  const [latestReviewsError, setLatestReviewsError] = React.useState(false);

  // Helper: map ordering to sort key for UI
  const mapOrderingToSort = (ordering?: string): string => {
    switch (ordering) {
      case "-created_at":
        return "newest";
      case "-likes_count":
        return "likes";
      case "-comments_count":
        return "comments";
      default:
        return "default";
    }
  };

  const initialSort = mapOrderingToSort(orderingParam);

  // Fetch latest course reviews (top 10 by created_at desc)
  React.useEffect(() => {
    let cancelled = false
    async function loadLatestReviews() {
      setLatestReviewsLoading(true);
      setLatestReviewsError(false);
      try {
        const res = await fetchCourseReviews({
          page: 1,
          pageSize: 10,
          ordering: "-created_at",
        });
        if (!cancelled) { setLatestReviews(res.results ?? []); }
      } catch (err) {
        console.error("Failed to load latest course reviews:", err);
        if (!cancelled) { setLatestReviewsError(true); }
      } finally {
        if (!cancelled) { setLatestReviewsLoading(false); }
      }
    }
    loadLatestReviews();
    return () => { cancelled = true; };
  }, []);

  const handleLikeLatestReview = React.useCallback(async (reviewId: string) => {
    try {
      const updated = await toggleLikeReview(reviewId);
      setLatestReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? updated : r)),
      );
    } catch (err) {
      console.error("Failed to like course review:", err);
    }
  }, []);

  const goToLatestReviewsPage = React.useCallback(() => {
    router.push("/courses/latest-reviews");
  }, [router]);

  // React to URL changes by resetting the list (skip initial run to avoid duplicate fetch)
  const didInitRef = React.useRef(false);
  React.useEffect(() => {
    const nextParams: import("@/types").FetchForumPostsParams = {
      page: 1,
      pageSize: 12,
      ...(orderingParam ? { ordering: orderingParam } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(tagParams.length ? { tags: tagParams } : {}),
    };
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    reset(nextParams);
  }, [orderingParam, searchQuery, JSON.stringify([...tagParams].sort()), reset]);

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-0 pb-6">
        <div className="max-w-7xl mx-auto mb-4 space-y-4">
          {/* Horizontal latest course reviews scroller */}
          {!latestReviewsError && (latestReviews.length > 0 || latestReviewsLoading) && (
            <section aria-label={t("courses.latestReviews.title")}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold">
                  {t("courses.latestReviews.title")}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={goToLatestReviewsPage}
                >
                  {t("courses.latestReviews.loadMore")}
                </Button>
              </div>
              <div className="grid grid-flow-col auto-cols-[minmax(320px,380px)] sm:auto-cols-[minmax(360px,420px)] lg:auto-cols-[minmax(380px,460px)] gap-4 overflow-x-auto pb-2 pl-2 sm:pl-3">
                {latestReviewsLoading && latestReviews.length === 0 ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[220px] w-full min-w-[320px] sm:min-w-[360px] lg:min-w-[380px] rounded-lg bg-muted animate-pulse"
                    />
                  ))
                ) : (
                  <>
                    {latestReviews.map((review) => (
                      <CourseReviewPreviewCard
                        key={review.id}
                        review={review}
                        onLike={handleLikeLatestReview}
                        className="h-full"
                        compactMeta
                      />
                    ))}
                    {/* "View more" card at the end of the scroller */}
                    <Card
                      className="flex h-full min-h-[220px] cursor-pointer items-center justify-center border-dashed border-muted-foreground/40 bg-background/80 hover:border-primary/60 hover:bg-primary/5 transition-colors"
                      onClick={goToLatestReviewsPage}
                    >
                      <CardContent className="flex h-full w-full flex-col items-center justify-center py-5">
                        <p className="text-sm font-semibold text-foreground text-center">
                          {t("courses.latestReviews.viewMoreCourseReviews")}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </section>
          )}

          <div className="pt-4 sm:pt-6">
            <ForumFilterBar
              initialSort={initialSort}
              initialSearch={searchQuery ?? ""}
              initialTags={tagParams}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          {visiblePosts.map(post => (
            <ForumPostPreviewCard key={post.id} post={post} onLike={handleLike} currentUserId={user?.id} />
          ))}
        </div>

        {/* Infinite scroll sentinel (handled by `useInfiniteList`) */}
        <div className="max-w-7xl mx-auto flex justify-center mt-6">
          <div ref={loaderRef} className="h-8 w-full" aria-hidden="true" />
        </div>
      </div>

      {loadError && (hasMore || visiblePosts.length === 0) && (
        <Button
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 hover:bg-red-700 text-white"
          onClick={() => {
            setLoadError(false);
            loadMore();
          }}
        >
          {t('common.loadFailedRetry')}
        </Button>
      )}
    </>
  );
}

// Loading component
function HomePageLoading() {
  const { t } = useI18n();

  return (
    <div className="w-full p-6 pt-0">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 h-12 bg-muted animate-pulse rounded"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main component
export default function HomePage() {
  const { t } = useI18n();

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-8">
          {/* Wrap the component using `useSearchParams` with `Suspense` */}
          <Suspense fallback={<HomePageLoading />}>
            <HomePageContent />
          </Suspense>
        </main>
      </div>
      <CreateForumPostButton />
    </>
  );
}