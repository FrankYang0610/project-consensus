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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { clamp, formatDateDisplay, formatTerm, sortTerms, validateRating } from "@/lib/course-utils";
import type {
    SemesterKey,
    VotingState,
    VotingAction,
    FilterState,
    FilterCallbacks,
    CoursesDetailedCardProps,
} from "@/types";

// Voting state reducer
function votingReducer(state: VotingState, action: VotingAction): VotingState {
    switch (action.type) {
        case 'TOGGLE_VOTE': {
            const { voteType } = action;
            
            if (state.userVote === voteType) {
                // Remove existing vote
                return {
                    userVote: null,
                    recommendCount: voteType === 'recommend' 
                        ? Math.max(0, state.recommendCount - 1) 
                        : state.recommendCount,
                    notRecommendCount: voteType === 'notRecommend' 
                        ? Math.max(0, state.notRecommendCount - 1) 
                        : state.notRecommendCount,
                };
            } else {
                // Change or add vote
                let newRecommendCount = state.recommendCount;
                let newNotRecommendCount = state.notRecommendCount;
                
                // Remove previous vote if exists
                if (state.userVote === 'recommend') {
                    newRecommendCount = Math.max(0, newRecommendCount - 1);
                } else if (state.userVote === 'notRecommend') {
                    newNotRecommendCount = Math.max(0, newNotRecommendCount - 1);
                }
                
                // Add new vote
                if (voteType === 'recommend') {
                    newRecommendCount++;
                } else {
                    newNotRecommendCount++;
                }
                
                return {
                    userVote: voteType,
                    recommendCount: newRecommendCount,
                    notRecommendCount: newNotRecommendCount,
                };
            }
        }
        case 'RESET_VOTES': {
            return {
                userVote: null,
                recommendCount: action.recommendCount,
                notRecommendCount: action.notRecommendCount,
            };
        }
        default:
            return state;
    }
}

// Types moved to '@/types'

// Utility Functions moved to '@/lib/course-utils'

/**
 * Star rating: maps 0–10 score to 0–5 partially-filled stars
 */
