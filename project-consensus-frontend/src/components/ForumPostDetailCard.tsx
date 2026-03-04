"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Heart,
  MoreHorizontal,
  Languages,
  FileText,
  Check,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

import { useI18n } from "@/hooks/use-i18n";
import { sanitizeHtml } from "@/lib/html-utils";
import { cn } from "@/lib/utils";
import { ForumPost } from "@/types";
import { useApp } from "@/contexts/AppContext";
import { updateForumPost, translateForumPost } from "@/lib/api/forum-post";
import { useTranslation } from "@/hooks/use-translation";
import { isContentEmpty } from "@/lib/utils";
import { TagManager } from "@/components/TagManager";
import { formatRelativeTime } from "@/lib/time-utils";

/**
 * 论坛帖子详情卡片组件属性 / Forum post detail card component props
 */
export interface ForumPostDetailCardProps {
  post: ForumPost; // 帖子数据 / Post data
  onLike?: (postId: string) => void; // 点赞回调函数（可选） / Like callback function (optional)
  onTranslate?: (postId: string) => void; // 翻译回调函数（可选） / Translate callback function (optional)
  onDelete?: (postId: string) => void; // 删除回调（可选） / Delete callback (optional)
  onUpdated?: (post: ForumPost) => void; // 更新回调（可选） / Update callback (optional)
  className?: string; // 自定义CSS类名（可选） / Custom CSS class name (optional)
}

// Dynamic import for client-only CKEditor component
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

