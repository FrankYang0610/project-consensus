"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stripHtmlTags } from "@/lib/html-utils";
import { fetchNotifications, markRead, markAllRead, deleteRead } from "@/lib/api/notification";
import type { NotificationItem } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";

export default function NotificationsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { isLoggedIn, openLoginModal } = useApp();
  const [busy, setBusy] = React.useState<boolean>(false);

  const {
    items,
    setItems,
    loaderRef,
    hasMore,
    error: loadError,
    setError: setLoadError,
    loadMore,
    reset,
  } = useInfiniteList<NotificationItem, { unreadOnly?: boolean }>({
    fetchPage: fetchNotifications,
    initialParams: isLoggedIn ? {} : undefined,
    pageSize: 20,
    dedupeKey: (n) => String(n.id),
    enabled: isLoggedIn,
  });

  const navigateToTarget = React.useCallback((n: NotificationItem) => {
    if (n.courseId) {
      router.push(`/courses/${n.courseId}`);
      return;
    }
    if (n.forumPostId) {
      const hash = n.forumPostCommentId ? `#comment-${n.forumPostCommentId}` : '';
      router.push(`/post/${n.forumPostId}${hash}`);
      return;
    }
  }, [router]);

  const displayActor = (n: NotificationItem): string => {
    return n.actor?.name || 'Someone';
  };

  const notificationTitleText = (n: NotificationItem): string => {
    const actor = displayActor(n);
    // Strip HTML tags from referenced content
    const referencedContentPreview = stripHtmlTags(n.referencedContentPreview || '');
    const referencedContentPreviewQuoted = referencedContentPreview ? `"${referencedContentPreview}"` : '';

    switch (n.type) {
      case 'forumPostLiked':
        return t('notifications.messages.forumPostLiked', { actor, target: referencedContentPreviewQuoted }) || `${actor} liked your forum post ${referencedContentPreviewQuoted}`.trim();
      case 'forumPostCommented':
        return t('notifications.messages.forumPostCommented', { actor, target: referencedContentPreviewQuoted }) || `${actor} commented on your forum post ${referencedContentPreviewQuoted}`.trim();
      case 'forumPostCommentLiked':
        return t('notifications.messages.forumPostCommentLiked', { actor, target: referencedContentPreviewQuoted }) || `${actor} liked your forum comment ${referencedContentPreviewQuoted}`.trim();
      case 'forumPostCommentReplied':
        return t('notifications.messages.forumPostCommentReplied', { actor, target: referencedContentPreviewQuoted }) || `${actor} replied to your forum comment ${referencedContentPreviewQuoted}`.trim();
      case 'courseReviewLiked':
        return t('notifications.messages.courseReviewLiked', { actor, target: referencedContentPreviewQuoted }) || `${actor} liked your course review ${referencedContentPreviewQuoted}`.trim();
      case 'courseReviewReplied':
        return t('notifications.messages.courseReviewReplied', { actor, target: referencedContentPreviewQuoted }) || `${actor} replied to your course review ${referencedContentPreviewQuoted}`.trim();
      case 'courseReviewReplyLiked':
        return t('notifications.messages.courseReviewReplyLiked', { actor, target: referencedContentPreviewQuoted }) || `${actor} liked your course review reply ${referencedContentPreviewQuoted}`.trim();
      case 'courseReviewReplyReplied':
        return t('notifications.messages.courseReviewReplyReplied', { actor, target: referencedContentPreviewQuoted }) || `${actor} replied to your course review reply ${referencedContentPreviewQuoted}`.trim();
      default:
        return t('notifications.messages.unknownType', { actor, type: n.type }) || `Unknown notification type (${n.type}) from ${actor}`;
    }
  };

  const handleMarkAllRead = async () => {
    if (!isLoggedIn) { openLoginModal(); return; }
    setBusy(true);
    try {
      await markAllRead();
      setItems(prev => (prev || []).map(it => ({ ...it, isRead: true })));
    } finally { setBusy(false); }
  };

  const handleDeleteRead = async () => {
    if (!isLoggedIn) { openLoginModal(); return; }
    setBusy(true);
    try {
      await deleteRead();
      setItems(prev => (prev || []).filter(it => !it.isRead));
    } finally { setBusy(false); }
  };

  const handleClickItem = async (n: NotificationItem) => {
    if (!n.isRead) {
      try { await markRead(n.id); setItems(prev => (prev || []).map(it => it.id === n.id ? { ...it, isRead: true } : it)); } catch {}
    }
    navigateToTarget(n);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNavigation showBackButton onBackClick={() => router.back()} />
      <main className="w-full py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">{t('notifications.title') || 'Notifications'}</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={busy}>
                {t('notifications.markAllRead') || 'Mark all read'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteRead} disabled={busy}>
                {t('notifications.deleteRead') || 'Delete read'}
              </Button>
            </div>
          </div>

          {!items && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}

          {items && items.length === 0 && (
            <div className="text-sm text-muted-foreground">{t('notifications.empty') || 'No notifications yet.'}</div>
          )}

          {items && items.length > 0 && (
            <>
              <div className="divide-y border rounded">
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClickItem(n)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-accent/100 transition-colors"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {!n.isRead && <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm line-clamp-1">{notificationTitleText(n)}</div>
                        {n.contentPreview && (
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            "{stripHtmlTags(n.contentPreview)}"
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Infinite scroll sentinel & controls (handled by useInfiniteList) */}
              <div className="text-center pt-3">
                <div ref={loaderRef} className="h-6 w-full" aria-hidden="true" />
                {loadError && hasMore && (
                  <Button
                    className="mt-2"
                    variant="outline"
                    size="sm"
                    onClick={() => { setLoadError(false); loadMore(); }}
                  >
                    {t('common.loadFailedRetry') || 'Retry'}
                  </Button>
                )}
                {!hasMore && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {t('common.noMore') || 'No more'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
