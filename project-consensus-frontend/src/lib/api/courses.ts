import type { Course, CourseReview, CourseReviewReply, PaginatedResponse } from "@/types";
import { apiGet, apiPost, apiPatch, ensureCSRFCookie, getCookie, getAPIBaseUrl } from "@/lib/utils";

export async function fetchCourseById(subjectId: string, init?: RequestInit): Promise<Course | null> {
  try {
    const data = await apiGet<Course>(`/api/courses/${encodeURIComponent(subjectId)}/`, init);
    return data ?? null;
  } catch {
    return null;
  }
}

// Note: legacy fetchCourses() removed. Use paginated requests via apiGet on `/api/courses/`.

// ---------------- Reviews API (paginated) ----------------

export interface FetchCourseReviewsParams {
  subjectId: string;
  page?: number;
  pageSize?: number;
  ordering?: string; // created_at, -likes_count, overall_rating, etc.
  minRating?: number;
  maxRating?: number;
  termYear?: number;
  termSemester?: 'spring' | 'summer' | 'fall';
  mine?: boolean;
}

export async function fetchCourseReviews(params: FetchCourseReviewsParams, init?: RequestInit): Promise<PaginatedResponse<CourseReview>> {
  const q = new URLSearchParams();
  q.set('subjectId', params.subjectId);
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('page_size', String(params.pageSize));
  if (params.ordering) q.set('ordering', params.ordering);
  if (typeof params.minRating === 'number') q.set('minRating', String(params.minRating));
  if (typeof params.maxRating === 'number') q.set('maxRating', String(params.maxRating));
  if (params.termYear) q.set('termYear', String(params.termYear));
  if (params.termSemester) q.set('termSemester', params.termSemester);
  if (params.mine) q.set('mine', '1');
  const url = `/api/reviews/?${q.toString()}`;
  return apiGet<PaginatedResponse<CourseReview>>(url, init);
}

export async function toggleLikeReview(reviewId: string): Promise<CourseReview> {
  return apiPost<CourseReview>(`/api/reviews/${encodeURIComponent(reviewId)}/toggle_like/`, {});
}

export async function likeReview(reviewId: string): Promise<CourseReview> {
  return apiPost<CourseReview>(`/api/reviews/${encodeURIComponent(reviewId)}/like/`, {});
}

export async function unlikeReview(reviewId: string): Promise<CourseReview> {
  return apiPost<CourseReview>(`/api/reviews/${encodeURIComponent(reviewId)}/unlike/`, {});
}

export interface CreateCourseReviewPayload {
  onlyText?: boolean;
  overallRating?: number;
  attributes?: { difficulty: string; workload: string; grading: string; gain: string };
  content: string;
  isAnonymous?: boolean;
  term?: { year: number; semester: 'spring' | 'summer' | 'fall' };
}

export async function createCourseReview(subjectId: string, payload: CreateCourseReviewPayload): Promise<CourseReview> {
  return apiPost<CourseReview>(`/api/courses/${encodeURIComponent(subjectId)}/reviews/`, payload);
}

// ---------------- Replies API (paginated) ----------------

export interface FetchReviewRepliesParams {
  reviewId: string;
  page?: number;
  pageSize?: number;
  ordering?: string; // created_at, -likes_count
}

export async function fetchReviewReplies(params: FetchReviewRepliesParams, init?: RequestInit): Promise<PaginatedResponse<CourseReviewReply>> {
  const q = new URLSearchParams();
  q.set('review', params.reviewId);
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('page_size', String(params.pageSize));
  if (params.ordering) q.set('ordering', params.ordering);
  return apiGet<PaginatedResponse<CourseReviewReply>>(`/api/replies/?${q.toString()}`, init);
}

export async function toggleLikeReply(replyId: string): Promise<CourseReviewReply> {
  return apiPost<CourseReviewReply>(`/api/replies/${encodeURIComponent(replyId)}/toggle_like/`, {});
}

export async function likeReply(replyId: string): Promise<CourseReviewReply> {
  return apiPost<CourseReviewReply>(`/api/replies/${encodeURIComponent(replyId)}/like/`, {});
}

export async function unlikeReply(replyId: string): Promise<CourseReviewReply> {
  return apiPost<CourseReviewReply>(`/api/replies/${encodeURIComponent(replyId)}/unlike/`, {});
}

export interface CreateReplyPayload {
  content: string;
  replyToUserId?: string;
}

export async function createReviewReply(reviewId: string, payload: CreateReplyPayload): Promise<CourseReviewReply> {
  return apiPost<CourseReviewReply>(`/api/replies/`, { reviewId, ...payload });
}

export async function deleteReviewReply(replyId: string): Promise<void> {
  // Local helper to send CSRF-protected DELETE
  const base = getAPIBaseUrl();
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await ensureCSRFCookie();
    csrftoken = getCookie('csrftoken');
  }
  const res = await fetch(`${base}/api/replies/${encodeURIComponent(replyId)}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE replies failed: ${res.status} ${text}`);
  }
}

export async function deleteCourseReview(reviewId: string): Promise<void> {
  const base = getAPIBaseUrl();
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await ensureCSRFCookie();
    csrftoken = getCookie('csrftoken');
  }
  const res = await fetch(`${base}/api/reviews/${encodeURIComponent(reviewId)}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE review failed: ${res.status} ${text}`);
  }
}

// ---------------- Course vote API ----------------

export type CourseUserVote = 'recommend' | 'notRecommend' | null;
export interface VoteCourseResponse {
  subjectId: string;
  rating: { recommendCount: number; notRecommendCount: number };
  userVote: CourseUserVote;
}

export async function voteCourse(subjectId: string, voteType: 'recommend' | 'notRecommend'): Promise<VoteCourseResponse> {
  return apiPost<VoteCourseResponse>(`/api/courses/${encodeURIComponent(subjectId)}/vote/`, { voteType });
}

// ---------------- Review update API ----------------
export type UpdateCourseReviewPayload = Partial<{
  content: string;
  isAnonymous: boolean;
  onlyText: boolean;
  overallRating: number;
  attributes: { difficulty: string; workload: string; grading: string; gain: string };
  term: { year: number; semester: 'spring' | 'summer' | 'fall' };
}>;

export async function updateCourseReview(reviewId: string, payload: UpdateCourseReviewPayload): Promise<CourseReview> {
  return apiPatch<CourseReview>(`/api/reviews/${encodeURIComponent(reviewId)}/`, payload);
}

// ---------------- Meta: departments list (for filters) ----------------
export async function fetchCourseDepartments(): Promise<string[]> {
  const res = await apiGet<{ departments: string[] }>(`/api/courses/departments/`);
  return Array.isArray(res?.departments) ? res.departments : [];
}
