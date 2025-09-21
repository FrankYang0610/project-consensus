"use client";

import * as React from "react";
import { ForumPostComment } from "@/types/forum";
import { ForumPostComment as ForumPostCommentComponent } from "./ForumPostComment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { getSeparatedCommentsByPostId, getSubCommentsByMainCommentId } from "@/data/sampleComments";

interface ForumPostCommentListProps {
  onLike?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onAddComment?: () => void;
  currentUserId?: string;
  postId: string;
}

export function ForumPostCommentList({
  onLike,
  onReply,
  onDelete,
  onAddComment,
  currentUserId,
  postId
}: ForumPostCommentListProps) {
  const { t } = useI18n();
  const [showAllComments, setShowAllComments] = React.useState(false);
  const [expandedMainComments, setExpandedMainComments] = React.useState<Set<string>>(new Set());

  // 获取分离后的评论数据
  const { mainComments, subComments } = React.useMemo(() => {
    return getSeparatedCommentsByPostId(postId);
  }, [postId]);

  // 按点赞数排序主评论
  const sortedMainComments = React.useMemo(() => {
    return [...mainComments].sort((a, b) => b.likes - a.likes);
  }, [mainComments]);

  // 计算总评论数
  const totalComments = mainComments.length + subComments.length;

  // 获取主评论的子评论
  const getSubCommentsForMainComment = (mainCommentId: string) => {
    return getSubCommentsByMainCommentId(mainCommentId, subComments);
  };

  // 切换主评论的展开状态
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

  const displayedMainComments = showAllComments ? sortedMainComments : sortedMainComments.slice(0, 3);
  const hiddenMainComments = sortedMainComments.length - displayedMainComments.length;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5" />
            {t('comment.title', { count: totalComments })}
          </CardTitle>
          {onAddComment && (
            <Button
              onClick={onAddComment}
              size="sm"
              className="h-7"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('comment.addComment')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {displayedMainComments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t('comment.noComments')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedMainComments.map((mainComment) => {
              const subCommentsForMain = getSubCommentsForMainComment(mainComment.id);
              const isExpanded = expandedMainComments.has(mainComment.id);

              return (
                <div key={mainComment.id} className="space-y-2">
                  {/* 主评论 / Main comments */}
                  <ForumPostCommentComponent
                    comment={mainComment}
                    onLike={onLike}
                    onReply={onReply}
                    onDelete={onDelete}
                    currentUserId={currentUserId}
                  />

                  {/* 子评论 / Sub-comments */}
                  {subCommentsForMain.length > 0 && (
                    <div className="ml-4 space-y-1">
                      {isExpanded ? (
                        subCommentsForMain.map((subComment) => (
                          <ForumPostCommentComponent
                            key={subComment.id}
                            comment={subComment}
                            onLike={onLike}
                            onReply={onReply}
                            onDelete={onDelete}
                            isSubComment={true}
                            currentUserId={currentUserId}
                          />
                        ))
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMainCommentExpansion(mainComment.id)}
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t('comment.showReplies', { count: subCommentsForMain.length })}
                        </Button>
                      )}

                      {isExpanded && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMainCommentExpansion(mainComment.id)}
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t('comment.hideReplies')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {hiddenMainComments > 0 && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAllComments(!showAllComments)}
                  className="h-7"
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
      </CardContent>
    </Card>
  );
}
