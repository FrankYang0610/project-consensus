"use client";

import * as React from "react";
import Link from "next/link";
import {
  Star,
  ThumbsUp,
  MessageSquare,
  Edit3,
  Calendar,
  Plus,
  Trash2,
  Info,
  Languages,
} from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { clamp, formatTerm, formatDateTimeDisplay, validateRating } from "@/lib/course-utils";
import { sanitizeHtml } from "@/lib/html-utils";
import { translateCourseReview } from "@/lib/api/course";
import { useTranslation } from "@/hooks/use-translation";
import type {
  CourseReview,
} from "@/types";

/**
 * 课程评价卡片组件属性 / Props for CourseReviewCard
 */
export interface CourseReviewCardProps {
  review: CourseReview;
  onLike?: (reviewId: string) => void; // Like callback
  onReply?: (reviewId: string) => void; // Reply callback (fallback when onToggleReplies not provided)
  onToggleReplies?: (reviewId: string, nextExpanded: boolean) => void; // Toggle replies expand/collapse
  repliesExpanded?: boolean; // Whether replies are expanded (optional, for display logic)
  onCreateReply?: (reviewId: string) => void; // Post reply callback
  onEdit?: (reviewId: string) => void; // Edit review callback
  onDelete?: (reviewId: string) => void; // Delete review callback
  className?: string;
  showRepliesSection?: boolean; // Whether to show replies section
}

/**
 * User avatar component with fallback to single initial
 */
function UserAvatar({ name, avatarUrl, userId, isAnonymous }: { name: string; avatarUrl?: string; userId?: string; isAnonymous?: boolean }) {
  const initials = React.useMemo(() => {
    if (!name || typeof name !== 'string') return '?';
    const trimmedName = name.trim();
    if (!trimmedName) return '?';

    // Use single letter initial (first character of name)
    return trimmedName[0]?.toUpperCase() || "?";
  }, [name]);

  const avatarContent = (
    <div className={cn(
      "h-10 w-10 rounded-full bg-muted inline-flex items-center justify-center overflow-hidden shrink-0",
      !isAnonymous && "transition-transform duration-200 group-hover:scale-105 ring-0 group-hover:ring-2 group-hover:ring-primary/30"
    )}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm text-muted-foreground font-medium">{initials}</span>
      )}
    </div>
  );

  // If anonymous or no userId, render non-clickable avatar
  if (isAnonymous || !userId) {
    return avatarContent;
  }

  // Otherwise, wrap in Link
  return (
    <Link
      href={`/user/${userId}`}
      className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {avatarContent}
    </Link>
  );
}

/**
 * Attribute display component for course attributes (matching CourseDetailCard style)
 * Memoized for performance
 */
const AttributeItem = React.memo(({ label, value }: { label: string; value: string }) => {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
      <div className="text-xs text-muted-foreground mb-2">
        {label || 'Unknown'}
      </div>
      <div className="font-semibold text-sm">
        {value || 'N/A'}
      </div>
    </div>
  );
});

AttributeItem.displayName = 'AttributeItem';

/**
 * Star rating component that maps 0-10 score to 0-5 star display
 */
const StarRating = React.memo(({ score10 }: { score10: number }) => {
  const safeScore = validateRating(score10);
  const score5 = safeScore / 2;

  const stars = React.useMemo(
    () =>
      Array.from({ length: 5 }).map((_, index) => {
        const fillPercent = clamp((score5 - index) * 100, 0, 100);
        return (
          <div key={index} className="relative w-4 h-4" aria-hidden>
            <Star className="absolute inset-0 w-4 h-4 text-muted-foreground/60" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
              <Star className="w-4 h-4 text-yellow-500" />
            </div>
          </div>
        );
      }),
    [score5]
  );

  return <div className="flex items-center gap-1" aria-label={`rating-${safeScore}`}>{stars}</div>;
});

StarRating.displayName = 'StarRating';

