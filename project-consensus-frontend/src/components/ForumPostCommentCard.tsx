"use client";

import * as React from "react";
import { Heart, Reply, MoreHorizontal, Trash2, Languages, FileText, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useI18n } from "@/hooks/use-i18n";
import { sanitizeHtml } from "@/lib/html-utils";
import { cn } from "@/lib/utils";
import type { ForumPostComment } from "@/types/forum";
import { stripHtmlTags, truncateHtmlContent } from "@/lib/html-utils";
import { fetchForumComments } from "@/lib/api/forum-comment";

import ClientOnlyTime from "./ClientOnlyTime";
import { useApp } from "@/contexts/AppContext";

interface ForumPostCommentCardProps {
  comment: ForumPostComment;
  onLike?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  isReply?: boolean;
  currentUserId?: string;
  parentComment?: ForumPostComment;
  onClickParent?: () => void;
}

export function ForumPostCommentCard({
  comment,
  onLike,
  onReply,
  onDelete,
  isReply = false,
  currentUserId,
  parentComment,
  onClickParent
}: ForumPostCommentCardProps) {
  const { t, language } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isTranslated, setIsTranslated] = React.useState(false);
  const [isCopySuccess, setIsCopySuccess] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isRepliesOpen, setIsRepliesOpen] = React.useState(false);
  const [isRepliesLoading, setIsRepliesLoading] = React.useState(false);
  const [repliesError, setRepliesError] = React.useState<string | null>(null);
  const [replies, setReplies] = React.useState<ForumPostComment[] | null>(null);
  const [repliesNextUrl, setRepliesNextUrl] = React.useState<string | null>(null);

  // 复制提示的定时器引用
  // Timeout reference for copy success
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);


  // 在发起 "删除评论" 这次操作时，我们把两个全局事件监听器先存起来：pc:comment-deleted-ok（删除成功）和 pc:comment-deleted-rollback（删除撤回/失败回滚）。之所以存起来，是为了在流程结束（成功或回滚）后，能统一、可靠地把这些监听器移除，避免重复绑定和内存泄漏。存放位置是 deleteEventHandlersRef（一个 useRef 对象），里面会暂存 onOk 和 onRollback 这两个回调。removeDeleteListeners 就是把这次删除流程临时加的全局监听器移除，并把引用清空。这样下一次删除不会受到上一次遗留监听的影响。
  // When starting the "delete comment" operation, we store two global event listeners: pc:comment-deleted-ok (delete successful) and pc:comment-deleted-rollback (delete rollback/failed rollback). We store them because we need to remove them reliably after the process ends (successful or rollback). The storage location is deleteEventHandlersRef (a useRef object), which temporarily stores the onOk and onRollback callbacks. removeDeleteListeners removes the global listeners added for this delete and clears the reference. This way, the next delete will not be affected by the previous leftover listeners.
  const deleteEventHandlersRef = React.useRef<{ onOk?: EventListener; onRollback?: EventListener }>({});
  const removeDeleteListeners = React.useCallback(() => {
    const { onOk, onRollback } = deleteEventHandlersRef.current;
    if (onOk) {
      window.removeEventListener('pc:comment-deleted-ok', onOk);
    }
    if (onRollback) {
      window.removeEventListener('pc:comment-deleted-rollback', onRollback);
    }
    deleteEventHandlersRef.current = {};
  }, []);

  // 用于存储回复删除前的原始状态，支持删除操作的撤销功能
  // Stores the original state of replies before deletion to support rollback functionality for delete operations
  const prevRepliesByIdRef = React.useRef<Map<string, ForumPostComment>>(new Map());

  const repliesCount = (typeof comment.replies === 'number' ? comment.replies : undefined) ?? (replies?.length ?? 0);


  const handleLike = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    if (onLike) {
      onLike(comment.id);
    }
  };

  const handleReply = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    if (onReply) {
      onReply(comment.id);
    }
  };

  const handleDeleteClick = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (onDelete && !isDeleting) {
      setIsDeleting(true);
      removeDeleteListeners();
      const done = () => {
        removeDeleteListeners();
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
      };
      const onOk: EventListener = (event) => {
        const custom = event as CustomEvent<{ id: string }>;
        if (custom.detail?.id === comment.id) {
          done();
        }
      };
      const onRollback: EventListener = (event) => {
        const custom = event as CustomEvent<{ id: string }>;
        if (custom.detail?.id === comment.id) {
          done();
        }
      };
      deleteEventHandlersRef.current = { onOk, onRollback };
      window.addEventListener('pc:comment-deleted-ok', onOk);
      window.addEventListener('pc:comment-deleted-rollback', onRollback);
      onDelete(comment.id);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
  };

  const handleTranslate = async () => {
    setIsTranslated(prev => !prev);
  };


  const handleCopyText = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const textToCopy = `${comment.content}\n\n- ${comment.author.name}`;
      await navigator.clipboard.writeText(textToCopy);
      setIsCopySuccess(true);
      setIsDropdownOpen(false);
      if (copyTimeoutRef.current !== undefined) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setIsCopySuccess(false);
        copyTimeoutRef.current = undefined;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const canDelete = comment.canDelete === true;

  const toRelative = React.useCallback((url: string | null): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch {
      return url;
    }
  }, []);

  const fetchRepliesIfNeeded = React.useCallback(async () => {
    if (replies !== null || isRepliesLoading) return;
    setIsRepliesLoading(true);
    setRepliesError(null);
    try {
      const data = await fetchForumComments({
        postId: comment.postId,
        replyTo: comment.id,
        page: 1,
        pageSize: 5
      });
      setReplies(data.results);
      setRepliesNextUrl(toRelative(data.next));
    } catch (e) {
      console.error(e);
      setRepliesError('failed');
    } finally {
      setIsRepliesLoading(false);
    }
  }, [comment.id, replies, isRepliesLoading, toRelative]);

  const loadRemainingReplies = React.useCallback(async () => {
    if (!repliesNextUrl || isRepliesLoading) return;
    setIsRepliesLoading(true);
    setRepliesError(null);
    try {
      // For loading remaining replies, we need to parse the nextUrl to get page number
      // This is a simplified approach - in a real app you might want to store page numbers
      let currentPage = 2; // Start from page 2 since we already loaded page 1
      while (repliesNextUrl) {
        const data = await fetchForumComments({
          postId: comment.postId,
          replyTo: comment.id,
          page: currentPage,
          pageSize: 5
        });
        setReplies(prev => {
          const existing = new Set((prev ?? []).map(c => c.id));
          const deduped = data.results.filter(c => !existing.has(c.id));
          return [ ...(prev ?? []), ...deduped ];
        });
        if (!data.next) {
          setRepliesNextUrl(null);
          break;
        }
        currentPage++;
      }
      setRepliesNextUrl(null);
    } catch (e) {
      console.error(e);
      setRepliesError('failed');
    } finally {
      setIsRepliesLoading(false);
    }
  }, [repliesNextUrl, isRepliesLoading, toRelative]);

  // 组件卸载时清理复制提示的定时器与删除评论相关的全局监听器，避免遗留资源
  // Clean up copy success timeout and comment deletion listeners on unmount to prevent lingering resources
  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== undefined) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = undefined;
      }
      removeDeleteListeners();
    };
  }, [removeDeleteListeners]);

  // Listen for global delete events to update loaded replies optimistically
  React.useEffect(() => {
    const onOk = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      const id = custom.detail?.id;
      if (!id || !replies) return;
      setReplies(prev => {
        if (!prev) return prev;
        let changed = false;
        const next = prev.map(r => {
          if (r.id !== id) return r;
          if (!prevRepliesByIdRef.current.has(id)) {
            prevRepliesByIdRef.current.set(id, r);
          }
          changed = true;
          return { ...r, isDeleted: true, content: "" };
        });
        return changed ? next : prev;
      });
    };
    const onRollback = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      const id = custom.detail?.id;
      if (!id || !replies) return;
      const prevVersion = prevRepliesByIdRef.current.get(id);
      if (!prevVersion) return;
      setReplies(prev => {
        if (!prev) return prev;
        let changed = false;
        const next = prev.map(r => {
          if (r.id !== id) return r;
          changed = true;
          return { ...prevVersion };
        });
        if (changed) {
          prevRepliesByIdRef.current.delete(id);
        }
        return changed ? next : prev;
      });
    };
    window.addEventListener('pc:comment-deleted-ok', onOk as EventListener);
    window.addEventListener('pc:comment-deleted-rollback', onRollback as EventListener);
    return () => {
      window.removeEventListener('pc:comment-deleted-ok', onOk as EventListener);
      window.removeEventListener('pc:comment-deleted-rollback', onRollback as EventListener);
    };
  }, [replies]);

  // Listen for new reply creation to append to loaded replies (when fully loaded)
  React.useEffect(() => {
    const onCreated = (e: Event) => {
      const custom = e as CustomEvent<{ comment: ForumPostComment }>;
      const created = custom.detail?.comment;
      if (!created) return;
      // Only handle replies to this comment
      if (created.replyTo !== comment.id) return;
      // Only append if replies have been loaded and there is no further page
      if (replies === null) return;
      if (repliesNextUrl) return;
      // Dedupe and keep ascending order by createdAt
      setReplies(prev => {
        if (!prev) return prev;
        if (prev.some(r => r.id === created.id)) return prev;
        const next = [...prev, created];
        next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return next;
      });
    };
    window.addEventListener('pc:comment-created', onCreated as EventListener);
    return () => window.removeEventListener('pc:comment-created', onCreated as EventListener);
  }, [replies, repliesNextUrl, comment.id]);

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        "py-2"
      )}
    >
      <div className="flex items-start gap-3">
        {/* 头像 / Avatar */}
        <div className="flex-shrink-0">
          {comment.author.avatar ? (
            <img
              src={comment.author.avatar}
              alt={comment.author.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {comment.author.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* 评论内容 / Comment content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm text-foreground">
              {comment.isAnonymous
                ? (currentUserId && comment.author.id === currentUserId
                    ? `${comment.author.name} (${t('common.anonymous')})`
                    : t('common.anonymous'))
                : comment.author.name}
              {currentUserId && comment.author.id === currentUserId && (
                <span className="text-muted-foreground"> ({t('common.me')})</span>
              )}
            </span>
            <ClientOnlyTime dateString={comment.createdAt} className="text-xs text-muted-foreground" />
          </div>

          {/* Parent snippet under meta */}
          {isReply && parentComment && (
            <div
              role="button"
              onClick={onClickParent}
              className="mb-2 text-xs text-muted-foreground hover:text-foreground/80 cursor-pointer flex items-center gap-1 whitespace-nowrap overflow-hidden"
              title={parentComment.isDeleted ? t('comment.deleted') : stripHtmlTags(parentComment.content)}
            >
              <span className="font-medium flex-shrink-0">
                {t('comment.repliesTo', {
                  name: parentComment.isAnonymous
                    ? (currentUserId && parentComment.author.id === currentUserId
                        ? `${parentComment.author.name} (${t('common.anonymous')})`
                        : t('common.anonymous'))
                    : parentComment.author.name
                })}
                {currentUserId && parentComment.author.id === currentUserId && (
                  <span className="text-muted-foreground"> ({t('common.me')})</span>
                )}:
              </span>
              <span className="min-w-0 truncate">
                {parentComment.isDeleted ? t('comment.deleted') : stripHtmlTags(parentComment.content)}
              </span>
            </div>
          )}

          {comment.isDeleted ? (
            <div className={cn(
              "text-muted-foreground text-sm italic py-2"
            )}>
              {t('comment.deleted')}
            </div>
          ) : (
            <div
              className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed mb-2 break-words overflow-wrap-anywhere"
              dangerouslySetInnerHTML={{
                __html: isTranslated
                  ? sanitizeHtml(t('post.translateUnavailable'))
                  : sanitizeHtml(comment.content)
              }}
            />
          )}

          {/* 操作按钮 / Actions */}
          <div className="flex items-center gap-1 flex-wrap">

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={cn(
                "h-7 px-2 text-xs min-w-0",
                comment.isLiked && "text-red-500 hover:text-red-600",
                comment.isDeleted && "text-muted-foreground hover:text-muted-foreground cursor-not-allowed opacity-60"
              )}
              disabled={comment.isDeleted}
            >
              <Heart className={cn(
                "w-3 h-3 mr-1 flex-shrink-0",
                comment.isLiked && "fill-current"
              )} />
              <span className="truncate">{comment.likes > 0 && comment.likes}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReply}
              className={cn(
                "h-7 px-2 text-xs min-w-0",
                comment.isDeleted && "text-muted-foreground hover:text-muted-foreground cursor-not-allowed opacity-60"
              )}
              disabled={comment.isDeleted}
            >
              <Reply className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="hidden sm:inline">{t('comment.reply')}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslate}
              className={cn(
                "h-7 px-2 text-xs min-w-0",
                isTranslated ? "text-blue-500 hover:text-blue-600" : "text-gray-500 hover:text-gray-600",
                comment.isDeleted && "text-muted-foreground hover:text-muted-foreground cursor-not-allowed opacity-60"
              )}
              disabled={comment.isDeleted}
            >
              <Languages className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="hidden sm:inline">{isTranslated ? t('comment.showOriginal') : t('comment.translate')}</span>
            </Button>

            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs transition-colors min-w-0",
                    isCopySuccess && "text-green-500 hover:text-green-600",
                    comment.isDeleted && "text-muted-foreground hover:text-muted-foreground cursor-not-allowed opacity-60"
                  )}
                  disabled={comment.isDeleted}
                >
                  {isCopySuccess ? (
                    <Check className="w-3 h-3 mr-1 flex-shrink-0" />
                  ) : (
                    <MoreHorizontal className="w-3 h-3 mr-1 flex-shrink-0" />
                  )}
                  <span className="hidden sm:inline">{isCopySuccess ? t('comment.copied') : t('comment.more')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={handleCopyText}
                  className="cursor-pointer"
                >
                  <FileText className="w-3 h-3 mr-2" />
                  <span className="text-xs">{t('comment.copyText')}</span>
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    disabled={isDeleting || comment.isDeleted}
                    className={cn(
                      "cursor-pointer",
                      comment.isDeleted ? "text-muted-foreground cursor-not-allowed opacity-60" : "text-destructive focus:text-destructive"
                    )}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    <span className="text-xs">{isDeleting ? t('comment.deleting') : t('comment.delete')}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          {/* 展开回复 & 预览回复项放在操作按钮下方 / Dropdown menu for replies & preview replies are placed below the actions */}
          {repliesCount > 0 && (
            <div className="mt-2 space-y-1">
              {!isRepliesOpen ? (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    setIsRepliesOpen(true);
                    fetchRepliesIfNeeded();
                  }}
                >
                  {t('comment.showReplies', { count: repliesCount })}
                </button>
              ) : (
                <>
                  {isRepliesLoading && (
                    <div className="text-xs text-muted-foreground">{t('comment.loadingReplies')}</div>
                  )}
                  {repliesError && (
                    <div className="text-xs text-red-600">{t('comment.loadRepliesFailed')}</div>
                  )}
                  {!isRepliesLoading && !repliesError && replies && replies.length > 0 && (
                    <div className="space-y-1">
                      {replies.map((r) => (
                        <button
                          key={r.id}
                          className="flex items-baseline gap-1 w-full text-left text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('pc:jump-to-comment', { detail: { id: r.id } }));
                          }}
                          title={r.isDeleted ? t('comment.deleted') : stripHtmlTags(r.content)}
                        >
                          <span className="font-medium flex-shrink-0">
                            {r.isAnonymous
                              ? (currentUserId && r.author.id === currentUserId
                                  ? `${r.author.name} (${t('common.anonymous')})`
                                  : t('common.anonymous'))
                              : r.author.name}
                            {currentUserId && r.author.id === currentUserId && (
                              <span className="text-muted-foreground"> ({t('common.me')})</span>
                            )}:
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {r.isDeleted ? t('comment.deleted') : truncateHtmlContent(r.content, 80)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {(() => {
                      const loaded = replies?.length ?? 0;
                      const total = typeof comment.replies === 'number' ? comment.replies : 0;
                      const remaining = Math.max(total - loaded, 0);
                      return remaining > 0 && repliesNextUrl ? (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          onClick={loadRemainingReplies}
                        >
                          {t('comment.loadRemaining', { count: remaining })}
                        </button>
                      ) : null;
                    })()}
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      onClick={() => setIsRepliesOpen(false)}
                    >
                      {t('comment.hideReplies')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 / Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('comment.deleteConfirm.title')}</DialogTitle>
            <DialogDescription>
              {t('comment.deleteConfirm.message')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
            >
              {t('comment.deleteConfirm.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? t('comment.deleting') : t('comment.deleteConfirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
