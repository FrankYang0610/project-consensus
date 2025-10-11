"use client";

import * as React from "react";
import Link from "next/link";

import {
  Heart,
  MoreHorizontal,
  Languages,
  FileText,
  Check,
  MessageSquare,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { stripHtmlTags, truncateHtmlContent } from "@/lib/html-utils";
import { ForumPost } from "@/types";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { useRouter } from "next/navigation";

import ClientOnlyTime from "./ClientOnlyTime";

/**
 * 论坛帖子预览卡片组件属性 / Forum post preview card component props
 */
export interface ForumPostPreviewCardProps {
  post: ForumPost; // 帖子数据 / Post data
  onLike?: (postId: string) => void; // 点赞回调函数（可选） / Like callback function (optional)
  onTranslate?: (postId: string) => void; // 翻译回调函数（可选） / Translate callback function (optional)
  className?: string; // 自定义CSS类名（可选） / Custom CSS class name (optional)
  currentUserId?: string; // 当前用户ID（可选） / Current user ID (optional)
}

export function ForumPostPreviewCard({
  post,
  onLike,
  onTranslate,
  className,
  currentUserId,
}: ForumPostPreviewCardProps) {
  // i18n translation
  const { t } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();
  const router = useRouter();

  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogMessage, setDialogMessage] = React.useState("");
  const [dialogTitle, setDialogTitle] = React.useState("");
  // Controlled: derive from props
  const isLiked = post.isLiked || false;
  const likesCount = post.likes;
  const [isTranslated, setIsTranslated] = React.useState(false);
  const [isCopySuccess, setIsCopySuccess] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  const handleLikeClick = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    onLike?.(post.id);
  };


  const handleCopyText = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const plainTextContent = stripHtmlTags(post.content);
      const textToCopy = `${post.title}\n\n${plainTextContent}\n\n- ${post.author.name}`;
      await navigator.clipboard.writeText(textToCopy);
      setIsCopySuccess(true);
      setIsDropdownOpen(false); // Close dropdown after copying
      // Reset after 2 seconds
      setTimeout(() => {
        setIsCopySuccess(false);
      }, 2000);
    } catch (err) {
      setDialogTitle("Error");
      setDialogMessage(t('post.copyFailed'));
      setShowDialog(true);
    }
  };

  const handleTranslateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newIsTranslated = !isTranslated;
    setIsTranslated(newIsTranslated);
    onTranslate?.(post.id);
  };


  return (
    <Card
      className={cn(
        "hover:shadow-md transition-shadow duration-200 flex flex-col gap-2 py-3",
        className
      )}
    >
      <CardHeader className="pb-0 pt-0 px-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 group">
            <div className="relative">
              {post.isAnonymous ? (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">
                    {'?'}
                  </span>
                </div>
              ) : (
                <Link
                  href={`/user/${post.author.id}`}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  onClick={(e) => e.stopPropagation()}
                >
                  {post.author.avatar ? (
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="w-8 h-8 rounded-full object-cover transition-transform duration-200 group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/30"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ring-0 group-hover:ring-2 group-hover:ring-primary/30">
                      <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">
                        {post.author.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </Link>
              )}
            </div>
            <div className="flex flex-col">
              {post.isAnonymous ? (
                <span className="text-sm font-medium text-foreground">
                  {currentUserId && post.author.id === currentUserId
                    ? `${post.author.name} (${t('common.anonymous')})`
                    : t('common.anonymous')}
                  {currentUserId && post.author.id === currentUserId && (
                    <span className="text-muted-foreground"> ({t('common.me')})</span>
                  )}
                </span>
              ) : (
                <Link
                  href={`/user/${post.author.id}`}
                  className="text-sm font-medium text-left group-hover:text-primary group-hover:underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  onClick={(e) => e.stopPropagation()}
                >
                  {post.author.name}
                  {currentUserId && post.author.id === currentUserId && (
                    <span className="text-muted-foreground"> ({t('common.me')})</span>
                  )}
                </Link>
              )}
              <ClientOnlyTime dateString={post.createdAt} className="text-xs text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardHeader>

      <Link href={`/post/${post.id}`} className="block">
        <CardContent className="pt-0 pb-0 px-4 flex flex-col cursor-pointer gap-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold line-clamp-1 flex-1">
              {isTranslated ? t('post.translateUnavailable') : post.title}
            </h3>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed mb-1 break-words overflow-wrap-anywhere line-clamp-2 min-h-[3.25em]">
            {isTranslated ? t('post.translateUnavailable') : truncateHtmlContent(post.content)}
          </p>
        </CardContent>
      </Link>

      {post.tags.length > 0 && (
        <div className="px-4 mt-1">
          <div className="flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const params = new URLSearchParams();
                  params.append('tags', tag);
                  router.push(`/?${params.toString()}`);
                }}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                title={`#${tag}`}
                aria-label={`Filter by tag ${tag}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <CardFooter className="pt-0 px-4 mt-auto">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLikeClick}
              className={cn(
                "h-7 px-2 text-xs min-w-0",
                isLiked && "text-red-500 hover:text-red-600"
              )}
            >
              <Heart className={cn("w-3 h-3 mr-1 flex-shrink-0", isLiked && "fill-current")} />
              <span className="truncate">{likesCount}</span>
            </Button>

            <span
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-7 px-2 text-xs min-w-0 cursor-default select-none pointer-events-none"
              )}
              aria-label={t('comment.title', { count: post.comments })}
              role="status"
              tabIndex={-1}
            >
              <MessageSquare className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">{post.comments}</span>
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslateClick}
              className={cn(
                "h-7 px-2 text-xs min-w-0",
                isTranslated
                  ? "text-blue-500 hover:text-blue-600"
                  : "text-gray-500 hover:text-gray-600"
              )}
            >
              <Languages className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="hidden sm:inline">
                {isTranslated ? t('post.showOriginal') : t('post.translate')}
              </span>
            </Button>
          </div>

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
                  <MoreHorizontal className="w-3 h-3 mr-1 flex-shrink-0" />
                )}
                <span className="hidden sm:inline">{isCopySuccess ? t('post.copied') : t('post.more')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={handleCopyText}
                className="cursor-pointer"
              >
                <FileText className="w-3 h-3 mr-2" />
                <span className="text-xs">{t('post.copyText')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogMessage}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ForumPostPreviewCard;
