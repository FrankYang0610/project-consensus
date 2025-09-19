"use client";

import * as React from "react";
import {
    Star,
    ThumbsUp,
    Clock,
    MessageSquare,
    Edit3,
    Calendar
} from "lucide-react";

import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { clamp, formatTerm, formatDateDisplay, validateRating } from "@/lib/course-utils";
import type {
    CourseReview,
} from "@/types";

/**
 * 课程评价卡片组件属性 / Props for CourseReviewCard
 */
export interface CourseReviewCardProps {
    review: CourseReview;
    onLike?: (reviewId: string) => void; // 点赞回调 / Like callback
    onReply?: (reviewId: string) => void; // 回复回调 / Reply callback
    className?: string;
    showRepliesSection?: boolean; // 是否显示回复区域 / Whether to show replies section
}

/**
 * User avatar component with fallback to initials
 */
function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
    const initials = React.useMemo(() => {
        if (!name || typeof name !== 'string') return '?';
        const trimmedName = name.trim();
        if (!trimmedName) return '?';
        
        const parts = trimmedName.split(/\s+/).filter(Boolean);
        const initialsText = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
        return initialsText || trimmedName[0]?.toUpperCase() || "?";
    }, [name]);
    
    return (
        <div className="h-10 w-10 rounded-full bg-muted inline-flex items-center justify-center overflow-hidden shrink-0">
            {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
                <span className="text-sm text-muted-foreground font-medium">{initials}</span>
            )}
        </div>
    );
}

/**
 * Attribute display component for course attributes (matching CoursesDetailedCard style)
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
    className,
    showRepliesSection = true,
}: CourseReviewCardProps) {
    const { t, language } = useI18n();
    
    // Handle like button click
    const handleLike = React.useCallback(() => {
        onLike?.(review.id);
    }, [onLike, review.id]);
    
    // Handle reply button click
    const handleReply = React.useCallback(() => {
        onReply?.(review.id);
    }, [onReply, review.id]);
    
    // Format dates with memoization for performance
    const createdAtFormatted = React.useMemo(() => 
        formatDateDisplay(review.createdAt, language), 
        [review.createdAt, language]
    );
    
    const updatedAtFormatted = React.useMemo(() => 
        review.updatedAt ? formatDateDisplay(review.updatedAt, language) : null, 
        [review.updatedAt, language]
    );
    
    // Check if review was edited with validation
    const isEdited = React.useMemo(() => {
        if (!review.updatedAt) return false;
        const created = new Date(review.createdAt);
        const updated = new Date(review.updatedAt);
        
        // Validate dates
        if (isNaN(created.getTime()) || isNaN(updated.getTime())) {
            console.warn('Invalid dates in review:', { createdAt: review.createdAt, updatedAt: review.updatedAt });
            return false;
        }
        
        return updated.getTime() - created.getTime() > 60000; // More than 1 minute difference
    }, [review.createdAt, review.updatedAt]);
    
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
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <UserAvatar name={review.author.name} avatarUrl={review.author.avatarUrl} />
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="font-medium text-base">{review.author.name}</div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                <Calendar className="w-4 h-4 shrink-0" />
                                <span className="shrink-0">{createdAtFormatted}</span>
                                {termElement}
                            </div>
                        </div>
                    </div>
                    {/* Edit indicator */}
                    {isEdited && updatedAtFormatted && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t("courses.review.edited", { date: updatedAtFormatted })}</span>
                        </div>
                    )}
                </div>

                {/* Rating and Attributes in same row */}
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

                {/* Review Content */}
                <div className="px-4 py-3 rounded-lg bg-muted/30 border">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {review.content}
                    </div>
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
                                review.isLiked ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
                            className="gap-2 h-8 px-3 text-muted-foreground hover:text-foreground"
                            onClick={handleReply}
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-sm">
                                {review.repliesCount ? 
                                    t("courses.review.replies", { count: review.repliesCount }) : 
                                    t("courses.review.reply")
                                }
                            </span>
                        </Button>
                    </div>

                    {/* Time info */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{createdAtFormatted}</span>
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
