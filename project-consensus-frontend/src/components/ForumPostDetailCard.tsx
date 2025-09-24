"use client";

import * as React from "react";
import {
  Calendar,
  Heart,
  Share2,
  Languages,
  FileText,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
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

import { useI18n } from "@/hooks/useI18n";
import { sanitizeHtml } from "@/lib/html-utils";
import { cn } from "@/lib/utils";
import { ForumPost } from "@/types";

import ClientOnlyTime from "./ClientOnlyTime";

/**
 * 论坛帖子详情卡片组件属性 / Forum post detail card component props
 */
export interface ForumPostDetailCardProps {
  post: ForumPost; // 帖子数据 / Post data
  onLike?: (postId: string) => void; // 点赞回调函数（可选） / Like callback function (optional)
  onShare?: (postId: string) => void; // 分享回调函数（可选） / Share callback function (optional)
  onTranslate?: (postId: string) => void; // 翻译回调函数（可选） / Translate callback function (optional)
  onAuthorClick?: (authorId: string) => void; // 作者点击回调函数（可选） / Author click callback function (optional)
  className?: string; // 自定义CSS类名（可选） / Custom CSS class name (optional)
}

export function ForumPostDetailCard({
  post,
  onLike,
  onShare,
  onTranslate,
  onAuthorClick,
  className,
}: ForumPostDetailCardProps) {
  // i18n translation
  const { t, language } = useI18n();

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
    onLike?.(post.id);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogTitle("Error");
    setDialogMessage(t('post.shareUnavailable'));
    setShowDialog(true);
    onShare?.(post.id);
  };

  const handleCopyText = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const textToCopy = `${post.title}\n\n${post.content}\n\n- ${post.author.name}`;
      await navigator.clipboard.writeText(textToCopy);
      setIsCopySuccess(true);
      setIsDropdownOpen(false); // Close dropdown after copying
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

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAuthorClick?.(post.author.id);
  };

  return (
    <Card className={cn("w-full !gap-4 pb-5", className)}>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              {post.author.avatar ? (
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-sm"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-sm ring-2 ring-zinc-200 dark:ring-zinc-800">
                  <span className="text-white text-xs font-semibold">
                    {post.author.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <button
                onClick={handleAuthorClick}
                className="text-sm font-medium text-left hover:text-primary transition-colors"
              >
                {post.author.name}
              </button>
              <ClientOnlyTime dateString={post.createdAt} />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-0 -mt-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold line-clamp-2 flex-1">
            {isTranslated ? t('post.translateUnavailable') : post.title}
          </h1>
          <span className="ml-2 px-1.5 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
            {post.language}
          </span>
        </div>

        <div
          className="prose prose-zinc dark:prose-invert max-w-none mb-2 text-[0.9rem] leading-5 break-words overflow-wrap-anywhere"
          dangerouslySetInnerHTML={{
            __html: isTranslated
              ? t('post.translateUnavailable')
              : sanitizeHtml(post.content)
          }}
        />

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLikeClick}
              className={cn(
                "flex items-center space-x-1 h-8 px-2",
                isLiked && "text-red-500 hover:text-red-600"
              )}
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
              <span className="text-sm">{likesCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslateClick}
              className={cn(
                "flex items-center space-x-1 h-8 px-2",
                isTranslated
                  ? "text-blue-500 hover:text-blue-600"
                  : "text-gray-500 hover:text-gray-600"
              )}
            >
              <Languages className="w-4 h-4" />
              <span className="text-sm">
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
                  "flex items-center space-x-1 h-8 px-2 transition-colors",
                  isCopySuccess && "text-green-500 hover:text-green-600"
                )}
              >
                {isCopySuccess ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {isCopySuccess ? t('post.copied') : t('post.share')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleCopyText}
                className="cursor-pointer"
              >
                <FileText className="w-4 h-4 mr-2" />
                <span>{t('post.copyText')}</span>
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

export default ForumPostDetailCard;
