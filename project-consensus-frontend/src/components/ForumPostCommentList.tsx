"use client";

import * as React from "react";
import { ForumPostComment } from "@/types/forum";
import { ForumPostCommentCard as ForumPostCommentComponent } from "./ForumPostCommentCard";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { apiGet } from "@/lib/utils";
import { ListCommentsResponse } from "@/types/api";
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
 * 用于显示帖子的所有评论，支持主评论和子评论的层级结构
 * 
 * Forum Post Comment List Component
 * Displays all comments for a post with support for main comments and sub-comments hierarchy
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
  
  // 控制主评论展开状态的状态 / State to control expanded state of main comments
  const [expandedMainComments, setExpandedMainComments] = React.useState<Set<string>>(new Set());
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);

  // 主评论：服务端分页 / Main comments with server pagination
  const [mainComments, setMainComments] = React.useState<ForumPostComment[]>([]);
  const [mainNextUrl, setMainNextUrl] = React.useState<string | null>(`/api/forum/comments/?postId=${postId}&isMain=1&page=1&page_size=12`);

  // 子评论缓存 / Replies cache per main comment
  const [subCommentsMap, setSubCommentsMap] = React.useState<Record<string, ForumPostComment[]>>({});

  // Reset when postId changes
  React.useEffect(() => {
    setMainComments([]);
    setMainNextUrl(`/api/forum/comments/?postId=${postId}&isMain=1&page=1&page_size=12`);
    setSubCommentsMap({});
    setExpandedMainComments(new Set());
  }, [postId]);

  const fetchMoreMain = React.useCallback(async () => {
    if (!mainNextUrl || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await apiGet<ListCommentsResponse>(mainNextUrl);
      setMainComments(prev => {
        const existing = new Set(prev.map(c => c.id));
        const deduped = data.results.filter(c => !existing.has(c.id));
        return [...prev, ...deduped];
      });
      setMainNextUrl(data.next ? new URL(data.next).pathname + new URL(data.next).search : null);
    } catch (e) {
      console.error(e);
    } finally {
      loadingRef.current = false;
    }
  }, [mainNextUrl]);

  // 初次加载主评论 / Initial load of main comments
  React.useEffect(() => {
    if (mainComments.length === 0 && mainNextUrl) {
      fetchMoreMain();
    }
  }, [mainComments.length, mainNextUrl, fetchMoreMain]);

  // 按点赞数排序主评论 / Sort main comments by like count
  const sortedMainComments = React.useMemo(() => {
    return [...mainComments].sort((a, b) => b.likes - a.likes);
  }, [mainComments]);

  // 总评论数（从 parent 组件传入或根据已加载数据估算）/ Total comments count
  const totalComments = totalCount ?? (mainComments.length + Object.values(subCommentsMap).reduce((acc, arr) => acc + arr.length, 0));

  /**
   * 获取主评论的子评论
   */
  const getSubCommentsForMainComment = (mainCommentId: string) => {
    return subCommentsMap[mainCommentId] ?? [];
  };

  /**
   * 切换主评论的展开状态并按需加载子评论
   */
  const toggleMainCommentExpansion = (mainCommentId: string) => {
    setExpandedMainComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mainCommentId)) {
        newSet.delete(mainCommentId);
      } else {
        newSet.add(mainCommentId);
      }
      return newSet;
    });
    // 懒加载该主评论的子评论 / Lazy-load replies for this main comment
    if (!subCommentsMap[mainCommentId]) {
      apiGet<ListCommentsResponse>(`/api/forum/comments/?parentId=${mainCommentId}&page=1&page_size=100`)
        .then(data => {
          setSubCommentsMap(prev => ({ ...prev, [mainCommentId]: data.results }));
        })
        .catch(e => console.error(e));
    }
  };

  // 计算要显示的主评论（服务端分页后即为已加载的所有主评论）
  const displayedMainComments = sortedMainComments;

  // 还有更多可加载的主评论？ / Whether more pages exist
  const hiddenMainComments = mainNextUrl ? 1 : 0;

  React.useEffect(() => {
    if (!loaderRef.current) return;
    const target = loaderRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hiddenMainComments > 0) {
          fetchMoreMain();
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hiddenMainComments, fetchMoreMain]);

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
      {displayedMainComments.length === 0 ? (
        // 无评论时的空状态 / Empty state when no comments
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t('comment.noComments')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 遍历显示主评论 / Iterate through and display main comments */}
          {displayedMainComments.map((mainComment) => {
            const subCommentsForMain = getSubCommentsForMainComment(mainComment.id);
            const isExpanded = expandedMainComments.has(mainComment.id);

            return (
              <div key={mainComment.id} className="space-y-1">
                {/* 主评论组件 / Main comment component */}
                <ForumPostCommentComponent
                  comment={mainComment}
                  onLike={onLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  onShare={onShare}
                  currentUserId={currentUserId}
                />

                {/* 子评论区域 / Sub-comments area */}
                {subCommentsForMain.length > 0 && (
                  <div className="ml-1 sm:ml-2">
                    {isExpanded ? (
                      // 展开状态：显示所有子评论 / Expanded state: show all sub-comments
                      <div className="space-y-1">
                        {subCommentsForMain.map((subComment) => (
                          <ForumPostCommentComponent
                            key={subComment.id}
                            comment={subComment}
                            onLike={onLike}
                            onReply={onReply}
                            onDelete={onDelete}
                            onShare={onShare}
                            isSubComment={true}
                            currentUserId={currentUserId}
                          />
                        ))}
                        {/* 展开状态下的收起按钮 / Collapse button when expanded */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMainCommentExpansion(mainComment.id)}
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground ml-4 sm:ml-6"
                        >
                          {t('comment.hideReplies')}
                        </Button>
                      </div>
                    ) : (
                      // 折叠状态：显示展开按钮 / Collapsed state: show expand button
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMainCommentExpansion(mainComment.id)}
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground ml-4 sm:ml-6"
                      >
                        {t('comment.showReplies', { count: subCommentsForMain.length })}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div className="text-center pt-2">
            <div ref={loaderRef} className="h-6 w-full" aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}
