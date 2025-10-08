"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForumPostPreviewCard } from "@/components/ForumPostPreviewCard";
import { useI18n } from "@/hooks/use-i18n";
import CreateForumPostButton from "@/components/CreateForumPostButton";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { likeForumPost, unlikeForumPost, fetchForumPosts } from "@/lib/api/forum-post";
import { ForumPost } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";

export default function HomePage() {
  const { t } = useI18n();
  const { isLoggedIn, user } = useApp();
  const {
    items: posts,
    setItems: setPosts,
    loaderRef,
    hasMore,
    error: loadError,
    setError: setLoadError,
    loadMore,
  } = useInfiniteList<ForumPost, import("@/types").FetchForumPostsParams>({
    fetchPage: fetchForumPosts,
    initialParams: { page: 1, pageSize: 12 },
    pageSize: 12,
    dedupeKey: (p) => p.id,
  });

  // 防止 "连点点赞/取消赞" 导致 UI 和后端状态打架的轻量级锁
  // Lightweight lock to prevent double-tap like/unlike causing UI/server mismatch
  //
  // 用法：
  // - 某条评论正在发起点赞/取消赞请求时，把这条评论的 id 放进 Set 里；
  // - 在请求成功、失败或超时后，再把它从 Set 里移除；
  // - 只要 id 还在 Set 里，后续对同一条评论的点击一律忽略（避免计数 "抖动"）。
  // Meaning:
  // - When a like/unlike request is in flight for a comment, put its id into this Set
  // - Remove the id after success/error/timeout
  // - While the id stays in the Set, further toggles for that comment are ignored
  const postLikeInFlightRef = React.useRef<Set<string>>(new Set());

  const handleLike = React.useCallback((id: string) => {
    const target = posts.find(p => p.id === id);
    if (!target) return;
    if (postLikeInFlightRef.current.has(id)) return;
    postLikeInFlightRef.current.add(id);

    const wasLiked = target.isLiked ?? false;
    const prevLikes = target.likes ?? 0;
    const willLike = !wasLiked;

    // Optimistic UI update
    setPosts(prev => prev.map(p => p.id === id
      ? { ...p, isLiked: willLike, likes: Math.max(0, p.likes + (willLike ? 1 : -1)) }
      : p
    ));

    const likeAction = willLike ? likeForumPost(id) : unlikeForumPost(id);
    likeAction
      .then((data) => {
        setPosts(prev => prev.map(p => p.id === id
          ? { ...p, isLiked: !!data.isLiked, likes: Math.max(0, data.likes) }
          : p
        ));
        postLikeInFlightRef.current.delete(id);
      })
      .catch(() => {
        setPosts(prev => prev.map(p => p.id === id
          ? { ...p, isLiked: wasLiked, likes: Math.max(0, prevLikes) }
          : p
        ));
        postLikeInFlightRef.current.delete(id);
      });
  }, [posts]);

  const visiblePosts = posts; // All loaded posts are shown

  // no-op

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

          <div className="w-full p-6 pt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
              {visiblePosts.map(post => (
                <ForumPostPreviewCard key={post.id} post={post} onLike={handleLike} currentUserId={user?.id} />
              ))}
            </div>

            {/* Infinite scroll sentinel (handled by useInfiniteList) */}
            <div className="max-w-7xl mx-auto flex justify-center mt-6">
              <div ref={loaderRef} className="h-8 w-full" aria-hidden="true" />
            </div>
          </div>
        </main>
      </div>
      {loadError && hasMore && (
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
      <CreateForumPostButton />
    </>
  );
}
