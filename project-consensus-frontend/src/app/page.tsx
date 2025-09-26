"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForumPostPreviewCard } from "@/components/ForumPostPreviewCard";
import { useI18n } from "@/hooks/useI18n";
import CreateForumPostButton from "@/components/CreateForumPostButton";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/utils";
import { ListPostsResponse } from "@/types/api";
import { ForumPost } from "@/types";

export default function HomePage() {
  const { t } = useI18n();
  const [posts, setPosts] = React.useState<ForumPost[]>([]);
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);
  const [nextUrl, setNextUrl] = React.useState<string | null>("/api/forum/posts/?page=1&page_size=12");

  const handleLike = (id: string) => {
    // Client-side only like toggle for demo
    setPosts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const nextLiked = !p.isLiked;
      const nextLikes = Math.max(0, p.likes + (nextLiked ? 1 : -1));
      return { ...p, isLiked: nextLiked, likes: nextLikes };
    }));
  };

  const visiblePosts = posts; // We append pages from server; all posts are visible
  const remaining = nextUrl ? 1 : 0; // sentinel uses presence of next page

  const fetchMore = React.useCallback(async () => {
    if (!nextUrl || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await apiGet<ListPostsResponse>(nextUrl);
      setPosts(prev => {
        const existing = new Set(prev.map(p => p.id));
        const deduped = (data.results as unknown as ForumPost[]).filter(p => !existing.has(p.id));
        return [...prev, ...deduped];
      });
      setNextUrl(data.next ? new URL(data.next).pathname + new URL(data.next).search : null);
    } catch (err) {
      console.error(err);
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
                <ForumPostPreviewCard key={post.id} post={post} onLike={handleLike} />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div className="max-w-7xl mx-auto flex justify-center mt-6">
              <div ref={loaderRef} className="h-8 w-full" aria-hidden="true" />
            </div>
          </div>
        </main>
      </div>
      <CreateForumPostButton />
    </>
  );
}
