"use client";

import * as React from "react";
import Link from "next/link";
import { Users, BookOpen, CalendarDays, Building2, Star } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { clamp, formatDateDisplay, formatTerm, sortTerms, validateRating } from "@/lib/course-utils";
import type { Course, SemesterKey } from "@/types";

/**
 * 课程预览卡片组件属性 / Props for CoursesPreviewCard
 */
export interface CoursesPreviewCardProps {
  subjectId: string;
  subjectCode: string;
  title: string;
  term: {
    year: number;
    semester: SemesterKey;
  };
  terms?: Array<{
    year: number;
    semester: SemesterKey;
  }>;
  rating: {
    score: number; // 0.0 - 10.0
    reviewsCount: number;
  };
  attributes: {
    difficulty: 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard';
    workload: 'light' | 'moderate' | 'heavy' | 'veryHeavy';
    grading: 'lenient' | 'balanced' | 'strict';
    gain: 'low' | 'decent' | 'high';
  };
  teachers?: string[];
  department?: string;
  lastUpdated?: string | Date;
  href?: string; // optional override; otherwise computed from subjectId
  className?: string;
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
  subjectId,
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
  const hasMultipleTerms = React.useMemo(() => Array.isArray(terms) && terms.length > 0, [terms]);

  const displayedTerm = React.useMemo(() => {
    if (hasMultipleTerms && terms) {
      const [latest] = sortTerms(terms);
      return latest ?? term;
    }
    return term;
  }, [hasMultipleTerms, terms, term]);

  const termText = React.useMemo(() => {
    const base = formatTerm(displayedTerm.year, displayedTerm.semester, t, language);
    return hasMultipleTerms ? `${base}...` : base;
  }, [displayedTerm, hasMultipleTerms, t, language]);

  const safeRating = React.useMemo(() => validateRating(rating.score), [rating.score]);
  const reviewsText = React.useMemo(
    () => t("courses.card.rating.reviews", { count: rating.reviewsCount }),
    [rating.reviewsCount, t]
  );

  const formattedLastUpdated = React.useMemo(() => {
    if (!lastUpdated) return null;
    return formatDateDisplay(lastUpdated, language);
  }, [lastUpdated, language]);

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

  // Local star rating for preview card
  const StarRating = React.useMemo(() => {
    return function StarRatingInner({ score10 }: { score10: number }) {
      const safeScore = validateRating(score10);
      const score5 = safeScore / 2;
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
    };
  }, []);

  const ContentBlock = (
    <CardContent className="pt-0">
      <div className="flex flex-col gap-3">
        {/* Rating Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StarRating score10={rating.score} />
            <span className="text-sm font-medium">{safeRating.toFixed(1)}</span>
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
              label={t("courses.card.attributes.difficulty")}
              value={t(`courses.card.adjectives.${attributes.difficulty}`)}
            />
            <AttributeItem
              label={t("courses.card.attributes.workload")}
              value={t(`courses.card.adjectives.${attributes.workload}`)}
            />
          </div>
          <div className="space-y-3">
            <AttributeItem
              label={t("courses.card.attributes.grading")}
              value={t(`courses.card.adjectives.${attributes.grading}`)}
            />
            <AttributeItem
              label={t("courses.card.attributes.gain")}
              value={t(`courses.card.adjectives.${attributes.gain}`)}
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

  const FooterBlock = formattedLastUpdated ? (
    <CardFooter className="pt-4 md:pt-5">
      <div className="flex items-center justify-end w-full gap-2 text-xs text-muted-foreground">
        <CalendarDays className="w-3.5 h-3.5" />
        {t("courses.card.lastUpdated", { date: formattedLastUpdated })}
      </div>
    </CardFooter>
  ) : null;
  // optional override using href; otherwise computed from subjectId
  const computedHref = href ?? (subjectId ? `/courses/${subjectId}` : undefined);

  const CardInner = (
    <Card className={cn("hover:shadow-md transition-shadow duration-200 gap-1 py-4", computedHref && "cursor-pointer", className)}>
      {TitleBlock}
      {ContentBlock}
      {FooterBlock}
    </Card>
  );

  return computedHref ? (
    <Link href={computedHref} className="block">
      {CardInner}
    </Link>
  ) : (
    CardInner
  );
}

export default CoursesPreviewCard;
