"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Star, ChevronDown, EyeOff } from "lucide-react";

import { SiteNavigation } from "@/components/SiteNavigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";
import { stripHtmlTags } from "@/lib/html-utils";
import { formatTerm, sortTerms } from "@/lib/course-utils";
import { fetchCourseById, createCourseReview, fetchCourseReviews } from "@/lib/api/course";
import { updateCourseReview } from "@/lib/api/course";
import type { SemesterKey, Course } from "@/types";
import { useApp } from "@/contexts/AppContext";

// Rich text editor (CKEditor 5) is client-only
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

type Difficulty = 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard';
type Workload = 'light' | 'moderate' | 'heavy' | 'veryHeavy';
type Grading = 'lenient' | 'balanced' | 'strict' | 'killer';
type Gain = 'low' | 'decent' | 'high';

export default function CourseReviewCreatePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { t, language } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading, openLoginModal } = useApp();

  // Unwrap params for Next.js 15
  const resolvedParams = React.use(params);
  const { courseId } = resolvedParams;

  // Form state
  const [onlyText, setOnlyText] = React.useState(false);
  // rating in 0..10 (supports half-star)
  const [rating, setRating] = React.useState<number>(0);
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [difficulty, setDifficulty] = React.useState<Difficulty | undefined>(undefined);
  const [workload, setWorkload] = React.useState<Workload | undefined>(undefined);
  const [grading, setGrading] = React.useState<Grading | undefined>(undefined);
  const [gain, setGain] = React.useState<Gain | undefined>(undefined);
  const [content, setContent] = React.useState<string>("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [anonymous, setAnonymous] = React.useState(false);
  const [selectedTerm, setSelectedTerm] = React.useState<{ year: number; semester: SemesterKey } | undefined>(undefined);

  // Edit mode detection and existing review state
  const isEditMode = (searchParams?.get('edit') === '1' || searchParams?.get('edit') === 'true');
  const [editingReviewId, setEditingReviewId] = React.useState<string | null>(null);

  // Load course to get available terms
  const [course, setCourse] = React.useState<Course | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchCourseById(courseId);
      if (!cancelled) setCourse(data);
    })();
    return () => { cancelled = true; };
  }, [courseId]);
  const availableTerms = React.useMemo(() => {
    if (!course) return [] as Array<{ year: number; semester: SemesterKey }>;
    const source = course.terms && course.terms.length > 0 ? course.terms : [course.term];
    return sortTerms(source);
  }, [course]);

  React.useEffect(() => {
    if (!selectedTerm && availableTerms.length > 0) {
      setSelectedTerm(availableTerms[0]);
    }
  }, [availableTerms, selectedTerm]);

  // If edit mode, fetch current user's review and prefill
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isEditMode) return;
      try {
        const page = await fetchCourseReviews({ courseId, page: 1, pageSize: 1, mine: true, ordering: '-created_at' });
        const my = page.results?.[0];
        if (my && !cancelled) {
          setEditingReviewId(my.id);
          // Prefill flags if available
          setOnlyText(Boolean(my.onlyText));
          setAnonymous(Boolean(my.isAnonymous));
          // Prefill fields from my review
          setRating(typeof my.overallRating === 'number' ? my.overallRating : 0);
          setDifficulty(my.attributes?.difficulty as Difficulty);
          setWorkload(my.attributes?.workload as Workload);
          setGrading(my.attributes?.grading as Grading);
          setGain(my.attributes?.gain as Gain);
          setContent(my.content || '');
          if (my.term) setSelectedTerm({ year: my.term.year, semester: my.term.semester as SemesterKey });
        }
      } catch (e) {
        console.error('Failed to load my review for edit', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isEditMode, courseId]);
  const [errors, setErrors] = React.useState<{
    stars?: string;
    dimensions?: string;
    content?: string;
  }>({});

  const selectPlaceholder = t("courses.topbar.selectPlaceholder");

  // Require login: open login modal if not authenticated
  React.useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      openLoginModal();
    }
  }, [isLoggedIn, isLoading, openLoginModal]);

  const validate = React.useCallback(() => {
    const nextErrors: typeof errors = {};
    if (!onlyText) {
      if (!rating || rating < 1) {
        nextErrors.stars = t("courses.reviewForm.validation.ratingRequired");
      }
      if (!difficulty || !workload || !grading || !gain) {
        nextErrors.dimensions = t("courses.reviewForm.validation.dimensionsRequired");
      }
    }
    const plain = stripHtmlTags(content).trim();
    if (!plain) {
      nextErrors.content = t("courses.reviewForm.validation.contentRequired");
    } else if (plain.length < 10) {
      nextErrors.content = t("courses.reviewForm.validation.contentTooShort");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [onlyText, rating, difficulty, workload, grading, gain, content, t]);

  const handleSubmit = async () => {
    if (!isLoggedIn) { openLoginModal(); return; }
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload: Parameters<typeof createCourseReview>[1] = {
        onlyText,
        content,
        isAnonymous: anonymous,
      };
      // Only include rating and attributes when onlyText is false
      if (!onlyText) {
        payload.overallRating = rating;
        payload.attributes = {
          difficulty: difficulty!,
          workload: workload!,
          grading: grading!,
          gain: gain!,
        };
      }
      // Only include term if selected
      if (selectedTerm) {
        payload.term = { year: selectedTerm.year, semester: selectedTerm.semester };
      }
      if (isEditMode && editingReviewId) {
        await updateCourseReview(editingReviewId, payload);
      } else {
        await createCourseReview(courseId, payload);
      }
      router.push(`/courses/${courseId}`);
    } catch (e) {
      console.error("Failed to submit review", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarControl = (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground w-20 shrink-0">
        {t("courses.reviewForm.rating")}
      </Label>
      <div
        className={cn("flex items-center gap-1", onlyText && "opacity-60 pointer-events-none")}
        aria-disabled={onlyText}
      >
        {[0,1,2,3,4].map((idx) => {
          const onMoveOrClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (onlyText) return 0;
            const rect = e.currentTarget.getBoundingClientRect();
            const half = (e.clientX - rect.left) < rect.width / 2 ? 1 : 2; // 1 => half, 2 => full
            return idx * 2 + half; // 1..10
          };

        const display = hoverRating || rating;
        const level = Math.max(0, Math.min(2, display - idx * 2)); // 0,1,2
        const fillPercent = level <= 0 ? 0 : level === 1 ? 50 : 100;

          return (
            <button
              key={idx}
              type="button"
              aria-label={`star ${idx + 1}`}
              className="relative inline-flex items-center justify-center w-6 h-6 rounded hover:scale-105 transition"
              onMouseMove={(e) => {
                const val = onMoveOrClick(e);
                if (val) setHoverRating(val);
              }}
              onMouseLeave={() => setHoverRating(0)}
              onClick={(e) => {
                const val = onMoveOrClick(e);
                if (val) setRating(val);
              }}
            >
              {/* Base (empty) star */}
              <Star className="w-6 h-6 text-muted-foreground" />
              {/* Filled overlay based on half/full */}
              <div className="absolute left-0 top-0 h-6 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                <Star className="w-6 h-6 text-yellow-500 fill-current absolute left-0 top-0" />
              </div>
            </button>
          );
        })}
        <span className="ml-2 min-w-[4rem] text-sm text-muted-foreground tabular-nums text-right">
          {(hoverRating || rating) > 0 ? `${hoverRating || rating}/10` : t('courses.reviewForm.noRating')}
        </span>
      </div>
    </div>
  );

  const DimensionDropdown = <T extends string>({
    label,
    value,
    onChange,
    options,
    disabled
  }: {
    label: string;
    value: T | undefined;
    onChange: (v: T) => void;
    options: Array<{ value: T; label: string }>;
    disabled?: boolean;
  }) => (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground w-20 shrink-0">{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="justify-between w-full md:w-56"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? options.find(o => o.value === value)?.label : selectPlaceholder}</span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 p-0">
          <DropdownMenuRadioGroup value={value as string | undefined} onValueChange={(v) => onChange(v as T)}>
            {options.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: 'veryEasy', label: t('courses.card.adjectives.veryEasy') },
    { value: 'easy', label: t('courses.card.adjectives.easy') },
    { value: 'medium', label: t('courses.card.adjectives.medium') },
    { value: 'hard', label: t('courses.card.adjectives.hard') },
    { value: 'veryHard', label: t('courses.card.adjectives.veryHard') },
  ];
  const workloadOptions: Array<{ value: Workload; label: string }> = [
    { value: 'light', label: t('courses.card.adjectives.light') },
    { value: 'moderate', label: t('courses.card.adjectives.moderate') },
    { value: 'heavy', label: t('courses.card.adjectives.heavy') },
    { value: 'veryHeavy', label: t('courses.card.adjectives.veryHeavy') },
  ];
  const gradingOptions: Array<{ value: Grading; label: string }> = [
    { value: 'lenient', label: t('courses.card.adjectives.lenient') },
    { value: 'balanced', label: t('courses.card.adjectives.balanced') },
    { value: 'strict', label: t('courses.card.adjectives.strict') },
    { value: 'killer', label: t('courses.card.adjectives.killer') },
  ];
  const gainOptions: Array<{ value: Gain; label: string }> = [
    { value: 'low', label: t('courses.card.adjectives.low') },
    { value: 'decent', label: t('courses.card.adjectives.decent') },
    { value: 'high', label: t('courses.card.adjectives.high') },
  ];

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-8">
          <div className="w-full p-6">
            <div className="max-w-3xl mx-auto">
                  <h1 className="text-2xl font-semibold mb-4">{isEditMode ? t('courses.reviewForm.editTitle') : t('courses.reviewForm.title')}</h1>
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-base">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="onlyText" checked={onlyText} onCheckedChange={(v) => setOnlyText(Boolean(v))} />
                        <Label htmlFor="onlyText" className="cursor-pointer">
                          {t('courses.reviewForm.onlyText')}
                        </Label>
                      </div>
                      <Button
                        size="sm"
                        variant={anonymous ? "secondary" : "outline"}
                        className="gap-2"
                        onClick={() => setAnonymous((v) => !v)}
                      >
                        <EyeOff className="w-4 h-4" />
                        <span>{t('courses.reviewForm.anonymous')}</span>
                        <span className="text-xs opacity-70">
                          {anonymous ? t('courses.reviewForm.anonymousOn') : t('courses.reviewForm.anonymousOff')}
                        </span>
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{t('courses.reviewForm.onlyTextHint')}</p>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Term selection */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground w-20 shrink-0">
                      {t('courses.reviewForm.term.label')}
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" role="combobox" className="justify-between w-full md:w-56">
                          <span className={cn("truncate", !selectedTerm && "text-muted-foreground")}>
                            {selectedTerm
                              ? formatTerm(selectedTerm.year, selectedTerm.semester, t, language)
                              : t('courses.reviewForm.term.select')}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 p-0">
                        <DropdownMenuRadioGroup
                          value={selectedTerm ? `${selectedTerm.year}-${selectedTerm.semester}` : undefined}
                          onValueChange={(v) => {
                            const [y, s] = v.split('-');
                            const year = Number(y);
                            const semester = s as SemesterKey;
                            const found = availableTerms.find(tm => tm.year === year && tm.semester === semester);
                            if (found) setSelectedTerm(found);
                          }}
                        >
                          {availableTerms.map((tm) => {
                            const value = `${tm.year}-${tm.semester}`;
                            return (
                              <DropdownMenuRadioItem key={value} value={value}>
                                {formatTerm(tm.year, tm.semester, t, language)}
                              </DropdownMenuRadioItem>
                            );
                          })}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Stars */}
                  {StarControl}
                  {errors.stars && !onlyText && (
                    <p className="text-xs text-red-500">{errors.stars}</p>
                  )}

                  {/* Dimensions */}
                  <div className={cn("space-y-2", onlyText && "opacity-60 pointer-events-none")}
                    aria-disabled={onlyText}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <DimensionDropdown
                        label={t('courses.card.attributes.difficulty')}
                        value={difficulty}
                        onChange={setDifficulty}
                        options={difficultyOptions}
                        disabled={onlyText}
                      />
                      <DimensionDropdown
                        label={t('courses.card.attributes.workload')}
                        value={workload}
                        onChange={setWorkload}
                        options={workloadOptions}
                        disabled={onlyText}
                      />
                      <DimensionDropdown
                        label={t('courses.card.attributes.grading')}
                        value={grading}
                        onChange={setGrading}
                        options={gradingOptions}
                        disabled={onlyText}
                      />
                      <DimensionDropdown
                        label={t('courses.card.attributes.gain')}
                        value={gain}
                        onChange={setGain}
                        options={gainOptions}
                        disabled={onlyText}
                      />
                    </div>
                    {errors.dimensions && !onlyText && (
                      <p className="text-xs text-red-500">{errors.dimensions}</p>
                    )}
                  </div>

                  {/* Rich Text Content */}
                  <RichTextEditor
                    value={content}
                    onChange={(v) => {
                      setContent(v);
                      if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
                    }}
                    placeholder={t('courses.reviewForm.contentPlaceholder')}
                    className="prose max-w-none"
                  />
                  {errors.content && (
                    <p className="text-xs text-red-500">{errors.content}</p>
                  )}
                </CardContent>
                <CardFooter className="gap-3">
                  <Button onClick={handleSubmit} disabled={isSubmitting || !isLoggedIn} className="min-w-[120px]">
                    {isSubmitting ? (isEditMode ? t('courses.reviewForm.updating') : t('courses.reviewForm.submitting')) : (isEditMode ? t('courses.reviewForm.update') : t('courses.reviewForm.submit'))}
                  </Button>
                  <Button variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
                    {t('courses.reviewForm.cancel')}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