function StarRating({ score10 }: { score10: number }) {
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
        if (!name || typeof name !== 'string') return '?';
        const trimmedName = name.trim();
        if (!trimmedName) return '?';
        
        const parts = trimmedName.split(/\s+/).filter(Boolean);
        const initialsText = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
        return initialsText || trimmedName[0]?.toUpperCase() || "?";
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
    subjectId: _subjectId, // Placeholder to avoid unused warning, will be used later
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
    filterState,
    filterCallbacks,
    otherTeacherCourses,
}: CoursesDetailedCardProps) {
    const { t, language } = useI18n();
    // Placeholder to avoid unused warning, will be used later
    void _subjectId;
    
    // Interactive voting state using useReducer to avoid race conditions
    const [votingState, dispatchVoting] = React.useReducer(votingReducer, {
        userVote: null,
        recommendCount: rating.recommendCount ?? 0,
        notRecommendCount: rating.notRecommendCount ?? 0,
    });
    
    // Reset voting state when rating props change
    React.useEffect(() => {
        dispatchVoting({
            type: 'RESET_VOTES',
            recommendCount: rating.recommendCount ?? 0,
            notRecommendCount: rating.notRecommendCount ?? 0,
        });
    }, [rating.recommendCount, rating.notRecommendCount]);
    
    // State for filtered review count
    const [filteredReviewsCount, setFilteredReviewsCount] = React.useState(rating.reviewsCount);
    
    // Default filter state; use defaults if parent does not provide
    const [internalFilterState, setInternalFilterState] = React.useState<FilterState>({
        sort: "mostLiked",
        selectedTerms: {},
        ratingMin: 0,
        ratingMax: 10,
    });

    // Use external state or internal defaults
    const currentFilterState = filterState ?? internalFilterState;
    
    // Listen for external review count changes
    React.useEffect(() => {
        setFilteredReviewsCount(rating.reviewsCount);
    }, [rating.reviewsCount]);
    
    // Default callbacks; if parent does not provide them, manage internal state
    const defaultCallbacks: FilterCallbacks = React.useMemo(() => ({
        onSortChange: (value: string) => {
            if (filterCallbacks?.onSortChange) {
                filterCallbacks.onSortChange(value);
            } else {
                setInternalFilterState(prev => ({ ...prev, sort: value }));
            }
        },
        onTermsChange: (selected: Record<string, boolean>) => {
            if (filterCallbacks?.onTermsChange) {
                filterCallbacks.onTermsChange(selected);
            } else {
                setInternalFilterState(prev => ({ ...prev, selectedTerms: selected }));
            }
        },
        onRatingChange: (min: number, max: number) => {
            if (filterCallbacks?.onRatingChange) {
                filterCallbacks.onRatingChange(min, max);
            } else {
                setInternalFilterState(prev => ({ ...prev, ratingMin: min, ratingMax: max }));
            }
        },
        onApplyFilters: () => {
            if (filterCallbacks?.onApplyFilters) {
                filterCallbacks.onApplyFilters();
            } else {
                // Default apply-filter logic - simulate filtered result
                const mockFilteredCount = Math.floor(rating.reviewsCount * (0.6 + Math.random() * 0.4));
                setFilteredReviewsCount(mockFilteredCount);
            }
        },
        onFilteredCountUpdate: (filteredCount: number) => {
            if (filterCallbacks?.onFilteredCountUpdate) {
                filterCallbacks.onFilteredCountUpdate(filteredCount);
            }
            setFilteredReviewsCount(filteredCount);
        },
    }), [filterCallbacks, currentFilterState, rating.reviewsCount]);

    const currentCallbacks = filterCallbacks ?? defaultCallbacks;

    /**
     * Handle user voting interaction using reducer to prevent race conditions
     */
    const handleVote = React.useCallback((voteType: 'recommend' | 'notRecommend') => {
        dispatchVoting({ type: 'TOGGLE_VOTE', voteType });
    }, []);

    // Sort terms by year and semester (most recent first)
    const orderedTerms = React.useMemo(() => {
        const source = terms && terms.length > 0 ? terms : [term];
        return sortTerms(source);
    }, [terms, term]);

    const safeRating = React.useMemo(() => validateRating(rating.score), [rating.score]);

    // Teacher data processing
    const primaryTeacher = teachers?.[0];
    const hasOtherTeachers = otherTeacherCourses && otherTeacherCourses.length > 0;
    const hasTeacherHomepage = !!primaryTeacher?.homepageUrl;

    // Adaptive layout: calculate content weight to balance columns
    const leftContentWeight = React.useMemo(() => {
        let weight = 1; // Base teacher section
        if (hasOtherTeachers) weight += (otherTeacherCourses?.length ?? 0) * 0.6; // Each additional teacher
        if (hasTeacherHomepage) weight += 0.4; // Teacher homepage link
        return weight;
    }, [hasOtherTeachers, otherTeacherCourses?.length, hasTeacherHomepage]);

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

    /**
     * Reviews filters inline components
     */
    function SortDropdown({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                        {t(`courses.detail.reviews.sort.options.${value}`)}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
                        {[
                            "mostLiked",
                            "newest",
                            "oldest",
                            "ratingHighToLow",
                            "ratingLowToHigh",
                        ].map((key) => (
                            <DropdownMenuRadioItem key={key} value={key} className="text-xs">
                                {t(`courses.detail.reviews.sort.options.${key}`)}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    function TermsDropdown({ 
        terms, 
        format, 
        selected, 
        onSelectionChange 
    }: { 
        terms: Array<{ year: number; semester: SemesterKey }>; 
        format: (tm: { year: number; semester: SemesterKey }) => string;
        selected: Record<string, boolean>;
        onSelectionChange: (selected: Record<string, boolean>) => void;
    }) {
        const [open, setOpen] = React.useState<boolean>(false);
        
        const toggle = React.useCallback((key: string, checked: boolean) => {
            const newSelected = { ...selected, [key]: checked };
            onSelectionChange(newSelected);
        }, [selected, onSelectionChange]);
        
        const selectedCount = React.useMemo(() => {
            return Object.values(selected).filter(Boolean).length;
        }, [selected]);
        
        return (
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                        {selectedCount > 0 ? t("courses.detail.reviews.term.selected", { count: selectedCount }) : t("courses.detail.reviews.term.select")}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-64 overflow-auto">
                    {terms.map((tm, idx) => {
                        const key = `${tm.year}-${tm.semester}-${idx}`;
                        return (
                            <DropdownMenuCheckboxItem
                                key={key}
                                checked={!!selected[key]}
                                onCheckedChange={(checked) => {
                                    toggle(key, Boolean(checked));
                                    // Prevent menu from closing
                                }}
                                onSelect={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                className="text-xs focus:bg-accent"
                            >
                                {format(tm)}
                            </DropdownMenuCheckboxItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    const RatingSlider = React.memo(({ 
        minVal, 
        maxVal, 
        onRangeChange 
    }: { 
        minVal: number; 
        maxVal: number; 
        onRangeChange: (min: number, max: number) => void; 
    }) => {
        const [isDragging, setIsDragging] = React.useState<'min' | 'max' | null>(null);
        const [localMinVal, setLocalMinVal] = React.useState<number>(minVal);
        const [localMaxVal, setLocalMaxVal] = React.useState<number>(maxVal);
        const sliderRef = React.useRef<HTMLDivElement>(null);
        const animationFrameRef = React.useRef<number>(0);
        const callbackTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
        const lastCallbackValuesRef = React.useRef<{ min: number; max: number }>({ min: minVal, max: maxVal });
    
        // Sync external state changes
        React.useEffect(() => {
            if (!isDragging) {
                setLocalMinVal(minVal);
                setLocalMaxVal(maxVal);
                lastCallbackValuesRef.current = { min: minVal, max: maxVal };
            }
        }, [minVal, maxVal, isDragging]);

        // Optimized callback - trigger only when values actually change
        const triggerCallback = React.useCallback((min: number, max: number) => {
            const lastValues = lastCallbackValuesRef.current;
            const roundedMin = Math.round(min * 10) / 10;
            const roundedMax = Math.round(max * 10) / 10;
            
            // Only trigger callback when values truly change
            if (Math.abs(roundedMin - lastValues.min) >= 0.1 || Math.abs(roundedMax - lastValues.max) >= 0.1) {
                if (callbackTimeoutRef.current) {
                    clearTimeout(callbackTimeoutRef.current);
                }
                callbackTimeoutRef.current = setTimeout(() => {
                    lastCallbackValuesRef.current = { min: roundedMin, max: roundedMax };
                    onRangeChange(roundedMin, roundedMax);
                }, 50); // Reduce debounce time to 50ms
            }
        }, [onRangeChange]);
    
        // Convert pixel position to value - cache optimized
        const pixelToValue = React.useCallback((clientX: number) => {
            if (!sliderRef.current) return 0;
            const rect = sliderRef.current.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return percent * 10;
        }, []);

        // Use requestAnimationFrame to optimize state updates
        const updateValues = React.useCallback((targetSlider: 'min' | 'max', value: number) => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            
            animationFrameRef.current = requestAnimationFrame(() => {
                if (targetSlider === 'min') {
                    const newMin = Math.max(0, Math.min(value, localMaxVal - 0.1));
                    if (Math.abs(newMin - localMinVal) >= 0.05) {
                        setLocalMinVal(newMin);
                        triggerCallback(newMin, localMaxVal);
                    }
                } else {
                    const newMax = Math.min(10, Math.max(value, localMinVal + 0.1));
                    if (Math.abs(newMax - localMaxVal) >= 0.05) {
                        setLocalMaxVal(newMax);
                        triggerCallback(localMinVal, newMax);
                    }
                }
            });
        }, [localMinVal, localMaxVal, triggerCallback]);
    
        // Handle pointer down - simplified logic
        const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
            if (!sliderRef.current) return;
            e.preventDefault();
            
            const value = pixelToValue(e.clientX);
            const distToMin = Math.abs(value - localMinVal);
            const distToMax = Math.abs(value - localMaxVal);
            
            const targetSlider = distToMin <= distToMax ? 'min' : 'max';
            setIsDragging(targetSlider);
            updateValues(targetSlider, value);
            
            // Set pointer capture to improve performance
            (e.target as Element).setPointerCapture(e.pointerId);
        }, [localMinVal, localMaxVal, pixelToValue, updateValues]);
    
        // Handle drag move - performance optimized
        const handlePointerMove = React.useCallback((e: PointerEvent) => {
            if (!isDragging) return;
            
            const value = pixelToValue(e.clientX);
            updateValues(isDragging, value);
        }, [isDragging, pixelToValue, updateValues]);
    
        // Handle drag end
        const handlePointerUp = React.useCallback(() => {
            if (isDragging) {
                // Trigger final callback immediately
                if (callbackTimeoutRef.current) {
                    clearTimeout(callbackTimeoutRef.current);
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                
                const roundedMin = Math.round(localMinVal * 10) / 10;
                const roundedMax = Math.round(localMaxVal * 10) / 10;
                lastCallbackValuesRef.current = { min: roundedMin, max: roundedMax };
                onRangeChange(roundedMin, roundedMax);
                setIsDragging(null);
            }
        }, [isDragging, localMinVal, localMaxVal, onRangeChange]);
    
        // Add global event listeners - optimized event handling
        React.useEffect(() => {
            if (isDragging) {
                document.addEventListener('pointermove', handlePointerMove, { passive: true });
                document.addEventListener('pointerup', handlePointerUp, { passive: true });
                
                return () => {
                    document.removeEventListener('pointermove', handlePointerMove);
                    document.removeEventListener('pointerup', handlePointerUp);
                    if (callbackTimeoutRef.current) {
                        clearTimeout(callbackTimeoutRef.current);
                    }
                    if (animationFrameRef.current) {
                        cancelAnimationFrame(animationFrameRef.current);
                    }
                };
            }
        }, [isDragging, handlePointerMove, handlePointerUp]);

        // Cache computed results - recompute only when values truly change
        const displayValues = React.useMemo(() => ({
            minPercent: `${Math.round(localMinVal * 1000) / 100}%`,
            maxPercent: `${Math.round(localMaxVal * 1000) / 100}%`,
            rangePercent: `${Math.round((localMaxVal - localMinVal) * 1000) / 100}%`,
            minDisplay: localMinVal.toFixed(1),
            maxDisplay: localMaxVal.toFixed(1)
        }), [localMinVal, localMaxVal]);

        // Static ticks component to avoid repeated renders
        const Ticks = React.useMemo(() => (
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 z-5 pointer-events-none">
                <div className="flex justify-between">
                    {[0, 2, 4, 6, 8, 10].map((tick) => (
                        <div key={tick} className="h-2 w-px bg-muted-foreground/60" />
                    ))}
                </div>
            </div>
        ), []);
    
        return (
            <div className="flex items-center gap-2 w-full">
                {/* Left value (min) */}
                <div className="w-10 text-[11px] text-muted-foreground text-right">
                    {displayValues.minDisplay}
                </div>
                
                {/* Custom slider container */}
                <div className="w-full sm:max-w-[260px] md:max-w-[300px] lg:max-w-[320px]">
                    <div 
                        ref={sliderRef}
                        className="relative w-full h-5 cursor-pointer touch-none select-none"
                        onPointerDown={handlePointerDown}
                    >
                        {/* Base track */}
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded bg-muted-foreground/25" />
                        
                        {/* Selected range - remove transitions to reduce repaints */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 h-1 rounded bg-primary z-10 will-change-auto"
                            style={{ 
                                left: displayValues.minPercent, 
                                width: displayValues.rangePercent
                            }}
                        />
                        
                        {/* Ticks - static element */}
                        {Ticks}
                        
                        {/* Min handle - fix positioning and z-index */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary border-2 border-background shadow-sm z-30 will-change-transform"
                            style={{ 
                                left: displayValues.minPercent,
                                marginLeft: '-8px', // Manually center to avoid transform conflicts
                                transform: isDragging === 'min' ? 'scale(1.1)' : 'scale(1)',
                                transition: isDragging === 'min' ? 'none' : 'transform 0.15s ease'
                            }}
                        />
                        
                        {/* Max handle - fix positioning and z-index */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary border-2 border-background shadow-sm z-30 will-change-transform"
                            style={{ 
                                left: displayValues.maxPercent,
                                marginLeft: '-8px', // Manually center to avoid transform conflicts
                                transform: isDragging === 'max' ? 'scale(1.1)' : 'scale(1)',
                                transition: isDragging === 'max' ? 'none' : 'transform 0.15s ease'
                            }}
                        />
                    </div>
                </div>
                
                {/* Right value (max) */}
                <div className="w-10 text-[11px] text-muted-foreground">
                    {displayValues.maxDisplay}
                </div>
            </div>
        );
    });
    
    RatingSlider.displayName = 'RatingSlider';

    return (
        <Card className={cn("overflow-hidden border-muted/30 shadow-none bg-background/50 backdrop-blur-sm", className)}>
            {/* Header Section - Course Title, Terms, Rating, and Actions */}
            <CardHeader className="pb-1 bg-gradient-to-r from-background/80 to-muted/10">
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
                                <span className="text-2xl font-bold">{safeRating.toFixed(1)}</span>
                                <span className="text-sm text-muted-foreground">/ 10</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <Users className="w-4 h-4 inline mr-1" />
                                {t("courses.card.rating.reviews", { count: filteredReviewsCount })}
                            </div>
                        </div>
                        {/* Interactive Voting Buttons */}
                        <div className="flex gap-2">
                            <Button 
                                size="sm" 
                                variant={votingState.userVote === 'recommend' ? 'default' : 'outline'}
                                className="gap-1.5"
                                onClick={() => handleVote('recommend')}
                            >
                                <ThumbsUp className="w-4 h-4" /> 
                                <span>{t("courses.detail.recommend")}</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-xs font-medium",
                                    votingState.userVote === 'recommend' ? "bg-white/20" : "bg-muted"
                                )}>
                                    {votingState.recommendCount}
                                </span>
                            </Button>
                            <Button 
                                size="sm" 
                                variant={votingState.userVote === 'notRecommend' ? 'destructive' : 'outline'}
                                className="gap-1.5"
                                onClick={() => handleVote('notRecommend')}
                            >
                                <ThumbsDown className="w-4 h-4" />
                                <span>{t("courses.detail.notRecommend")}</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-xs font-medium",
                                    votingState.userVote === 'notRecommend' ? "bg-white/20" : "bg-muted"
                                )}>
                                    {votingState.notRecommendCount}
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="space-y-4 px-6 pt-1 pb-5">
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
                                        {otherTeacherCourses!.map((course) => (
                                            <Link 
                                                key={course.subjectId}
                                                href={`/courses/${course.subjectId}`}
                                                className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
                                            >
                                                <TeacherAvatar name={course.teacherName} avatarUrl={course.teacherAvatarUrl} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium">{course.teacherName}</div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                            {course.rating.score.toFixed(1)}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{t("courses.card.rating.reviews", { count: course.rating.reviewsCount })}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-muted-foreground/80">{t("courses.detail.otherTeachers.gain")}:</span>
                                                        <span className="px-2 py-1 rounded bg-muted/50 font-medium">
                                                            {t(`courses.card.adjectives.${course.attributes.gain}`)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-muted-foreground/80">{t("courses.detail.otherTeachers.grading")}:</span>
                                                        <span className="px-2 py-1 rounded bg-muted/50 font-medium">
                                                            {t(`courses.card.adjectives.${course.attributes.grading}`)}
                                                        </span>
                                                    </div>
                                                </div>
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
                            {/* Last Updated inside the course info area */}
                            {lastUpdated && (
                                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    {t("courses.card.lastUpdated", { date: formatDateDisplay(lastUpdated, language) })}
                                </div>
                            )}
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

                {/* Reviews Header and Filters */}
                <div className="border-t pt-4 space-y-3">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold">{t("courses.detail.reviews.title")}</h3>
                        <Button size="sm">{t("courses.detail.reviews.writeReview")}</Button>
                    </div>
                    {/* Alert Bar */}
                    <Alert>
                        <AlertDescription>
                            {t("courses.detail.reviews.deletedNotice", { count: 0 })}
                        </AlertDescription>
                    </Alert>

                    {/* Filters Row */}
                    <div className="rounded-lg border bg-background/60 px-3 py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
                            {/* Left cluster: Sort + Term */}
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Label className="text-xs w-12 shrink-0 text-muted-foreground">{t("courses.detail.reviews.sort.label")}</Label>
                                    <SortDropdown 
                                        value={currentFilterState.sort} 
                                        onValueChange={currentCallbacks.onSortChange} 
                                    />
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Label className="text-xs w-12 shrink-0 text-muted-foreground">{t("courses.detail.reviews.term.label")}</Label>
                                    <TermsDropdown 
                                        terms={orderedTerms} 
                                        format={(tm: { year: number; semester: SemesterKey }) => formatTerm(tm.year, tm.semester, t, language)}
                                        selected={currentFilterState.selectedTerms}
                                        onSelectionChange={currentCallbacks.onTermsChange}
                                    />
                                </div>
                            </div>
                            {/* Right cluster: Rating + Total + Apply */}
                            <div className="flex items-center gap-3 flex-1 md:justify-end">
                                <Label className="text-xs w-12 shrink-0 text-muted-foreground">{t("courses.detail.reviews.rating.label")}</Label>
                                <div className="flex-1 min-w-[240px] max-w-[360px]">
                                    <RatingSlider 
                                        minVal={currentFilterState.ratingMin} 
                                        maxVal={currentFilterState.ratingMax}
                                        onRangeChange={currentCallbacks.onRatingChange}
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                    {t("courses.detail.reviews.totalReviews", { count: filteredReviewsCount })}
                                </div>
                                <Button 
                                    size="default" 
                                    className="h-9 px-4 text-sm"
                                    onClick={currentCallbacks.onApplyFilters}
                                >
                                    {t("courses.detail.reviews.apply")}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}

export default CoursesDetailedCard;
