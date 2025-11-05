"use client";

import * as React from "react";
import { Suspense } from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForumPostPreviewCard } from "@/components/ForumPostPreviewCard";
import { useI18n } from "@/hooks/use-i18n";
import CreateForumPostButton from "@/components/CreateForumPostButton";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { toggleLikeForumPost, fetchForumPosts } from "@/lib/api/forum-post";
import { ForumPost } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { ForumFilterBar } from "@/components/ForumFilterBar";
import { useSearchParams } from "next/navigation";

// Extract the logic using `useSearchParams` to a child component
function HomePageContent() {
  const { t } = useI18n();
  const { user } = useApp();
  const searchParams = useSearchParams();

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
      <div className="w-full p-6 pt-0">
        <div className="max-w-7xl mx-auto mb-4">
          <ForumFilterBar
            initialSort={initialSort}
            initialSearch={searchQuery ?? ""}
            initialTags={tagParams}
          />
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
          <div className="w-full p-6">
            <div className="max-w-7xl mx-auto mb-1">
              <Alert>
                <AlertTitle>{t('common.note')}</AlertTitle>
                <AlertDescription>
                  {t('common.developmentNotice')}
                </AlertDescription>
              </Alert>
            </div>
          </div>

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