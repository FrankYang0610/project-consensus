"use client";

import * as React from "react";
import { Heart, Reply, MoreHorizontal, Trash2, Languages, Share2, FileText, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useI18n } from "@/hooks/useI18n";
import { sanitizeHtml } from "@/lib/html-utils";
import { cn } from "@/lib/utils";
import type { ForumPostComment } from "@/types/forum";

import ClientOnlyTime from "./ClientOnlyTime";
import { useApp } from "@/contexts/AppContext";

interface ForumPostCommentCardProps {
  comment: ForumPostComment;
  onLike?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onShare?: (commentId: string) => void;
  isSubComment?: boolean;
  currentUserId?: string;
}

export function ForumPostCommentCard({
  comment,
  onLike,
  onReply,
  onDelete,
  onShare,
  isSubComment = false,
  currentUserId
}: ForumPostCommentCardProps) {
  const { t, language } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isTranslated, setIsTranslated] = React.useState(false);
  const [isCopySuccess, setIsCopySuccess] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);


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

  const handleDelete = async () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
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

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onShare?.(comment.id);
  };

  const handleCopyText = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const textToCopy = `${comment.content}\n\n- ${comment.author.name}`;
      await navigator.clipboard.writeText(textToCopy);
      setIsCopySuccess(true);
      setIsDropdownOpen(false);
      setTimeout(() => {
        setIsCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const canDelete = currentUserId && currentUserId.trim() && currentUserId === comment.author.id;

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
      "py-2",
      isSubComment && "ml-2 sm:ml-6 border-l-2 border-muted/50 pl-2 sm:pl-3"
    )}>
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
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {comment.author.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* 评论内容 / Comment content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm text-foreground">
              {comment.author.name}
            </span>
            {comment.replyToUser && (
              <span className="text-xs text-muted-foreground">
                {t('comment.replyTo')} {comment.replyToUser.name}
              </span>
            )}
            <ClientOnlyTime dateString={comment.createdAt} className="text-xs text-muted-foreground" />
          </div>

          <div
            className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed mb-2 break-words overflow-wrap-anywhere"
            dangerouslySetInnerHTML={{
              __html: isTranslated
                ? sanitizeHtml(t('post.translateUnavailable'))
                : sanitizeHtml(comment.content)
            }}
          />

          {/* 操作按钮 / Actions */}
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={cn(
                "h-7 px-2 text-xs min-w-0",
                comment.isLiked && "text-red-500 hover:text-red-600"
              )}
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
              className="h-7 px-2 text-xs min-w-0"
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
                isTranslated ? "text-blue-500 hover:text-blue-600" : "text-gray-500 hover:text-gray-600"
              )}
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
                    isCopySuccess && "text-green-500 hover:text-green-600"
                  )}
                >
                  {isCopySuccess ? (
                    <Check className="w-3 h-3 mr-1 flex-shrink-0" />
                  ) : (
                    <Share2 className="w-3 h-3 mr-1 flex-shrink-0" />
                  )}
                  <span className="hidden sm:inline">{isCopySuccess ? t('comment.copied') : t('comment.share')}</span>
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
              </DropdownMenuContent>
            </DropdownMenu>

            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive min-w-0"
              >
                <Trash2 className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="hidden sm:inline">{isDeleting ? t('comment.deleting') : t('comment.delete')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
