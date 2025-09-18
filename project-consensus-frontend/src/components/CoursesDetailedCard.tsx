"use client";

import * as React from "react";
import Link from "next/link";
import { 
    BookOpen, 
    CalendarDays, 
    Star, 
    ThumbsDown, 
    ThumbsUp, 
    Users,
    GraduationCap,
    FileText,
    Home,
    Sparkles
} from "lucide-react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

// Types
type SemesterKey = "spring" | "summer" | "fall";

export interface TeacherInfo {
    name: string;
    avatarUrl?: string;
    homepageUrl?: string;
}

export interface CoursesDetailedCardProps {
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
        recommendCount?: number;
        notRecommendCount?: number;
    };
    attributes: {
        difficulty: "veryEasy" | "easy" | "medium" | "hard" | "veryHard";
        workload: "light" | "moderate" | "heavy" | "veryHeavy";
        grading: "lenient" | "balanced" | "strict";
        gain: "low" | "decent" | "high";
    };
    teachers: TeacherInfo[];
    department?: string;
    lastUpdated?: string | Date;
    // Course metadata
    selectionCategory?: string;
    teachingType?: string;
    courseCategory?: string;
    offeringDepartment?: string;
    level?: string;
    credits?: number | string;
    courseHomepageUrl?: string;
    syllabusUrl?: string;
    className?: string;
}

// Utility Functions
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Format semester term for display with proper spacing for different languages
 */
function formatTerm(
    year: number, 
    semester: SemesterKey, 
    t: (key: string, opts?: Record<string, unknown>) => string, 
    language: string
): string {
    const semLabel = t(`courses.card.semester.${semester}`);
    const spacer = language.startsWith("zh") ? " " : " ";
    return `${year}${spacer}${semLabel}`;
}

/**
 * Format date for display with language-specific formatting
 */
function formatDateDisplay(dateInput: string | Date, language: string): string {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    try {
        return new Intl.DateTimeFormat(language, { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
        }).format(date);
    } catch {
        return date.toLocaleDateString();
    }
}

/**
 * Star rating component that maps 0-10 score to 0-5 star display
 */
function StarRating({ score10 }: { score10: number }) {
    const safeScore = clamp(score10, 0, 10);
    const score5 = safeScore / 2; // Convert to 5-star scale
    
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
 * Metadata row component for key-value pairs
 */
function MetaRow({ label, value }: { label: string; value?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between text-sm py-2">
            <span className="text-muted-foreground font-medium whitespace-nowrap">{label}:</span>
            <span className="text-right font-medium">{value ?? "—"}</span>
        </div>
    );
}

/**
 * Teacher avatar component with fallback to initials
 */
function TeacherAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
    const initials = React.useMemo(() => {
        const parts = name.split(/\s+/).filter(Boolean);
        const initialsText = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
        return initialsText || name[0]?.toUpperCase() || "?";
    }, [name]);
    
    return (
        <div className="h-9 w-9 rounded-full bg-muted inline-flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
                <span className="text-xs text-muted-foreground">{initials}</span>
            )}
        </div>
    );
}

