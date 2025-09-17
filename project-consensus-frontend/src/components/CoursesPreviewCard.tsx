"use client";

import * as React from "react";
import Link from "next/link";
import { Star, Users, BookOpen, CalendarDays, Building2 } from "lucide-react";

import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

/**
 * Supported semester keys (no winter term)
 */
type SemesterKey = "spring" | "summer" | "fall";

/**
 * Courses preview card props
 */
export interface CoursesPreviewCardProps {
    subjectCode: string;
    title: string;
    term: {
        year: number;
        semester: SemesterKey;
    };
    terms?: Array<{
        year: number;
        semester: SemesterKey;
    }>; // optional: multiple offerings, latest shown with ellipsis
    rating: {
        score: number; // 0.0 - 10.0
        reviewsCount: number;
    };
    attributes: {
        difficulty: "veryEasy" | "easy" | "medium" | "hard" | "veryHard";
        workload: "light" | "moderate" | "heavy" | "veryHeavy";
        grading: "lenient" | "balanced" | "strict";
        gain: "low" | "decent" | "high";
    };
    teachers?: string[];
    department?: string;
    lastUpdated?: string | Date;
    href?: string;
    className?: string;
}

/**
 * Clamp a numeric value between [min, max]
 */
function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Format term string by locale
 */
function formatTerm(year: number, semester: SemesterKey, t: (key: string, opts?: Record<string, unknown>) => string, language: string) {
    const semLabel = t(`card.semester.${semester}`);
    // e.g. "2025 秋季" (zh) or "2025 Fall" (en)
    const spacer = language.startsWith("zh") ? " " : " ";
    return `${year}${spacer}${semLabel}`;
}

/**
 * Pick the latest term by (year desc, semester order desc)
 */
function getLatestTerm(terms: Array<{ year: number; semester: SemesterKey }>): { year: number; semester: SemesterKey } {
    const order: Record<SemesterKey, number> = { spring: 1, summer: 2, fall: 3 };
    return terms.slice().sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return order[b.semester] - order[a.semester];
    })[0];
}

/**
 * Format a date for display by language, with safe fallback
 */
function formatDateDisplay(dateInput: string | Date, language: string) {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    try {
        return new Intl.DateTimeFormat(language, { year: "numeric", month: "short", day: "numeric" }).format(date);
    } catch {
        return date.toLocaleDateString();
    }
}

/**
 * 0..10 score mapped to a 0..5 partial-filled star rating
 */
function StarRating({ score10 }: { score10: number }) {
    const safeScore = clamp(score10, 0, 10);
    const score5 = safeScore / 2; // map 0..10 -> 0..5
    return (
        <div className="flex items-center gap-1" aria-label={`rating-${safeScore}`}> 
            {Array.from({ length: 5 }).map((_, index) => {
                const fillPercent = clamp((score5 - index) * 100, 0, 100);
                return (
                    <div key={index} className="relative w-4 h-4" aria-hidden>
                        <Star className="absolute inset-0 w-4 h-4 text-muted-foreground/60" />
                        <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                            <Star className="w-4 h-4 text-yellow-500" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Attribute row with label and pill value
 */
function AttributeItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground whitespace-nowrap truncate">{label}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground whitespace-nowrap shrink-0">
                {value}
            </span>
        </div>
    );
}

/**
 * Meta row for teacher/department with fixed icon, non-truncating label, truncating value
 */
function MetaItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-sm min-w-0">
            {icon && (
                <span className="shrink-0 text-muted-foreground inline-flex items-center">{icon}</span>
            )}
            <span className="text-muted-foreground whitespace-nowrap shrink-0">{label}</span>
            <span className="truncate">{value}</span>
        </div>
    );
}

export function CoursesPreviewCard({
    subjectCode,
    title,
    term,
    terms,
    rating,
    attributes,
    teachers,
    department,
    lastUpdated,
    href,
    className,
}: CoursesPreviewCardProps) {
    const { t, language } = useI18n();
    const hasMultiple = Array.isArray(terms) && terms.length > 0;
    const displayedTerm = hasMultiple ? getLatestTerm(terms!) : term;
    const termText = formatTerm(displayedTerm.year, displayedTerm.semester, t, language) + (hasMultiple ? "..." : "");
    const reviewsText = t("card.rating.reviews", { count: rating.reviewsCount });

    const TitleBlock = (
        <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <CardTitle className="text-base">
                        <span className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                                {subjectCode}
                            </span>
                            <span className="line-clamp-1">{title}</span>
                            <span className="text-muted-foreground text-sm ml-1">({termText})</span>
                        </span>
                    </CardTitle>
                </div>
            </div>
        </CardHeader>
    );

    const ContentBlock = (
        <CardContent className="pt-0">
            <div className="flex flex-col gap-3">
                {/* Rating Row */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <StarRating score10={rating.score} />
                        <span className="text-sm font-medium">{rating.score.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/ 10</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{reviewsText}</span>
                    </div>
                </div>

                {/* Attributes + Meta Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-3">
                        <AttributeItem
                            label={t("card.attributes.difficulty")}
                            value={t(`card.adjectives.${attributes.difficulty}`)}
                        />
                        <AttributeItem
                            label={t("card.attributes.workload")}
                            value={t(`card.adjectives.${attributes.workload}`)}
                        />
                    </div>
                    <div className="space-y-3">
                        <AttributeItem
                            label={t("card.attributes.grading")}
                            value={t(`card.adjectives.${attributes.grading}`)}
                        />
                        <AttributeItem
                            label={t("card.attributes.gain")}
                            value={t(`card.adjectives.${attributes.gain}`)}
                        />
                    </div>
                    <div className="space-y-3">
                        {teachers && teachers.length > 0 && (
                            <MetaItem
                                label={t("courses.card.labels.teachers")}
                                value={teachers.join(", ")}
                                icon={<BookOpen className="w-3.5 h-3.5" />}
                            />
                        )}
                        {department && (
                            <MetaItem
                                label={t("courses.card.labels.department")}
                                value={department}
                                icon={<Building2 className="w-3.5 h-3.5" />}
                            />
                        )}
                    </div>
                </div>
            </div>
        </CardContent>
    );

    const FooterBlock = lastUpdated ? (
        <CardFooter className="pt-4 md:pt-5">
            <div className="flex items-center justify-end w-full gap-2 text-xs text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5" />
                {t("card.lastUpdated", { date: formatDateDisplay(lastUpdated, language) })}
            </div>
        </CardFooter>
    ) : null;

    const CardInner = (
        <Card className={cn("hover:shadow-md transition-shadow duration-200 gap-1 py-4", href && "cursor-pointer", className)}>
            {TitleBlock}
            {ContentBlock}
            {FooterBlock}
        </Card>
    );

    return href ? (
        <Link href={href} className="block">
            {CardInner}
        </Link>
    ) : (
        CardInner
    );
}

export default CoursesPreviewCard;


