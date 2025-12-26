"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  ThumbsUp,
  BookOpen,
} from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { clamp, formatTerm, formatDateDisplay, validateRating } from "@/lib/course-utils";
import { sanitizeHtml, stripHtmlTags } from "@/lib/html-utils";
import type { CourseReview } from "@/types";

/**
 * Props for CourseReviewPreviewCard component
 * Simplified review card specifically designed for the latest reviews page
 */
export interface CourseReviewPreviewCardProps {
  review: CourseReview;
  onLike?: (reviewId: string) => void; // Like callback
  className?: string;
  /**
   * Compact meta layout for homepage carousel:
   * hide avatar, author name and date, only show term + rating.
   */
  compactMeta?: boolean;
}

/**
 * User avatar component with fallback to single initial
 */
function UserAvatar({ name, avatarUrl, userId, isAnonymous }: { name: string; avatarUrl?: string; userId?: string; isAnonymous?: boolean }) {
  const initials = React.useMemo(() => {
    if (!name || typeof name !== 'string') return '?';
    const trimmedName = name.trim();
    if (!trimmedName) return '?';
    return trimmedName[0]?.toUpperCase() || "?";
  }, [name]);

  const avatarContent = (
    <div className={cn(
      "h-8 w-8 rounded-full bg-muted inline-flex items-center justify-center overflow-hidden shrink-0",
      !isAnonymous && "transition-transform duration-200 group-hover:scale-105"
    )}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs text-muted-foreground font-medium">{initials}</span>
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
      onClick={(e) => e.stopPropagation()}
    >
      {avatarContent}
    </Link>
  );
}

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
          <div key={index} className="relative w-3.5 h-3.5" aria-hidden>
            <Star className="absolute inset-0 w-3.5 h-3.5 text-muted-foreground/60" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
              <Star className="w-3.5 h-3.5 text-yellow-500" />
            </div>
          </div>
        );
      }),
    [score5]
  );

  return <div className="flex items-center gap-0.5" aria-label={`rating-${safeScore}`}>{stars}</div>;
});

StarRating.displayName = 'StarRating';

/**
 * Attribute display component for course attributes (compact version)
 */
const AttributeItem = React.memo(({ label, value }: { label: string; value: string }) => {
  return (
    <div className="text-center px-2 py-1.5 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors">
      <div className="text-xs text-muted-foreground mb-0.5">
        {label || 'Unknown'}
      </div>
      <div className="font-semibold text-xs">
        {value || 'N/A'}
      </div>
    </div>
  );
});

AttributeItem.displayName = 'AttributeItem';

/**
 * CourseReviewPreviewCard component - specifically designed for the latest reviews page
 * Simplified design with clickable card that navigates to specific review in course details
 */
