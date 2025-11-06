"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
    fetchCourseReviewById,
  findReviewByReplyId,
} from "@/lib/api/course";
import { HttpError } from "@/lib/api/api-utils";
import { useI18n } from "@/hooks/use-i18n";
import { fetchCourseById } from "@/lib/api/course";
import type { Course, TeacherInfo, CourseReview, FetchCourseReviewsParams, CourseReviewReply } from "@/types";
import { Button } from "@/components/ui/button";
import { isContentEmpty } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { deleteCourseReview } from "@/lib/api/course";
import { useRouter } from "next/navigation";
import { useInfiniteList } from "@/hooks/use-infinite-list";
// No longer needed to map names -> ids; sample courses already carry {id,name}

// Client-only CKEditor wrapper for inline reply composer
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { t } = useI18n();
  const { isLoggedIn, openLoginModal } = useApp();
  const router = useRouter();

  // Unwrap params Promise for Next.js 15
  const resolvedParams = React.use(params);
  const { courseId } = resolvedParams;

  const [course, setCourse] = React.useState<Course | null>(null);
  const [missingDialog, setMissingDialog] = React.useState<{ open: boolean; message: string }>(() => ({ open: false, message: "" }));

  // Fetch from backend when courseId changes
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchCourseById(courseId);
      if (!cancelled) setCourse(data);
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  // Use teachers from data (already {id,name})
  const teachers: TeacherInfo[] = React.useMemo(() => {
    return course?.teachers ?? [];
  }, [course]);

  // Get other teachers teaching the same course
  const otherTeacherCourses = React.useMemo(() => (course?.otherTeacherCourses ?? []), [course]);

  // Reviews list (paginated via unified hook)
  const {
    items: reviews,
    setItems: setReviews,
    loaderRef: reviewsLoaderRef,
    hasMore: reviewsHasMore,
    error: reviewsLoadError,
    setError: setReviewsLoadError,
    loadMore: loadMoreReviews,
    reset: resetReviews,
  } = useInfiniteList<CourseReview, FetchCourseReviewsParams>({
    pageFetcher: fetchCourseReviews,
    initialParams: { courseId, page: 1, pageSize: 10, ordering: '-created_at' },
    pageSize: 10,
    dedupeKey: (r) => r.id,
  });
  const [filterSort, setFilterSort] = React.useState<string>("mostLiked");
  const [filterSelectedTerms, setFilterSelectedTerms] = React.useState<Record<string, boolean>>({});
  const [filterRatingMin, setFilterRatingMin] = React.useState<number>(0);
  const [filterRatingMax, setFilterRatingMax] = React.useState<number>(10);
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

  const buildReviewsParams: () => FetchCourseReviewsParams | undefined = React.useCallback(() => {
    if (!course?.courseId) return undefined;
    const selectedKeys = Object.entries(filterSelectedTerms).filter(([, v]) => v).map(([k]) => k);
    let termYear: number | undefined; let termSemester: 'spring' | 'summer' | 'fall' | undefined;
    if (selectedKeys.length === 1) {
      const [y, s] = selectedKeys[0].split('-');
      const yNum = Number(y);
      if (!Number.isNaN(yNum) && (s === 'spring' || s === 'summer' || s === 'fall')) {
        termYear = yNum; termSemester = s as 'spring' | 'summer' | 'fall';
      }
    }
    return {
      courseId: course.courseId,
      page: 1,
      pageSize: 10,
      ordering: mapSortToOrdering(filterSort),
      minRating: filterRatingMin,
      maxRating: filterRatingMax,
      ...(termYear ? { termYear } : {}),
      ...(termSemester ? { termSemester } : {}),
    };
  }, [course?.courseId, filterSort, filterRatingMin, filterRatingMax, filterSelectedTerms, mapSortToOrdering]);

  // Trigger initial load when course becomes available
  React.useEffect(() => {
    const params = buildReviewsParams();
    if (params) {
      resetReviews(params);
    }
  }, [buildReviewsParams, resetReviews]);

  // Reset selected term filter when switching to a different course
  React.useEffect(() => {
    setFilterSelectedTerms({});
  }, [course?.courseId]);

  // Track which reviews' replies are expanded (default collapsed)
  const [expandedReviews, setExpandedReviews] = React.useState<Set<string>>(new Set());
  // Replies cache per review (initial page)
  const [repliesByReview, setRepliesByReview] = React.useState<Record<string, CourseReviewReply[]>>({});
  const [newReplyContentByReview, setNewReplyContentByReview] = React.useState<Record<string, string>>({});
  // Track which reviews have the inline reply composer open
  const [replyComposerOpen, setReplyComposerOpen] = React.useState<Set<string>>(new Set());
  // Track reply target user per review when replying to a reply
  const [replyToUserByReview, setReplyToUserByReview] = React.useState<Record<string, { id: string; name: string } | null>>({});

  // Parse URL hash on mount and when URL changes to support notification anchors
  const [targetReviewId, setTargetReviewId] = React.useState<string | undefined>(undefined);
  const [targetReplyId, setTargetReplyId] = React.useState<string | undefined>(undefined);
  
  React.useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash;
      
      // Check for reply anchor first (more specific)
      if (hash && hash.startsWith('#reply-')) {
        const replyId = hash.replace('#reply-', '');
        if (replyId) {
          setTargetReplyId(replyId);
          setTargetReviewId(undefined);
          return; // Don't scroll to top if we have a target reply
        }
      }
      
      // Check for review anchor
      if (hash && hash.startsWith('#review-')) {
        const reviewId = hash.replace('#review-', '');
        if (reviewId) {
          setTargetReviewId(reviewId);
          setTargetReplyId(undefined);
          return; // Don't scroll to top if we have a target review
        }
      }
      
      setTargetReviewId(undefined);
      setTargetReplyId(undefined);
    };

    // Parse on mount
    parseHash();

    // Listen for hash changes (browser back/forward, manual hash changes)
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, [courseId]);

  // Auto-insert, expand and scroll to target review when available
  React.useEffect(() => {
    if (!targetReviewId) return;

    (async () => {
      // Ensure the target review is present in the list; if not, fetch and inject
      let targetReview = reviews.find(r => r.id === targetReviewId);
      if (!targetReview) {
        try {
          const fetched = await fetchCourseReviewById(targetReviewId);
          if (fetched && fetched.courseId === courseId) {
            setReviews(prev => {
              // Avoid duplicates if another render already inserted it
              if (prev.some(r => r.id === fetched.id)) return prev;
              return [fetched, ...prev];
            });
            targetReview = fetched;
          }
        } catch (e) {
          if (e instanceof HttpError && e.status === 404) {
            // Missing review: show friendly dialog, no console noise
            setMissingDialog({ open: true, message: t('courses.detail.reviews.missing.reviewNotExist') });
          } else {
            console.error('Failed to fetch target review', e);
            setMissingDialog({ open: true, message: t('courses.detail.reviews.missing.reviewNotExist') });
          }
          setTargetReviewId(undefined);
        }
      }

      if (!targetReview) return;

      // Auto-expand replies for this review
      setExpandedReviews(prev => new Set(prev).add(targetReview.id));

      // Lazy-load replies if not already loaded
      if (!repliesByReview[targetReview.id]) {
        try {
          const page = await fetchReviewReplies({ reviewId: targetReview.id, page: 1, pageSize: 20, ordering: "created_at" });
          setRepliesByReview(prev => ({ ...prev, [targetReview.id]: page.results }));
        } catch (e) {
          console.error('Failed to load replies for target review', e);
        }
      }

      // Scroll to the review element after a short delay to ensure rendering
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.getElementById(`review-${targetReviewId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Clear target after scrolling
            setTargetReviewId(undefined);
          }
        }, 300);
      });
    })();
  }, [targetReviewId, courseId, reviews, repliesByReview, setReviews]);

  // Auto-insert, expand and scroll to target reply when available using efficient backend lookup
  React.useEffect(() => {
    if (!targetReplyId) return;

    // Check if any already-loaded replies contain our target
    let foundReviewId: string | undefined;
    for (const reviewId of Object.keys(repliesByReview)) {
      const replies = repliesByReview[reviewId] || [];
      if (replies.some(r => r.id === targetReplyId)) {
        foundReviewId = reviewId;
        break;
      }
    }

    if (foundReviewId) {
      // We found it in already-loaded data; ensure the review is loaded, expand and scroll
      const reviewId = foundReviewId;
      (async () => {
        if (!reviews.some(r => r.id === reviewId)) {
          try {
            const fetched = await fetchCourseReviewById(reviewId);
            if (fetched && fetched.courseId === courseId) {
              setReviews(prev => (prev.some(r => r.id === fetched.id) ? prev : [fetched, ...prev]));
            }
          } catch (e) {
            console.error('Failed to fetch parent review for reply', e);
          }
        }
        setExpandedReviews(prev => new Set(prev).add(reviewId));
        requestAnimationFrame(() => {
          setTimeout(() => {
            const element = document.getElementById(`reply-${targetReplyId}`);
            if (element) {
              // Use forum-style scroll calculation for better centering
              const rect = element.getBoundingClientRect();
              const absoluteTop = rect.top + window.pageYOffset;
              const targetTop = Math.max(absoluteTop - (window.innerHeight / 2 - rect.height / 2), 0);
              window.scrollTo({ top: targetTop, behavior: 'smooth' });
              // Add highlight effect (same as forum)
              element.classList.add('ring-2', 'ring-primary/40');
              setTimeout(() => element.classList.remove('ring-2', 'ring-primary/40'), 2000);
              // Clear target after scrolling
              setTargetReplyId(undefined);
            }
          }, 400);
        });
      })();
    } else {
      // Use backend endpoint to efficiently find which review contains this reply
      (async () => {
        try {
          const result = await findReviewByReplyId(targetReplyId);
          const reviewId = result.reviewId;
          // Ensure the parent review is present; fetch and insert if missing
          if (!reviews.some(r => r.id === reviewId)) {
            try {
              const fetched = await fetchCourseReviewById(reviewId);
              if (fetched && fetched.courseId === courseId) {
                setReviews(prev => (prev.some(r => r.id === fetched.id) ? prev : [fetched, ...prev]));
              }
            } catch (e) {
              console.error('Failed to fetch parent review for reply', e);
            }
          }
          // Expand the review
          setExpandedReviews(prev => new Set(prev).add(reviewId));
          
          // Load replies for this review if not already loaded
          if (!repliesByReview[reviewId]) {
            const page = await fetchReviewReplies({ reviewId, page: 1, pageSize: 20, ordering: "created_at" });
            setRepliesByReview(prev => ({ ...prev, [reviewId]: page.results }));
          }
          
          // Schedule scroll after state updates
          requestAnimationFrame(() => {
            setTimeout(() => {
              const element = document.getElementById(`reply-${targetReplyId}`);
              if (element) {
                const rect = element.getBoundingClientRect();
                const absoluteTop = rect.top + window.pageYOffset;
                const targetTop = Math.max(absoluteTop - (window.innerHeight / 2 - rect.height / 2), 0);
                window.scrollTo({ top: targetTop, behavior: 'smooth' });
                
                element.classList.add('ring-2', 'ring-primary/40');
                setTimeout(() => element.classList.remove('ring-2', 'ring-primary/40'), 2000);
                
                setTargetReplyId(undefined);
              }
            }, 400);
          });
        } catch (e) {
          if (e instanceof HttpError && e.status === 404) {
            // Reply doesn't exist: show dialog quietly
            setMissingDialog({ open: true, message: t('courses.detail.reviews.missing.replyNotExist') });
          } else {
            console.error('Failed to find review for reply', e);
            setMissingDialog({ open: true, message: t('courses.detail.reviews.missing.replyNotExist') });
          }
          setTargetReplyId(undefined);
        }
      })();
    }
  }, [targetReplyId, courseId, reviews, repliesByReview, setReviews]);

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
  const handleReplyToReply = React.useCallback((reviewId: string, target: CourseReviewReply) => {
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
        ...(replyToUserByReview[reviewId]?.id ? { replyToUserId: replyToUserByReview[reviewId]?.id } : {}),
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
      
      // Navigate to the newly created reply
      window.location.hash = `#reply-${reply.id}`;
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

  // Helper: reload reviews with current filters from server (via unified hook)
  const reloadReviews = React.useCallback(async (): Promise<void> => {
    if (!course) {
      console.warn('reloadReviews called before course loaded');
      return;
    }
    const params = buildReviewsParams();
    if (params) resetReviews(params);
  }, [course, buildReviewsParams, resetReviews]);

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

  // Backend returns total reviews count (including text-only) in rating.reviewsCount
  const displayRating = React.useMemo(() => {
    return course?.rating ?? { score: 0, reviewsCount: 0, recommendCount: 0, notRecommendCount: 0 };
  }, [course?.rating]);


  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNavigation showBackButton onBackClick={() => router.back()} />
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
      <SiteNavigation showBackButton onBackClick={() => router.back()} />
      <main className="w-full py-8">
        <div className="w-full p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 gap-6 pt-2">
            <div className="px-4">
              <CourseDetailCard
                courseId={course.courseId}
                subjectCode={course.subjectCode}
                title={course.title}
                term={course.term}
                terms={course.terms}
                rating={displayRating}
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
                      <div key={review.id} id={`review-${review.id}`} className="space-y-0.5">
                        {/* Review card */}
                        <CourseReviewCard
                          review={review}
                          onLike={handleLikeReview}
                          onToggleReplies={handleToggleReplies}
                          repliesExpanded={isExpanded}
                          onCreateReply={handleCreateReply}
                          onEdit={() => {
                            // Navigate to edit page with full form
                            router.push(`/courses/${course.courseId}/review?edit=1`);
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
                              const fresh = await fetchCourseById(courseId);
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
                                    {t('comment.reply')} @{replyToUserByReview[review.id]?.name}
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
                              <div key={r.id} id={`reply-${r.id}`}>
                                <CourseReviewReplyCard
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
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Infinite scroll sentinel for reviews */}
                  <div className="text-center pt-2">
                    <div ref={reviewsLoaderRef} className="h-6 w-full" aria-hidden="true" />
                    {reviewsLoadError && reviewsHasMore && (
                      <Button
                        className="mt-2"
                        variant="outline"
                        size="sm"
                        onClick={() => { setReviewsLoadError(false); loadMoreReviews(); }}
                      >
                        {t('common.loadFailedRetry')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Dialog open={missingDialog.open} onOpenChange={(open) => setMissingDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.note')}</DialogTitle>
            <DialogDescription>
              {missingDialog.message}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
