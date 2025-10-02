"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { SiteNavigation } from "@/components/SiteNavigation";
import CourseDetailCard from "@/components/CourseDetailCard";
import CourseReviewCard from "@/components/CourseReviewCard";
import CourseReviewReplyCard from "@/components/CourseReviewReplyCard";
import {
  fetchCourseReviews,
  fetchReviewReplies,
  toggleLikeReview,
  toggleLikeReply,
  createReviewReply,
  deleteReviewReply,
} from "@/lib/api/course";
import { useI18n } from "@/hooks/useI18n";
import { fetchCourseById } from "@/lib/api/course";
import type { Course, TeacherInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { isContentEmpty } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { deleteCourseReview } from "@/lib/api/course";
import { useRouter } from "next/navigation";
// No longer needed to map names -> ids; sample courses already carry {id,name}

// Client-only CKEditor wrapper for inline reply composer
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

export default function CourseDetailPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { t } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teacherQuery = searchParams.get("teacher") || undefined;

  // Unwrap params Promise for Next.js 15
  const resolvedParams = React.use(params);
  const { subjectId } = resolvedParams;

  const [course, setCourse] = React.useState<Course | null>(null);

  // Fetch from backend when subjectId changes
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchCourseById(subjectId);
      if (!cancelled) setCourse(data);
    })();
    return () => { cancelled = true; };
  }, [subjectId]);

  // Use teachers from data (already {id,name}); if ?teacher=name 提供，则将该老师置顶显示
  const teachers: TeacherInfo[] = React.useMemo(() => {
    const list = course?.teachers ?? [];
    if (!teacherQuery) return list;
    const idx = list.findIndex(t => t.name === teacherQuery);
    if (idx <= 0) return list;
    const picked = list[idx];
    return [picked, ...list.filter((_, i) => i !== idx)];
  }, [course, teacherQuery]);

  // Get other teachers teaching the same course
  const otherTeacherCourses = React.useMemo(() => (course?.otherTeacherCourses ?? []), [course]);

  // Reviews state (paginated; initial load only)
  const [reviews, setReviews] = React.useState<import("@/types").CourseReview[]>([]);
  const [reviewsCount, setReviewsCount] = React.useState<number>(0);
  const [filterSort, setFilterSort] = React.useState<string>("mostLiked");
  const [filterSelectedTerms, setFilterSelectedTerms] = React.useState<Record<string, boolean>>({});
  const [filterRatingMin, setFilterRatingMin] = React.useState<number>(0);
  const [filterRatingMax, setFilterRatingMax] = React.useState<number>(10);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Only fetch reviews when we have a valid subjectId (from the course)
      const courseSubjectId = course?.subjectId;
      if (!courseSubjectId) return;
      
      try {
        const page = await fetchCourseReviews({ subjectId: courseSubjectId, page: 1, pageSize: 10, ordering: "-created_at" });
        if (!cancelled) {
          setReviews(page.results);
          setReviewsCount(page.count);
        }
      } catch (e) {
        // Ignore errors; keep empty state
        console.error('Failed to load reviews', e);
      }
    })();
    return () => { cancelled = true; };
  }, [course?.subjectId]); // Only re-fetch when subjectId changes, not when course object reference changes

  // Reset selected term filter when switching to a different course
  React.useEffect(() => {
    setFilterSelectedTerms({});
  }, [course?.subjectId]);

  // Track which reviews' replies are expanded (default collapsed)
  const [expandedReviews, setExpandedReviews] = React.useState<Set<string>>(new Set());

  // Toggle like/unlike a review
  const handleLikeReview = React.useCallback(async (reviewId: string) => {
    if (!isLoggedIn) { openLoginModal(); return; }
    try {
      const updated = await toggleLikeReview(reviewId);
      setReviews(prev => prev.map(r => r.id === reviewId ? updated : r));
    } catch (e) {
      console.error('Failed to toggle like review', e);
    }
  }, [isLoggedIn, openLoginModal]);

  // Toggle replies expanded/collapsed per review (default collapsed)
  // Replies cache per review (initial page)
  const [repliesByReview, setRepliesByReview] = React.useState<Record<string, import("@/types").CourseReviewReply[]>>({});
  const [newReplyContentByReview, setNewReplyContentByReview] = React.useState<Record<string, string>>({});
  // Track which reviews have the inline reply composer open
  const [replyComposerOpen, setReplyComposerOpen] = React.useState<Set<string>>(new Set());
  // Track reply target user per review when replying to a reply
  const [replyToUserByReview, setReplyToUserByReview] = React.useState<Record<string, { id: string; name: string } | null>>({});

  const handleToggleReplies = React.useCallback((reviewId: string, nextExpanded: boolean) => {
    setExpandedReviews(prev => {
      const next = new Set(prev);
      if (nextExpanded) next.add(reviewId); else next.delete(reviewId);
      return next;
    });
    // Lazy-load replies when expanding
    if (nextExpanded && !repliesByReview[reviewId]) {
      (async () => {
        try {
          const page = await fetchReviewReplies({ reviewId, page: 1, pageSize: 20, ordering: "created_at" });
          setRepliesByReview(prev => ({ ...prev, [reviewId]: page.results }));
        } catch (e) {
          console.error('Failed to load replies', e);
        }
      })();
    }
  }, [repliesByReview]);

  // Inline create reply form toggler
  const handleCreateReply = React.useCallback((reviewId: string) => {
    if (!isLoggedIn) { openLoginModal(); return; }
    // Ensure replies area is expanded but do not auto-toggle via replies button
    setExpandedReviews(prev => new Set(prev).add(reviewId));
    setReplyComposerOpen(prev => {
      const next = new Set(prev);
      next.add(reviewId);
      return next;
    });
    setNewReplyContentByReview(prev => ({ ...prev, [reviewId]: prev[reviewId] ?? "" }));
    setReplyToUserByReview(prev => ({ ...prev, [reviewId]: null }));
  }, [isLoggedIn, openLoginModal]);

  // Open composer targeting a specific reply's author (reply to reply)
  const handleReplyToReply = React.useCallback((reviewId: string, target: import("@/types").CourseReviewReply) => {
    if (!isLoggedIn) { openLoginModal(); return; }
    setExpandedReviews(prev => new Set(prev).add(reviewId));
    setReplyComposerOpen(prev => {
      const next = new Set(prev);
      next.add(reviewId);
      return next;
    });
    setReplyToUserByReview(prev => ({ ...prev, [reviewId]: { id: target.author.id, name: target.author.name } }));
    setNewReplyContentByReview(prev => ({ ...prev, [reviewId]: prev[reviewId] ?? "" }));
  }, [isLoggedIn, openLoginModal]);

  const handleSubmitReply = React.useCallback(async (reviewId: string) => {
    if (!isLoggedIn) { openLoginModal(); return; }
    const html = (newReplyContentByReview[reviewId] || "").trim();
    if (isContentEmpty(html)) return;
    try {
      const payload: Parameters<typeof createReviewReply>[1] = {
        content: html,
        ...(replyToUserByReview[reviewId]?.id ? { replyToUserId: replyToUserByReview[reviewId]!.id } : {}),
      };
      const reply = await createReviewReply(reviewId, payload);
      setRepliesByReview(prev => ({ ...prev, [reviewId]: [ ...(prev[reviewId] || []), reply ] }));
      setNewReplyContentByReview(prev => ({ ...prev, [reviewId]: "" }));
      setReplyComposerOpen(prev => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
      setReplyToUserByReview(prev => ({ ...prev, [reviewId]: null }));
      // bump repliesCount on review
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, repliesCount: (r.repliesCount || 0) + 1 } : r));
    } catch (e) {
      console.error('Failed to create reply', e);
    }
  }, [newReplyContentByReview, replyToUserByReview, isLoggedIn, openLoginModal]);

  const handleDeleteReply = React.useCallback(async (reviewId: string, replyId: string) => {
    if (!isLoggedIn) { openLoginModal(); return; }
    try {
      await deleteReviewReply(replyId);
      setRepliesByReview(prev => ({ ...prev, [reviewId]: (prev[reviewId] || []).filter(r => r.id !== replyId) }));
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, repliesCount: Math.max(0, (r.repliesCount || 1) - 1) } : r));
    } catch (e) {
      console.error('Failed to delete reply', e);
    }
  }, [isLoggedIn, openLoginModal]);

  // Map filter sort key to backend ordering
  const mapSortToOrdering = React.useCallback((key: string): string => {
    switch (key) {
      case 'mostLiked': return '-likes_count';
      case 'newest': return '-created_at';
      case 'oldest': return 'created_at';
      case 'ratingHighToLow': return '-overall_rating';
      case 'ratingLowToHigh': return 'overall_rating';
      default: return '-created_at';
    }
  }, []);

  // Helper: reload reviews with current filters from server (ensures counts are authoritative)
  const reloadReviews = React.useCallback(async (): Promise<number> => {
    // Guard: return early if course is not yet loaded
    if (!course) {
      console.warn('reloadReviews called before course loaded');
      return 0;
    }
    
    const selectedKeys = Object.entries(filterSelectedTerms).filter(([, v]) => v).map(([k]) => k);
    let termYear: number | undefined; let termSemester: 'spring'|'summer'|'fall' | undefined;
    if (selectedKeys.length === 1) {
      const [y, s] = selectedKeys[0].split('-');
      const yNum = Number(y);
      if (!Number.isNaN(yNum) && (s === 'spring' || s === 'summer' || s === 'fall')) {
        termYear = yNum; termSemester = s as 'spring' | 'summer' | 'fall';
      }
    }
    
    try {
      const page = await fetchCourseReviews({
        subjectId: course.subjectId,
        page: 1,
        pageSize: 10,
        ordering: mapSortToOrdering(filterSort),
        minRating: filterRatingMin,
        maxRating: filterRatingMax,
        ...(termYear ? { termYear } : {}),
        ...(termSemester ? { termSemester } : {}),
      });
      setReviews(page.results);
      setReviewsCount(page.count);
      return page.count;
    } catch (error) {
      console.error('Failed to reload reviews:', error);
      // Don't update state on error, keep existing data
      return reviewsCount;
    }
  }, [course, filterSelectedTerms, filterRatingMin, filterRatingMax, filterSort, mapSortToOrdering, reviewsCount]);

  const filterCallbacks = React.useMemo(() => ({
    onSortChange: (value: string) => setFilterSort(value),
    onTermsChange: (selected: Record<string, boolean>) => setFilterSelectedTerms(selected),
    onRatingChange: (min: number, max: number) => { setFilterRatingMin(min); setFilterRatingMax(max); },
    onApplyFilters: async () => {
      // Guard: prevent filter application if course is not yet loaded
      if (!course) {
        console.warn('Cannot apply filters: course not loaded yet');
        return;
      }
      try { 
        await reloadReviews(); 
      } catch (e) { 
        console.error('Failed to apply filters', e); 
      }
    },
  }), [course, reloadReviews]); 

  const filterState = React.useMemo(() => ({
    sort: filterSort,
    selectedTerms: filterSelectedTerms,
    ratingMin: filterRatingMin,
    ratingMax: filterRatingMax,
  }), [filterSort, filterSelectedTerms, filterRatingMin, filterRatingMax]);

  // Inline reply is handled by the earlier handleCreateReply

  // Use backend rating counts, but override reviewsCount with filtered count
  const derivedRating = React.useMemo(() => {
    const baseRating = course?.rating ?? { score: 0, reviewsCount: 0, recommendCount: 0, notRecommendCount: 0 };
    return {
      ...baseRating,
      reviewsCount: reviewsCount, // Use filtered count for display
    };
  }, [course?.rating, reviewsCount]);


  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNavigation />
        <main className="w-full py-10">
          <div className="max-w-5xl mx-auto p-6">
            <div className="text-center text-muted-foreground">{t("courses.detail.courseNotFound")}</div>
          </div>
        </main>
      </div>
    );
  }

  // Use filtered count for display in the detail card

  return (
    <div className="min-h-screen bg-background">
      <SiteNavigation />
      <main className="w-full py-8">
        <div className="w-full p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 gap-6 pt-2">
            <div className="px-4">
              <CourseDetailCard
                subjectId={course.subjectId}
                subjectCode={course.subjectCode}
                title={course.title}
                term={course.term}
                terms={course.terms}
                rating={derivedRating}
                attributes={course.attributes}
                teachers={teachers}
                department={course.department}
                lastUpdated={course.lastUpdated}
                curriculum={course.curriculum}
                filterState={filterState}
                filterCallbacks={filterCallbacks}
                // placeholders - can be wired later
                selectionCategory={course.selectionCategory}
                teachingType={course.teachingType}
                courseCategory={course.courseCategory}
                offeringDepartment={course.offeringDepartment ?? course.department}
                level={course.level}
                credits={course.credits}
                courseHomepageUrl={course.courseHomepageUrl}
                syllabusUrl={course.syllabusUrl}
                otherTeacherCourses={otherTeacherCourses}
                userVote={course.userVote ?? null}
                userHasReview={course.userHasReview ?? null}
              />
            </div>

            {/* Course Reviews Section */}
            {reviews.length > 0 && (
              <div className="px-4">
                <div className="flex flex-col gap-1">
                  {reviews.map((review) => {
                    const isExpanded = expandedReviews.has(review.id);
                    const replies = isExpanded ? (repliesByReview[review.id] || []) : [];
                    return (
                      <div key={review.id} className="space-y-0.5">
                        {/* Review card */}
                        <CourseReviewCard
                          review={review}
                          onLike={handleLikeReview}
                          onToggleReplies={handleToggleReplies}
                          repliesExpanded={isExpanded}
                          onCreateReply={handleCreateReply}
                          onEdit={() => {
                            // Navigate to edit page with full form
                            router.push(`/courses/${course.subjectId}/review?edit=1`);
                          }}
                          onDelete={async (id) => {
                            if (!isLoggedIn) { openLoginModal(); return; }
                            const ok = window.confirm(t('courses.review.deleteConfirm'));
                            if (!ok) return;
                            try {
                              await deleteCourseReview(id);
                              // Remove locally for perceived responsiveness
                              setReviews(prev => prev.filter(r => r.id !== id));
                              // Refresh course detail and current filtered reviews to sync counts accurately
                              const fresh = await fetchCourseById(subjectId);
                              if (fresh) setCourse(fresh);
                              await reloadReviews();
                            } catch (e) {
                              console.error('Failed to delete review', e);
                            }
                          }}
                          showRepliesSection={false}
                        />

                        {/* Replies area: render only if expanded AND there is something to show */}
                        {(isExpanded && (replyComposerOpen.has(review.id) || replies.length > 0)) && (
                          <div className="ml-12 space-y-2">
                            {/* Inline reply composer: shown only when opened via "Add Comment" */}
                            {replyComposerOpen.has(review.id) && (
                              <div className="p-2 border rounded">
                                {replyToUserByReview[review.id] && (
                                  <div className="text-xs text-muted-foreground mb-1">
                                    {t('comment.reply')} @{replyToUserByReview[review.id]!.name}
                                  </div>
                                )}
                                <RichTextEditor
                                  value={newReplyContentByReview[review.id] || ""}
                                  onChange={(v: string) => setNewReplyContentByReview(prev => ({ ...prev, [review.id]: v }))}
                                  placeholder={t('comment.writePlaceholder') || 'Write a comment…'}
                                  className="w-full"
                                />
                                <div className="flex gap-2 justify-end mt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitReply(review.id)}
                                    disabled={isContentEmpty(newReplyContentByReview[review.id] || "")}
                                  >
                                    {t('comment.post')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setNewReplyContentByReview(prev => ({ ...prev, [review.id]: "" }));
                                      setReplyComposerOpen(prev => {
                                        const next = new Set(prev);
                                        next.delete(review.id);
                                        return next;
                                      });
                                      setReplyToUserByReview(prev => ({ ...prev, [review.id]: null }));
                                    }}
                                  >
                                    {t('post.cancel')}
                                  </Button>
                                </div>
                              </div>
                            )}
                            {replies.map((r) => (
                              <CourseReviewReplyCard
                                key={r.id}
                                reply={r}
                                onLike={async (id) => {
                                  if (!isLoggedIn) { openLoginModal(); return; }
                                  try {
                                    const updated = await toggleLikeReply(id);
                                    setRepliesByReview(prev => ({
                                      ...prev,
                                      [review.id]: (prev[review.id] || []).map(item => item.id === id ? updated : item)
                                    }));
                                  } catch (e) {
                                    console.error('Failed to toggle like reply', e);
                                  }
                                }}
                                onReply={() => handleReplyToReply(review.id, r)}
                                onDelete={(id) => handleDeleteReply(review.id, id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