export function CoursesDetailedCard({
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
    selectionCategory,
    teachingType,
    courseCategory,
    offeringDepartment,
    level,
    credits,
    courseHomepageUrl,
    syllabusUrl,
    className,
}: CoursesDetailedCardProps) {
    const { t, language } = useI18n();
    
    // Interactive voting state
    const [userVote, setUserVote] = React.useState<'recommend' | 'notRecommend' | null>(null);
    const [currentRecommendCount, setCurrentRecommendCount] = React.useState(rating.recommendCount ?? 0);
    const [currentNotRecommendCount, setCurrentNotRecommendCount] = React.useState(rating.notRecommendCount ?? 0);

    /**
     * Handle user voting interaction
     */
    const handleVote = React.useCallback((voteType: 'recommend' | 'notRecommend') => {
        if (userVote === voteType) {
            // Remove existing vote
            setUserVote(null);
            if (voteType === 'recommend') {
                setCurrentRecommendCount(prev => Math.max(0, prev - 1));
            } else {
                setCurrentNotRecommendCount(prev => Math.max(0, prev - 1));
            }
        } else {
            // Change or add vote
            if (userVote === 'recommend') {
                setCurrentRecommendCount(prev => Math.max(0, prev - 1));
            } else if (userVote === 'notRecommend') {
                setCurrentNotRecommendCount(prev => Math.max(0, prev - 1));
            }
            
            setUserVote(voteType);
            if (voteType === 'recommend') {
                setCurrentRecommendCount(prev => prev + 1);
            } else {
                setCurrentNotRecommendCount(prev => prev + 1);
            }
        }
    }, [userVote]);

    // Sort terms by year and semester (most recent first)
    const orderedTerms = React.useMemo(() => {
        const order: Record<SemesterKey, number> = { spring: 1, summer: 2, fall: 3 };
        const list = (terms && terms.length > 0) ? terms.slice() : [term];
        return list.sort((a, b) => (b.year - a.year) || (order[b.semester] - order[a.semester]));
    }, [terms, term]);

    // Teacher data processing
    const primaryTeacher = teachers?.[0];
    const otherTeachers = teachers.slice(1);
    const hasOtherTeachers = otherTeachers.length > 0;
    const hasTeacherHomepage = !!primaryTeacher?.homepageUrl;

    // Adaptive layout: calculate content weight to balance columns
    const leftContentWeight = React.useMemo(() => {
        let weight = 1; // Base teacher section
        if (hasOtherTeachers) weight += otherTeachers.length * 0.6; // Each additional teacher
        if (hasTeacherHomepage) weight += 0.4; // Teacher homepage link
        return weight;
    }, [hasOtherTeachers, otherTeachers.length, hasTeacherHomepage]);

    const rightContentWeight = React.useMemo(() => {
        return 2.3; // Course info (1.5) + AI Summary (0.8)
    }, []);

    // Course links go to the lighter side for balance
    const courseLinksOnLeft = leftContentWeight < rightContentWeight;

    /**
     * Reusable course links section component
     */
    const CourseLinksSection = React.useCallback(() => (
        <div>
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> {t("courses.detail.courseLinks")}
            </h3>
            <div className="space-y-3">
                {/* Course Homepage */}
                {courseHomepageUrl ? (
                    <Link 
                        href={courseHomepageUrl} 
                        target="_blank" 
                        className="flex items-center gap-3 p-4 rounded-lg border bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                        <BookOpen className="w-5 h-5" />
                        <div>
                            <div className="font-medium">{t("courses.detail.courseHomepage")}</div>
                            <div className="text-xs opacity-80">{t("courses.detail.visitOfficialPage")}</div>
                        </div>
                    </Link>
                ) : (
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30 text-muted-foreground">
                        <BookOpen className="w-5 h-5" />
                        <div>
                            <div className="font-medium">{t("courses.detail.courseHomepage")}</div>
                            <div className="text-xs opacity-80">{t("courses.detail.noLinkAvailable")}</div>
                        </div>
                    </div>
                )}
                
                {/* Course Syllabus */}
                {syllabusUrl ? (
                    <Link 
                        href={syllabusUrl} 
                        target="_blank" 
                        className="flex items-center gap-3 p-4 rounded-lg border bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                        <FileText className="w-5 h-5" />
                        <div>
                            <div className="font-medium">{t("courses.detail.syllabus")}</div>
                            <div className="text-xs opacity-80">{t("courses.detail.viewDetailedSyllabus")}</div>
                        </div>
                    </Link>
                ) : (
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30 text-muted-foreground">
                        <FileText className="w-5 h-5" />
                        <div>
                            <div className="font-medium">{t("courses.detail.syllabus")}</div>
                            <div className="text-xs opacity-80">{t("courses.detail.noLinkAvailable")}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    ), [courseHomepageUrl, syllabusUrl, t]);

    return (
        <Card className={cn("overflow-hidden border-muted/30 shadow-none bg-background/50 backdrop-blur-sm", className)}>
            {/* Header Section - Course Title, Terms, Rating, and Actions */}
            <CardHeader className="pb-6 bg-gradient-to-r from-background/80 to-muted/10">
                <div className="flex flex-col gap-3">
                    {/* Title Row */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            {/* Course Code and Terms */}
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="inline-flex items-center px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
                                    {subjectCode}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {orderedTerms.map((tm, idx) => (
                                        <span 
                                            key={`${tm.year}-${tm.semester}-${idx}`} 
                                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs"
                                        >
                                            {formatTerm(tm.year, tm.semester, t, language)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {/* Course Title */}
                            <CardTitle className="text-2xl font-bold">
                                {title}
                            </CardTitle>
                        </div>
                        {/* Follow Button */}
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="gap-1">
                                <Star className="w-4 h-4" /> {t("courses.detail.follow")}
                            </Button>
                        </div>
                    </div>
                    
                    {/* Rating and Voting Section */}
                    <div className="flex items-center justify-between border-t pt-3">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <StarRating score10={rating.score} />
                                <span className="text-2xl font-bold">{rating.score.toFixed(1)}</span>
                                <span className="text-sm text-muted-foreground">/ 10</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <Users className="w-4 h-4 inline mr-1" />
                                {t("courses.card.rating.reviews", { count: rating.reviewsCount })}
                            </div>
                        </div>
                        {/* Interactive Voting Buttons */}
                        <div className="flex gap-2">
                            <Button 
                                size="sm" 
                                variant={userVote === 'recommend' ? 'default' : 'outline'}
                                className="gap-1.5"
                                onClick={() => handleVote('recommend')}
                            >
                                <ThumbsUp className="w-4 h-4" /> 
                                <span>{t("courses.detail.recommend")}</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-xs font-medium",
                                    userVote === 'recommend' ? "bg-white/20" : "bg-muted"
                                )}>
                                    {currentRecommendCount}
                                </span>
                            </Button>
                            <Button 
                                size="sm" 
                                variant={userVote === 'notRecommend' ? 'destructive' : 'outline'}
                                className="gap-1.5"
                                onClick={() => handleVote('notRecommend')}
                            >
                                <ThumbsDown className="w-4 h-4" />
                                <span>{t("courses.detail.notRecommend")}</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-xs font-medium",
                                    userVote === 'notRecommend' ? "bg-white/20" : "bg-muted"
                                )}>
                                    {currentNotRecommendCount}
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="space-y-8 px-6 py-6">
                {/* Course Attributes Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(['difficulty', 'workload', 'grading', 'gain'] as const).map((attr) => (
                        <div key={attr} className="text-center p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                            <div className="text-xs text-muted-foreground mb-2">
                                {t(`courses.card.attributes.${attr}`)}
                            </div>
                            <div className="font-semibold text-sm">
                                {t(`courses.card.adjectives.${attributes[attr]}`)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Two-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Course Links - Adaptive positioning */}
                        {courseLinksOnLeft && <CourseLinksSection />}
                        
                        {/* Teacher Information */}
                        <div>
                            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                                <GraduationCap className="w-5 h-5" /> {t("courses.detail.teachers")}
                            </h3>
                            
                            {/* Primary Teacher */}
                            {primaryTeacher && (
                                <div className="flex items-start gap-4 p-4 rounded-lg border bg-background">
                                    <TeacherAvatar name={primaryTeacher.name} avatarUrl={primaryTeacher.avatarUrl} />
                                    <div className="flex-1">
                                        <div className="font-medium text-base">{primaryTeacher.name}</div>
                                        <div className="text-sm text-muted-foreground mb-2">{department}</div>
                                        {primaryTeacher.homepageUrl && (
                                            <Link 
                                                href={primaryTeacher.homepageUrl} 
                                                target="_blank" 
                                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                            >
                                                <Home className="w-4 h-4" /> {t("courses.detail.teacherHomepage")}
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Other Teachers */}
                            {hasOtherTeachers && (
                                <div className="mt-4">
                                    <div className="text-sm font-medium text-muted-foreground mb-3">
                                        {t("courses.detail.otherTeachersOfCourse", { title })}
                                    </div>
                                    <div className="space-y-2">
                                        {otherTeachers.map((tch) => (
                                            <Link 
                                                key={tch.name}
                                                href={`/courses/${subjectId}?teacher=${encodeURIComponent(tch.name)}`}
                                                className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                                            >
                                                <TeacherAvatar name={tch.name} avatarUrl={tch.avatarUrl} />
                                                <span className="text-sm font-medium">{tch.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Course Information */}
                        <div>
                            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5" /> {t("courses.detail.courseInfo")}
                            </h3>
                            <div className="p-5 rounded-lg border bg-background/80">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-12">
                                    <MetaRow label={t("courses.detail.selectionCategory")} value={selectionCategory} />
                                    <MetaRow label={t("courses.detail.teachingType")} value={teachingType} />
                                    <MetaRow label={t("courses.detail.courseCategory")} value={courseCategory} />
                                    <MetaRow label={t("courses.detail.offeringDepartment")} value={offeringDepartment ?? department} />
                                    <MetaRow label={t("courses.detail.level")} value={level} />
                                    <MetaRow label={t("courses.detail.credits")} value={credits !== undefined ? String(credits) : undefined} />
                                </div>
                            </div>
                        </div>

                        {/* Course Links - Adaptive positioning */}
                        {!courseLinksOnLeft && <CourseLinksSection />}

                        {/* AI Summary */}
                        <div>
                            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5" /> {t("courses.detail.aiSummary")}
                            </h3>
                            <div className="p-4 rounded-lg border bg-muted/30">
                                <div className="text-sm text-muted-foreground">
                                    {t("courses.detail.aiSummaryComingSoon")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - Last Updated */}
                {lastUpdated && (
                    <div className="pt-4 border-t">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {t("courses.card.lastUpdated", { date: formatDateDisplay(lastUpdated, language) })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default CoursesDetailedCard;