"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForumPostPreviewCard } from "@/components/ForumPostPreviewCard";
import { useI18n } from "@/hooks/useI18n";
import CreateForumPostButton from "@/components/CreateForumPostButton";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/utils";
import { ListPostsResponse } from "@/types/api";
import { ForumPost } from "@/types";

export default function HomePage() {
  const { t } = useI18n();
  const { isLoggedIn, user } = useApp();
  const [posts, setPosts] = React.useState<ForumPost[]>([]);
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);
  const [nextUrl, setNextUrl] = React.useState<string | null>("/api/forum/posts/?page=1&page_size=12");
  const [loadError, setLoadError] = React.useState(false);

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

    const endpoint = willLike ? `/api/forum/posts/${id}/like/` : `/api/forum/posts/${id}/unlike/`;
    apiPost<ForumPost>(endpoint, {})
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

  const visiblePosts = posts; // We append pages from server; all posts are visible
  const remaining = nextUrl ? 1 : 0; // sentinel uses presence of next page

  const fetchMore = React.useCallback(async () => {
    if (!nextUrl || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await apiGet<ListPostsResponse>(nextUrl);
      setPosts(prev => {
        const existing = new Set(prev.map(p => p.id));
        const deduped = data.results.filter(p => !existing.has(p.id));
        return [...prev, ...deduped];
      });
      setNextUrl(data.next ? new URL(data.next).pathname + new URL(data.next).search : null);
      setLoadError(false);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      loadingRef.current = false;
    }
  }, [nextUrl]);

  React.useEffect(() => {
    // initial fetch
    if (posts.length === 0 && nextUrl) {
      fetchMore();
    }
  }, []);

  React.useEffect(() => {
    if (!loaderRef.current) return;
    const target = loaderRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && remaining > 0) {
          fetchMore();
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [remaining, fetchMore]);

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

            {/* Infinite scroll sentinel */}
            <div className="max-w-7xl mx-auto flex justify-center mt-6">
              <div ref={loaderRef} className="h-8 w-full" aria-hidden="true" />
            </div>
          </div>
        </main>
      </div>
      {loadError && nextUrl && (
        <Button
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 hover:bg-red-700 text-white"
          onClick={() => {
            setLoadError(false);
            fetchMore();
          }}
        >
          {t('common.loadFailedRetry')}
        </Button>
      )}
      <CreateForumPostButton />
    </>
  );
}
