"use client";

import * as React from "react";
import { ForumPostComment } from "@/types/forum";
import { ForumPostCommentCard as ForumPostCommentComponent } from "./ForumPostCommentCard";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { getSeparatedCommentsByPostId, getSubCommentsByMainCommentId } from "@/data/sampleComments";

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
  onAddComment,
  currentUserId,
  postId
}: ForumPostCommentListProps) {
  const { t } = useI18n();
  
  // 控制是否显示所有评论的状态 / State to control whether to show all comments
  const [showAllComments, setShowAllComments] = React.useState(false);
  
  // 控制主评论展开状态的状态 / State to control expanded state of main comments
  const [expandedMainComments, setExpandedMainComments] = React.useState<Set<string>>(new Set());

  // 获取分离后的评论数据 / Get separated comment data
  const { mainComments, subComments } = React.useMemo(() => {
    return getSeparatedCommentsByPostId(postId);
  }, [postId]);

  // 按点赞数排序主评论 / Sort main comments by like count
  const sortedMainComments = React.useMemo(() => {
    return [...mainComments].sort((a, b) => b.likes - a.likes);
  }, [mainComments]);

  // 计算总评论数 / Calculate total comment count
  const totalComments = mainComments.length + subComments.length;

  /**
   * 获取主评论的子评论
   * Get sub-comments for a main comment
   * @param mainCommentId 主评论ID / Main comment ID
   * @returns 子评论数组 / Array of sub-comments
   */
  const getSubCommentsForMainComment = (mainCommentId: string) => {
    return getSubCommentsByMainCommentId(mainCommentId, subComments);
  };

  /**
   * 切换主评论的展开状态
   * Toggle expansion state of a main comment
   * @param mainCommentId 主评论ID / Main comment ID
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
  };

  // 计算要显示的主评论 / Calculate main comments to display
  const displayedMainComments = showAllComments ? sortedMainComments : sortedMainComments.slice(0, 3);
  
  // 计算隐藏的主评论数量 / Calculate number of hidden main comments
  const hiddenMainComments = sortedMainComments.length - displayedMainComments.length;

  return (
    <div className="mt-6">
      {/* 评论列表头部 / Comment list header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="w-5 h-5" />
          {t('comment.title', { count: totalComments })}
        </h3>
        {/* 添加评论按钮 / Add comment button */}
        {onAddComment && (
          <Button
            onClick={onAddComment}
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
                  currentUserId={currentUserId}
                />

                {/* 子评论区域 / Sub-comments area */}
                {subCommentsForMain.length > 0 && (
                  <div className="ml-2">
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
                            isSubComment={true}
                            currentUserId={currentUserId}
                          />
                        ))}
                        {/* 展开状态下的收起按钮 / Collapse button when expanded */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMainCommentExpansion(mainComment.id)}
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground ml-6"
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
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground ml-6"
                      >
                        {t('comment.showReplies', { count: subCommentsForMain.length })}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 显示更多/隐藏评论按钮 / Show more/hide comments button */}
          {hiddenMainComments > 0 && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAllComments(!showAllComments)}
                className="h-8"
              >
                {showAllComments
                  ? t('comment.hideAll')
                  : t('comment.showAll', { count: mainComments.length })
                }
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
