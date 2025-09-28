"use client";

import * as React from "react";
import { ForumPostComment } from "@/types/forum";
import { ForumPostCommentCard as ForumPostCommentComponent } from "./ForumPostCommentCard";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { apiGet } from "@/lib/utils";
import { GetForumPostCommentPositionResponse, ListCommentsResponse } from "@/types/api";
import { useApp } from "@/contexts/AppContext";

/**
 * 论坛帖子评论列表组件的属性接口
 * Interface for ForumPostCommentList component props
 */
interface ForumPostCommentListProps {
  onLike?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onShare?: (commentId: string) => void;
  onAddComment?: () => void;
  currentUserId?: string;
  postId: string;
  totalCount?: number;
}

/**
 * 论坛帖子评论列表组件
 * 平级展示所有评论（主评/回复/子回复）并按时间从早到晚排序
 * 
 * Forum Post Comment List Component
 * Flat list of all comments (including replies) in chronological ascending order
 */
export function ForumPostCommentList({
  onLike,
  onReply,
  onDelete,
  onShare,
  onAddComment,
  currentUserId,
  postId,
  totalCount
}: ForumPostCommentListProps) {
  const { t } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();
  
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);

  // 扁平评论流：服务端分页 / Flat comments feed with server pagination
  const [comments, setComments] = React.useState<ForumPostComment[]>([]);
  const [nextUrl, setNextUrl] = React.useState<string | null>(`/api/forum/comments/?postId=${postId}&page=1&page_size=20`);
  const [loadError, setLoadError] = React.useState(false);
  const [isJumpLoading, setIsJumpLoading] = React.useState(false);

  // Reset when postId changes
  React.useEffect(() => {
    setComments([]);
    setNextUrl(`/api/forum/comments/?postId=${postId}&page=1&page_size=20`);
  }, [postId]);

  const fetchMore = React.useCallback(async () => {
    if (!nextUrl || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await apiGet<ListCommentsResponse>(nextUrl);
      setComments(prev => {
        const existing = new Set(prev.map(c => c.id));
        const deduped = data.results.filter(c => !existing.has(c.id));
        const merged = [...prev, ...deduped];
        // 按时间升序确保顺序稳定 / ensure chronological ascending order
        return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      setNextUrl(data.next ? new URL(data.next).pathname + new URL(data.next).search : null);
      setLoadError(false);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      loadingRef.current = false;
    }
  }, [nextUrl]);

  // 平滑滚动到指定评论位置 / Smooth scroll to a comment by id
  const scrollToComment = React.useCallback((targetId: string) => {
    console.log('Attempting to scroll to comment:', targetId);
    const el = document.getElementById(`comment-${targetId}`);
    console.log('Found element:', el);
    if (el) {
      const rect = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.pageYOffset;
      const targetTop = Math.max(absoluteTop - (window.innerHeight / 2 - rect.height / 2), 0);
      console.log('Scrolling to position:', targetTop);
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
      // brief highlight
      el.classList.add('ring-2', 'ring-primary/40');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40'), 2000);
    } else {
      console.warn('Comment element not found:', `comment-${targetId}`);
    }
  }, []);

  // Public method: load until a target comment is available, then scroll to it
  const loadUntilAndScroll = React.useCallback(
    async (targetCommentId: string) => {
      if (!targetCommentId) return;
      // Fast path: if already loaded, just scroll
      if (idToComment.current?.has(targetCommentId)) { scrollToComment(targetCommentId); return; }
      setIsJumpLoading(true);
      try {
        // Ask backend for anchor page and URLs
        const position = await apiGet<GetForumPostCommentPositionResponse>(
          `/api/forum/comments/position/?postId=${postId}&commentId=${targetCommentId}&page_size=20`
        );
        // Load all pages up to the anchor page sequentially (each page depends on the previous nextUrl state)
        for (const url of position.pageUrls) {
          // If we already have moved past or have the comment, break early
          if (idToComment.current?.has(targetCommentId)) break;
          const data = await apiGet<ListCommentsResponse>(url);
          setComments(prev => {
            const existing = new Set(prev.map(c => c.id));
            const deduped = data.results.filter(c => !existing.has(c.id));
            const merged = [...prev, ...deduped];
            return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          });
        }
        // Ensure map is up to date and then scroll
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          setTimeout(() => scrollToComment(targetCommentId), 100);
        });
      } catch (e) {
        console.error(e);
        setLoadError(true);
      } finally {
        setIsJumpLoading(false);
      }
    },
    [postId, scrollToComment]
  );

  // 初次加载评论 / Initial load of comments
  React.useEffect(() => {
    if (comments.length === 0 && nextUrl) {
      fetchMore();
    }
  }, [comments.length, nextUrl, fetchMore]);

  // 总评论数（从 parent 组件传入或根据已加载数据估算）/ Total comments count
  const totalComments = totalCount ?? comments.length;

  // 还有更多可加载的评论？ / Whether more pages exist
  const hasMore = nextUrl ? 1 : 0;

  React.useEffect(() => {
    if (!loaderRef.current) return;
    const target = loaderRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore > 0) {
          fetchMore();
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, fetchMore]);

  // 用于快速查找 parent 评论 / Map for quick parent lookup
  const idToComment = React.useRef<Map<string, ForumPostComment>>(new Map());
  React.useEffect(() => {
    const map = new Map<string, ForumPostComment>();
    for (const c of comments) map.set(c.id, c);
    idToComment.current = map;
  }, [comments]);

  // Expose method via custom event for child cards to request a jump
  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      if (custom.detail?.id) {
        loadUntilAndScroll(custom.detail.id);
      }
    };
    window.addEventListener('pc:jump-to-comment', handler as EventListener);
    return () => window.removeEventListener('pc:jump-to-comment', handler as EventListener);
  }, [loadUntilAndScroll]);

  return (
    <div className="mt-6 px-4 sm:px-0">
      {/* 评论列表头部 / Comment list header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="w-5 h-5" />
          {t('comment.title', { count: totalComments })}
        </h3>
        {/* 添加评论按钮 / Add comment button */}
        {onAddComment && (
          <Button
            onClick={() => {
              if (!isLoggedIn) {
                openLoginModal();
                return;
              }
              onAddComment();
            }}
            size="sm"
            className="h-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('comment.addComment')}
          </Button>
        )}
      </div>

      {/* 评论内容区域 / Comment content area */}
      {comments.length === 0 ? (
        // 无评论时的空状态 / Empty state when no comments
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t('comment.noComments')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 遍历显示扁平评论 / Iterate through and display flat comments */}
          {comments.map((comment) => {
            const isReply = Boolean(comment.replyTo);
            const parentComment = isReply && comment.replyTo ? idToComment.current.get(comment.replyTo) : undefined;
            return (
              <ForumPostCommentComponent
                key={comment.id}
                comment={comment}
                onLike={onLike}
                onReply={onReply}
                onDelete={onDelete}
                onShare={onShare}
                currentUserId={currentUserId}
                isReply={isReply}
                parentComment={parentComment}
                onClickParent={() => {
                  if (comment.replyTo) scrollToComment(comment.replyTo);
                }}
              />
            );
          })}

          {/* Infinite scroll sentinel */}
          <div className="text-center pt-2">
            <div ref={loaderRef} className="h-6 w-full" aria-hidden="true" />
          </div>
        </div>
      )}

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
      {isJumpLoading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-background border rounded-md px-3 py-1 text-xs text-muted-foreground shadow">
          Loading target reply…
        </div>
      )}
    </div>
  );
}