export function ForumPostDetailCard({
  post,
  onLike,
  onTranslate,
  onDelete,
  onUpdated,
  className,
}: ForumPostDetailCardProps) {
  // i18n translation
  const { t, language } = useI18n();
  const { isLoggedIn, openLoginModal, user } = useApp();
  const router = useRouter();

  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogMessage, setDialogMessage] = React.useState("");
  const [dialogTitle, setDialogTitle] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  // Controlled: derive from props
  const isLiked = post.isLiked || false;
  const likesCount = post.likesCount;
  const { isTranslated, isTranslating, data: translatedPost, error: translateError, handleTranslate } = useTranslation(
    () => translateForumPost(post.id, language),
    language,
  );
  const [isCopySuccess, setIsCopySuccess] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  // Edit state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editContent, setEditContent] = React.useState("");
  const [editTags, setEditTags] = React.useState<string[]>([]);
  const [editIsAnonymous, setEditIsAnonymous] = React.useState<boolean>(post.isAnonymous ?? false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ title?: string; content?: string; }>(() => ({}));

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
    handleTranslate();
  };


  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete?.(post.id);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const beginEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropdownOpen(false);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditTags(post.tags || []);
    setEditIsAnonymous(Boolean(post.isAnonymous));
    setErrors({});
    setIsEditing(true);
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!editTitle.trim()) {
      next.title = t("post.validation.titleRequired");
    } else if (editTitle.trim().length < 5) {
      next.title = t("post.validation.titleTooShort");
    } else if (editTitle.trim().length > 200) {
      next.title = t("post.validation.titleTooLong");
    }
    if (isContentEmpty(editContent)) {
      next.content = t("post.validation.contentRequired");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setIsSaving(true);
      const updated = await updateForumPost(post.id, {
        title: editTitle.trim(),
        content: editContent,
        tags: editTags,
        isAnonymous: editIsAnonymous,
      });
      onUpdated?.(updated);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setDialogTitle("Error");
      setDialogMessage(t('common.loadFailedRetry'));
      setShowDialog(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <Card className={cn("w-full !gap-4 pb-5", className)}>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 group">
            <div className="relative">
              {post.isAnonymous ? (
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">
                    {'?'}
                  </span>
                </div>
              ) : (
                <Link
                  href={`/user/${post.author.id}`}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {post.author.avatar ? (
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="w-7 h-7 rounded-full object-cover transition-transform duration-200 group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/30"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ring-0 group-hover:ring-2 group-hover:ring-primary/30">
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
                  {user && post.author.id === user.id
                    ? `${post.author.name} (${t('common.anonymous')})`
                    : t('common.anonymous')}
                  {user && post.author.id === user.id && (
                    <span className="text-muted-foreground"> ({t('common.me')})</span>
                  )}
                </span>
              ) : (
                <Link
                  href={`/user/${post.author.id}`}
                  className="text-sm font-medium text-left group-hover:text-primary group-hover:underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {post.author.name}
                  {user && post.author.id === user.id && (
                    <span className="text-muted-foreground"> ({t('common.me')})</span>
                  )}
                </Link>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{t("post.createdAt", { date: formatRelativeTime(post.createdAt, t, language) })}</span>
                {post.isEdited && post.updatedAt && (
                  <>
                    <span>•</span>
                    <span>{t("post.updatedAt", { date: formatRelativeTime(post.updatedAt, t, language) })}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-0 -mt-1">
        {!isEditing ? (
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold line-clamp-2 flex-1">
              {isTranslated && !translateError && translatedPost?.title ? translatedPost.title : post.title}
            </h1>
          </div>
        ) : (
          <div className="mb-4 space-y-3">
            <Input
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value);
                if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
              }}
              placeholder={t('post.titlePlaceholder')}
              className={cn("h-11 text-lg font-normal px-4", errors.title && "border-red-500 focus:border-red-500")}
            />
            {errors.title && <p className="text-red-500 text-sm">{errors.title}</p>}
          </div>
        )}

        {!isEditing ? (
          isTranslated && translateError ? (
            <p className="text-red-500 text-sm mb-2">{t(translateError)}</p>
          ) : (
            <div
              className="prose prose-zinc dark:prose-invert max-w-none mb-2 text-[0.9rem] leading-5 break-words overflow-wrap-anywhere"
              dangerouslySetInnerHTML={{
                __html: isTranslated && translatedPost?.content
                  ? sanitizeHtml(translatedPost.content)
                  : sanitizeHtml(post.content)
              }}
            />
          )
        ) : (
          <div className="mb-4">
            <RichTextEditor
              value={editContent}
              onChange={(v) => {
                setEditContent(v);
                if (errors.content) setErrors(prev => ({ ...prev, content: undefined }));
              }}
              placeholder={t('post.contentPlaceholder')}
              className="prose max-w-none"
            />
            {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
          </div>
        )}

        {!isEditing ? (
          post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
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
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                  title={`#${tag}`}
                  aria-label={`Filter by tag ${tag}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="mt-1 mb-1">
            <TagManager tags={editTags} onTagsChange={setEditTags} maxTags={10} />
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

            {!isEditing && (
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
                <Languages className={cn("w-4 h-4", isTranslating && "animate-pulse")} />
                <span className="text-sm">
                  {isTranslating ? t('post.translating') : isTranslated ? t('post.showOriginal') : t('post.translate')}
                </span>
              </Button>
            )}
          </div>

          {!isEditing ? (
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
                    <MoreHorizontal className="w-4 h-4" />
                  )}
                  <span className="text-sm">
                    {isCopySuccess ? t('post.copied') : t('post.more')}
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
                {user && post.author.id === user.id && (
                  <>
                    <DropdownMenuItem onClick={beginEdit} className="cursor-pointer">
                      <FileText className="w-4 h-4 mr-2" />
                      <span>{t('post.edit')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDeleteClick}
                      className="cursor-pointer text-red-600 focus:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      <span>{t('post.delete')}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <Checkbox id="anonymous-edit" checked={editIsAnonymous} onCheckedChange={(v) => setEditIsAnonymous(Boolean(v))} />
                <Label htmlFor="anonymous-edit" className="text-sm cursor-pointer select-none">
                  {t('post.postAnonymously')}
                </Label>
              </div>
              <Button onClick={handleSave} disabled={isSaving} className="min-w-[90px]">
                {isSaving ? t('post.updating') : t('post.update')}
              </Button>
              <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                {t('post.cancel')}
              </Button>
            </div>
          )}
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

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('post.deleteConfirm.title')}</DialogTitle>
            <DialogDescription>{t('post.deleteConfirm.message')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
            >
              {t('post.deleteConfirm.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              {t('post.deleteConfirm.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ForumPostDetailCard;
