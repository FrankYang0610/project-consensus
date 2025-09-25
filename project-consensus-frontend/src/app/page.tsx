"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForumPostPreviewCard } from "@/components/ForumPostPreviewCard";
import { samplePosts, toggleLikeById } from "@/data/samplePosts";
import { useI18n } from "@/hooks/useI18n";
import CreateForumPostButton from "@/components/CreateForumPostButton";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { t } = useI18n();
  const [posts, setPosts] = React.useState(() => [...samplePosts]);
  const [visibleCount, setVisibleCount] = React.useState(12);
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);

  const handleLike = (id: string) => {
    const updated = toggleLikeById(id);
    if (!updated) return;
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, isLiked: updated.isLiked, likes: updated.likes } : p)));
  };

  const visiblePosts = React.useMemo(() => posts.slice(0, visibleCount), [posts, visibleCount]);
  const remaining = Math.max(0, posts.length - visibleCount);

  React.useEffect(() => {
    if (!loaderRef.current) return;
    const target = loaderRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && remaining > 0 && !loadingRef.current) {
          loadingRef.current = true;
          setVisibleCount(prev => {
            const next = Math.min(prev + 12, posts.length);
            return next;
          });
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [remaining, posts.length]);

  React.useEffect(() => {
    // release loading lock after render updates
    loadingRef.current = false;
  }, [visibleCount]);

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