export function CourseReviewPreviewCard({
  review,
  onLike,
  className,
  compactMeta = false,
}: CourseReviewPreviewCardProps) {
  const { t, language } = useI18n();
  const router = useRouter();
  const { user, isLoggedIn, openLoginModal } = useApp();
  const imagePlaceholder = t("courses.review.imagePlaceholder");

  // Handle like action (prevent event bubbling)
  const handleLike = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }

    onLike?.(review.id);
  }, [isLoggedIn, openLoginModal, onLike, review.id]);

  // Format dates with memoization for performance
  const createdAtFormatted = React.useMemo(() =>
    formatDateDisplay(review.createdAt, language),
    [review.createdAt, language]
  );

  const updatedAtFormatted = React.useMemo(() =>
    review.updatedAt ? formatDateDisplay(review.updatedAt, language) : null,
    [review.updatedAt, language]
  );

  // Memoize term formatting
  const termElement = React.useMemo(() =>
    review.term ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground text-xs">
        {formatTerm(review.term.year, review.term.semester, t, language)}
      </span>
    ) : null,
    [review.term, t, language]
  );

  // Derive display author name considering anonymity rules
  const isOwner = user?.id && review?.author?.id && String(user.id) === String(review.author.id);
  const displayName = React.useMemo(() => {
    if (!review?.author?.name) return 'Unknown';
    if (review.isAnonymous) {
      if (!review.author.id) {
        return t('common.anonymous') || 'Anonymous';
      }
      if (isOwner) {
        return t('common.anonymousWithId', { name: String(review.author.name || '') }) || `Anonymous (${String(review.author.name || '')})`;
      }
    }
    return review.author.name;
  }, [review.isAnonymous, review.author?.id, review.author?.name, isOwner, t]);

  // Sanitize review content and replace <img> tags with a localized text placeholder
  const reviewContentHtml = React.useMemo(() => {
    const sanitized = sanitizeHtml(review.content || "");
    // strip any HTML from the placeholder,
    // so translations are always treated as plain text.
    const safePlaceholder = stripHtmlTags(imagePlaceholder || "");
    // Replace any <img ...> tag with a simple span containing localized placeholder text
    return sanitized.replace(/<img\b[^>]*>/gi, `<span>${safePlaceholder}</span>`);
  }, [review.content, imagePlaceholder]);

  // Validation
  if (!review?.id || !review?.author?.name) {
    console.warn('Invalid review data provided:', review);
    return null;
  }

  // Course information
  const courseDisplayName = review.courseSubjectCode && review.courseTitle
    ? `${review.courseSubjectCode} ${review.courseTitle}`
    : review.courseSubjectCode || review.courseTitle || t('courses.latestReviews.course');

  // Navigation URL
  const reviewUrl = `/courses/${review.courseId}#review-${review.id}`;

  // Keyboard support for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(reviewUrl);
    }
  };

  return (
      <Card
        role="link"
        tabIndex={0}
        onClick={() => router.push(reviewUrl)}
        onKeyDown={handleKeyDown}
        className={cn(
          "overflow-hidden border-muted/30 shadow-sm hover:shadow-md transition-all duration-200 bg-background/50 backdrop-blur-sm cursor-pointer group",
          "hover:border-primary/30",
          "py-5",
          className
        )}
      >
        <CardContent className="space-y-3 px-4">
          {/* Course information header */}
          <div
            className={cn(
              "flex items-center gap-3",
              !compactMeta && "pb-3 border-b border-muted/30"
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {courseDisplayName}
                </h3>
              </div>
            </div>
          </div>

          {/* Author information and rating */}
          <div className="flex items-start justify-between gap-3">
            {compactMeta ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap min-w-0 flex-1">
                {termElement}
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-1 group/author">
                <UserAvatar 
                  name={displayName} 
                  avatarUrl={review.author.avatarUrl}
                  userId={review.author.id}
                  isAnonymous={review.isAnonymous}
                />
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  {review.isAnonymous ? (
                    <div className="font-medium text-sm truncate">{displayName}</div>
                  ) : (
                    <Link
                      href={`/user/${review.author.id}`}
                      className="font-medium text-sm group-hover/author:text-primary group-hover/author:underline underline-offset-2 transition-colors truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {displayName}
                    </Link>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="shrink-0">
                      {review.isEdited && updatedAtFormatted
                        ? t("courses.review.updatedAt", { date: updatedAtFormatted })
                        : t("courses.review.createdAt", { date: createdAtFormatted })
                      }
                    </span>
                    {termElement && (
                      <>
                        <span>•</span>
                        {termElement}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Rating display */}
            {!review.onlyText && review.overallRating !== undefined && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <StarRating score10={review.overallRating} />
                <span className="text-sm font-bold text-foreground">
                  {validateRating(review.overallRating).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Four evaluation attributes */}
          {!review.onlyText && review.attributes && (
            <div className="grid grid-cols-4 gap-2">
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
          )}

          {/* Review content preview + like button on the right (hidden in compact mode) */}
          <div className="rounded-md bg-muted/20 border border-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: reviewContentHtml }}
                />
              </div>
              {!compactMeta && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-1.5 h-8 px-2 shrink-0",
                    review.isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={handleLike}
                >
                  <ThumbsUp className={cn("w-3.5 h-3.5", review.isLiked && "fill-current")} />
                  <span className="text-xs font-medium">{review.likesCount}</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
  );
}

export default CourseReviewPreviewCard;
