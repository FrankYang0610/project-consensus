"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ForumPostComment } from "@/types/forum";
import { ForumPostCommentCard as ForumPostCommentComponent } from "./ForumPostCommentCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MessageSquare, Plus, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { apiGet, apiPost, apiDeleteVoid } from "@/lib/api/api-utils";
import { cn, isContentEmpty } from "@/lib/utils";
import { GetForumPostCommentPositionResponse, ListCommentsResponse } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import ForumPostCommentComposer from "@/components/ForumPostCommentComposer";

// Use a stable component identity for the editor to avoid remounts on each render
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

/**
 * 论坛帖子评论列表组件的属性接口
 * Interface for ForumPostCommentList component props
 */
interface ForumPostCommentListProps {
  onLike?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onAddComment?: () => void;
  currentUserId?: string;
  postId: string;
  totalCount?: number;
  // Composer controls
  isComposerOpen?: boolean;
  replyToId?: string;
  composerValue?: string;
  onComposerChange?: (html: string) => void;
  composerIsAnonymous?: boolean;
  onComposerAnonymousChange?: (checked: boolean) => void;
  onSubmitComposer?: () => void;
  onCancelComposer?: () => void;
  isComposerSubmitting?: boolean;
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
  onAddComment,
  currentUserId,
  postId,
  totalCount,
  isComposerOpen = false,
  replyToId,
  composerValue = "",
  onComposerChange,
  composerIsAnonymous = false,
  onComposerAnonymousChange,
  onSubmitComposer,
  onCancelComposer,
  isComposerSubmitting = false
}: ForumPostCommentListProps) {
  const { t } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();
  
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);

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
  const likeInFlightRef = React.useRef<Set<string>>(new Set());

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
    const el = document.getElementById(`comment-${targetId}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.pageYOffset;
      const targetTop = Math.max(absoluteTop - (window.innerHeight / 2 - rect.height / 2), 0);
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
      // brief highlight
      el.classList.add('ring-2', 'ring-primary/40');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40'), 2000);
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
  const idToCommentMap = React.useMemo(() => {
    const map = new Map<string, ForumPostComment>();
    for (const c of comments) map.set(c.id, c);
    return map;
  }, [comments]);
  React.useEffect(() => {
    // keep ref in sync for event handlers
    idToComment.current = idToCommentMap;
  }, [idToCommentMap]);

  // Store per-comment rollback snapshots for delete operations
  const deleteRollbackByIdRef = React.useRef<Map<string, Pick<ForumPostComment, 'isDeleted' | 'content'>>>(new Map());

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

  // Optimistic like toggle listener (with in-flight lock and server reconciliation)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      const id = custom.detail?.id;
      if (!id) return;
      
      // Ignore if a like/unlike request is already in flight for this id
      if (likeInFlightRef.current.has(id)) return;

      // Add to in-flight lock
      likeInFlightRef.current.add(id);

      // Compute the intended next like state once using the current snapshot
      const current = idToComment.current.get(id);
      const prevLiked = !!current?.isLiked;
      const prevLikes = typeof current?.likes === 'number' ? current.likes : 0;
      const willLike = !prevLiked;
      setComments(prev => {
        const next = prev.map(c => {
          if (c.id !== id) return c;
          return { ...c, isLiked: willLike, likes: Math.max(0, c.likes + (willLike ? 1 : -1)) };
        });
        return next;
      });

      // fire API request
      const url = willLike ? `/api/forum/comments/${id}/like/` : `/api/forum/comments/${id}/unlike/`;
      apiPost<ForumPostComment>(url, {})
        .then((data) => {
          // Reconcile with server truth
          setComments(prev => prev.map(c => {
            if (c.id !== id) return c;
            return { ...c, isLiked: !!data.isLiked, likes: Math.max(0, data.likes) };
          }));
          likeInFlightRef.current.delete(id);  // Remove from in-flight lock
        })
        .catch(() => {
          // revert on error
          setComments(prev => prev.map(c => {
            if (c.id !== id) return c;
            return { ...c, isLiked: prevLiked, likes: Math.max(0, prevLikes) };
          }));
          likeInFlightRef.current.delete(id);  // Remove from in-flight lock
        });
    };
    window.addEventListener('pc:toggle-comment-like', handler as EventListener);
    return () => window.removeEventListener('pc:toggle-comment-like', handler as EventListener);
  }, []);

  // Optimistic delete listener
  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      const id = custom.detail?.id;
      if (!id) return;

      // Ensure the target exists before proceeding
      if (!idToComment.current.has(id)) return;

      // Capture rollback snapshot from the updater's prev state to avoid races
      setComments(prevList => {
        const target = prevList.find(c => c.id === id);
        if (!target) return prevList;
        deleteRollbackByIdRef.current.set(id, { isDeleted: !!target.isDeleted, content: target.content });
        return prevList.map(c => c.id === id ? { ...c, isDeleted: true, content: "" } : c);
      });

      apiDeleteVoid(`/api/forum/comments/${id}/`)
        .then(() => {
          // Inform children/previews to update their local lists
          window.dispatchEvent(new CustomEvent('pc:comment-deleted-ok', { detail: { id } }));
          deleteRollbackByIdRef.current.delete(id);
        })
        .catch(() => {
          // Rollback on error
          const snapshot = deleteRollbackByIdRef.current.get(id);
          setComments(prevList => prevList.map(c => c.id === id ? { ...c, isDeleted: snapshot?.isDeleted ?? false, content: snapshot?.content ?? c.content } : c));
          // Inform children/previews to rollback if they had updated
          window.dispatchEvent(new CustomEvent('pc:comment-deleted-rollback', { detail: { id } }));
          deleteRollbackByIdRef.current.delete(id);
        });
    };
    window.addEventListener('pc:delete-comment', handler as EventListener);
    return () => window.removeEventListener('pc:delete-comment', handler as EventListener);
  }, []);

  // New comment created listener (optimistically bump parent replies count)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ comment: ForumPostComment }>; // created payload
      const created = custom.detail?.comment;
      if (!created) return;
      const parentId = created.replyTo;
      if (!parentId) return; // only bump for replies to a comment
      setComments(prev => prev.map(c => c.id === parentId ? { ...c, replies: (typeof c.replies === 'number' ? c.replies : (0)) + 1 } : c));
    };
    window.addEventListener('pc:comment-created', handler as EventListener);
    return () => window.removeEventListener('pc:comment-created', handler as EventListener);
  }, []);

  const isComposerContentEmpty = React.useMemo(() => {
    return isContentEmpty(composerValue);
  }, [composerValue]);

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

      {/* 顶部评论写作区（当未指定回复对象时） / Top-level composer when not replying to a specific comment */}
      {isComposerOpen && !replyToId && (
        <ForumPostCommentComposer
          anchorId="composer-top"
          value={composerValue ?? ""}
          onChange={(v: string) => onComposerChange?.(v)}
          placeholder={t('comment.writePlaceholder') || 'Write a comment…'}
          isAnonymous={!!composerIsAnonymous}
          onAnonymousChange={(v) => onComposerAnonymousChange?.(Boolean(v))}
          onSubmit={onSubmitComposer}
          onCancel={onCancelComposer}
          isSubmitDisabled={isComposerContentEmpty || !!isComposerSubmitting}
          closeAriaLabel={t('common.close') || 'Close'}
          anonymousLabel={t('comment.anonymous') || 'Comment anonymously'}
          postLabel={t('comment.post') || 'Post'}
        />
      )}

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
            const parentComment = isReply && comment.replyTo ? idToCommentMap.get(comment.replyTo) : undefined;
            return (
              <React.Fragment key={comment.id}>
                <ForumPostCommentComponent
                  comment={comment}
                  onLike={onLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  currentUserId={currentUserId}
                  isReply={isReply}
                  parentComment={parentComment}
                  onClickParent={() => {
                    if (comment.replyTo) scrollToComment(comment.replyTo);
                  }}
                />
                {isComposerOpen && replyToId === comment.id && (
                  <ForumPostCommentComposer
                    anchorId={`composer-for-comment-${comment.id}`}
                    isReply
                    value={composerValue ?? ""}
                    onChange={(v: string) => onComposerChange?.(v)}
                    placeholder={t('comment.writePlaceholder') || 'Write a comment…'}
                    isAnonymous={!!composerIsAnonymous}
                    onAnonymousChange={(v) => onComposerAnonymousChange?.(Boolean(v))}
                    onSubmit={onSubmitComposer}
                    onCancel={onCancelComposer}
                    isSubmitDisabled={isComposerContentEmpty || !!isComposerSubmitting}
                    closeAriaLabel={t('common.close') || 'Close'}
                    anonymousLabel={t('comment.anonymous') || 'Comment anonymously'}
                    postLabel={t('comment.post') || 'Post'}
                  />
                )}
              </React.Fragment>
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
          {t('comment.loadingTargetReply')}
        </div>
      )}
    </div>
  );
}
