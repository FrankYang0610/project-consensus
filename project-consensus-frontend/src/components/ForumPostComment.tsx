"use client";

import * as React from "react";
import type { ForumPostComment } from "@/types/forum";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Reply, MoreHorizontal, Trash2, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { sanitizeHtml } from "@/lib/html-utils";
import { formatTime } from "@/lib/time-utils";

interface ForumPostCommentProps {
  comment: ForumPostComment;
  onLike?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  isSubComment?: boolean;
  currentUserId?: string;
}

export function ForumPostComment({
  comment,
  onLike,
  onReply,
  onDelete,
  isSubComment = false,
  currentUserId
}: ForumPostCommentProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isTranslated, setIsTranslated] = React.useState(false);


  const handleLike = () => {
    if (onLike) {
      onLike(comment.id);
    }
  };

  const handleReply = () => {
    if (onReply) {
      onReply(comment.id);
    }
  };

  const handleDelete = async () => {
    if (onDelete && !isDeleting) {
      setIsDeleting(true);
      try {
        onDelete(comment.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleTranslate = async () => {
    setIsTranslated(prev => !prev);
  };

  const canDelete = currentUserId && currentUserId === comment.author.id;

  if (comment.isDeleted) {
    return (
      <div className={cn(
        "text-muted-foreground text-sm italic py-2",
        isSubComment && "ml-8"
      )}>
        {t('comment.deleted')}
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-2",
      isSubComment && "ml-6 border-l-2 border-muted pl-3"
    )}>
      <Card className={cn(
        "transition-all duration-200 hover:shadow-sm",
        isSubComment && "bg-muted/30 border-muted/50"
      )}>
        <CardContent className="px-3 py-1">
          <div className="flex items-start gap-2">
            {/* 头像 / Avatar */}
            <div className="flex-shrink-0">
              {comment.author.avatar ? (
                <img
                  src={comment.author.avatar}
                  alt={comment.author.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {comment.author.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* 评论内容 / Comment content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-foreground">
                  {comment.author.name}
                </span>
                {comment.replyToUser && (
                  <span className="text-xs text-muted-foreground">
                    {t('comment.replyTo')} {comment.replyToUser.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatTime(comment.createdAt, t)}
                </span>
              </div>

              <div
                className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed mb-2"
                dangerouslySetInnerHTML={{
                  __html: isTranslated
                    ? sanitizeHtml(t('post.translateUnavailable'))
                    : sanitizeHtml(comment.content)
                }}
              />

              {/* 操作按钮 / Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLike}
                  className={cn(
                    "h-7 px-1 text-xs",
                    comment.isLiked && "text-red-500 hover:text-red-600"
                  )}
                >
                  <Heart className={cn(
                    "w-3 h-3 mr-1",
                    comment.isLiked && "fill-current"
                  )} />
                  {comment.likes > 0 && comment.likes}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReply}
                  className="h-7 px-1 text-xs"
                >
                  <Reply className="w-3 h-3 mr-1" />
                  {t('comment.reply')}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTranslate}
                  className={cn(
                    "h-7 px-1 text-xs",
                    isTranslated ? "text-blue-500 hover:text-blue-600" : "text-gray-500 hover:text-gray-600"
                  )}
                >
                  <Languages className="w-3 h-3 mr-1" />
                  {isTranslated ? t('comment.showOriginal') : t('comment.translate')}
                </Button>

                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="h-7 px-1 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {isDeleting ? t('comment.deleting') : t('comment.delete')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