export function CourseReviewCard({
  review,
  onLike,
  onReply,
  onToggleReplies,
  repliesExpanded,
  onCreateReply,
  onEdit,
  onDelete,
  className,
  showRepliesSection = true,
}: CourseReviewCardProps) {
  const { t, language } = useI18n();
  const { user } = useApp();
  const { isTranslated, isTranslating, data: translatedReview, error: translateError, handleTranslate } = useTranslation(
    () => translateCourseReview(review.id, language),
    language,
  );

  // Handle like button click
  const handleLike = React.useCallback(() => {
    onLike?.(review.id);
  }, [onLike, review.id]);

  // Handle reply button click
  const handleReply = React.useCallback(() => {
    // Don't toggle if there are no replies to show
    if ((review.repliesCount ?? 0) === 0) {
      return;
    }
    if (onToggleReplies) {
      const next = !repliesExpanded;
      onToggleReplies(review.id, next);
    } else {
      onReply?.(review.id);
    }
  }, [onReply, onToggleReplies, repliesExpanded, review.id, review.repliesCount]);

  // Format dates with memoization for performance
  const createdAtFormatted = React.useMemo(() =>
    formatDateTimeDisplay(review.createdAt, language),
    [review.createdAt, language]
  );

  const updatedAtFormatted = React.useMemo(() =>
    review.updatedAt ? formatDateTimeDisplay(review.updatedAt, language) : null,
    [review.updatedAt, language]
  );

  // Memoize term formatting to avoid inline hook call
  const termElement = React.useMemo(() =>
    review.term ? (
      <>
        <span>•</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
          {formatTerm(review.term.year, review.term.semester, t, language)}
        </span>
      </>
    ) : null,
    [review.term, t, language]
  );

  // Derive display author name considering anonymity rules
  const isOwner = user?.id && review?.author?.id && String(user.id) === String(review.author.id);
  const displayName = React.useMemo(() => {
    if (!review?.author?.name) return 'Unknown';
    if (review.isAnonymous) {
      if (!review.author.id) {
        // Anonymous to others
        return t('common.anonymous') || 'Anonymous';
      }
      if (isOwner) {
        // Anonymous for self: show Anonymous plus (author name)
        return t('common.anonymousWithId', { name: String(review.author.name || '') }) || `Anonymous (${String(review.author.name || '')})`;
      }
    }
    return review.author.name;
  }, [review.isAnonymous, review.author?.id, review.author?.name, isOwner, t]);

  // Post-hooks validation to avoid breaking React hooks rules
  if (!review?.id || !review?.author?.name) {
    console.warn('Invalid review data provided:', review);
    return null;
  }

  return (
    <Card className={cn("overflow-hidden border-muted/30 shadow-none bg-background/50 backdrop-blur-sm gap-4 py-3", className)}>
      <CardContent className="space-y-4 px-6 pt-2 pb-4">
        {/* Header: Author Info and Rating in one row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0 group">
            <UserAvatar 
              name={displayName} 
              avatarUrl={review.author.avatarUrl}
              userId={review.author.id}
              isAnonymous={review.isAnonymous}
            />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              {review.isAnonymous ? (
                <div className="font-medium text-base">{displayName}</div>
              ) : (
                <Link
                  href={`/user/${review.author.id}`}
                  className="font-medium text-base group-hover:text-primary group-hover:underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 w-fit"
                >
                  {displayName}
                </Link>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="shrink-0">{createdAtFormatted}</span>
                {termElement}
              </div>
            </div>
          </div>
        </div>

        {/* Rating and Attributes in same row - only show when not onlyText */}
        {!review.onlyText && review.attributes && review.overallRating !== undefined && (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Overall Rating */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <StarRating score10={review.overallRating} />
              <span className="text-xl font-bold">{validateRating(review.overallRating).toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 10</span>
              <span className="text-sm text-muted-foreground">
                {t("courses.review.overallRating")}
              </span>
            </div>

            {/* Four Dimensions Rating - flex to take remaining space */}
            <div className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AttributeItem
                  label={t("courses.card.attributes.difficulty")}
                  value={t(`courses.card.adjectives.${review.attributes.difficulty}`)}
                />
                <AttributeItem
                  label={t("courses.card.attributes.workload")}
                  value={t(`courses.card.adjectives.${review.attributes.workload}`)}
                />
                <AttributeItem
                  label={t("courses.card.attributes.grading")}
                  value={t(`courses.card.adjectives.${review.attributes.grading}`)}
                />
                <AttributeItem
                  label={t("courses.card.attributes.gain")}
                  value={t(`courses.card.adjectives.${review.attributes.gain}`)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Review Content (rich text, sanitized) */}
        <div className="px-4 py-3 rounded-lg bg-muted/30 border">
          {isTranslated && translateError ? (
            <p className="text-red-500 text-sm">{t(translateError)}</p>
          ) : (
            <div
              className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: isTranslated && translatedReview?.content
                  ? sanitizeHtml(translatedReview.content)
                  : sanitizeHtml(review.content)
              }}
            />
          )}
        </div>

        {/* Actions and Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4">
            {/* Like Button */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 h-8 px-3",
                review.isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={handleLike}
            >
              <ThumbsUp className={cn("w-4 h-4", review.isLiked && "fill-current")} />
              <span className="text-sm">{review.likesCount}</span>
            </Button>

            {/* Reply Button */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 h-8 px-3 text-muted-foreground",
                (review.repliesCount ?? 0) > 0 ? "hover:text-foreground cursor-pointer" : "cursor-default opacity-60"
              )}
              onClick={handleReply}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">{t("courses.review.replies", { count: review.repliesCount ?? 0 })}</span>
            </Button>

            {/* Post Reply Button */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-8 px-3 text-muted-foreground hover:text-foreground"
              onClick={() => onCreateReply?.(review.id)}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">{t("comment.addComment")}</span>
            </Button>

            {/* Translate Button */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 h-8 px-3",
                isTranslated
                  ? "text-primary hover:text-primary/90"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={handleTranslate}
            >
              <Languages className={cn("w-4 h-4", isTranslating && "animate-pulse")} />
              <span className="text-sm">
                {isTranslating ? t("post.translating") : isTranslated ? t("comment.showOriginal") : t("comment.translate")}
              </span>
            </Button>

            {/* Owner actions: Edit / Delete */}
            {isOwner && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-8 px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit?.(review.id)}
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="text-sm">{t("courses.review.edit")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-8 px-3 text-destructive hover:text-destructive/90"
                  onClick={() => onDelete?.(review.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">{t("courses.review.delete")}</span>
                </Button>
              </>
            )}
          </div>

          {/* Time info: show both created and updated if edited */}
          {/* Mobile: Info button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="sm:hidden">
              <button className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors text-muted-foreground">
                <Info className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="center" className="p-3 space-y-1.5 min-w-[200px]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{t("courses.review.createdAt", { date: createdAtFormatted })}</span>
              </div>
              {review.isEdited && updatedAtFormatted && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span>{t("courses.review.updatedAt", { date: updatedAtFormatted })}</span>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Desktop: Full text */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>{t("courses.review.createdAt", { date: createdAtFormatted })}</span>
            {review.isEdited && updatedAtFormatted && (
              <>
                <span>•</span>
                <span>{t("courses.review.updatedAt", { date: updatedAtFormatted })}</span>
              </>
            )}
          </div>
        </div>

        {/* Replies Section Placeholder */}
        {showRepliesSection && (
          <div className="mt-4 pt-4 border-t border-muted/50">
            {/* This space is reserved for reply components */}
            <div className="text-xs text-muted-foreground italic text-center py-2">
              {t("courses.review.repliesSection")}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CourseReviewCard;
