import type {
  Course,
  CourseReview,
  CourseReviewReply,
  PaginatedResponse,
  FetchCoursesParams,
  FetchCourseReviewsParams,
  CreateCourseReviewPayload,
  UpdateCourseReviewPayload,
  FetchReviewRepliesParams,
  CreateReplyPayload,
  VoteCourseResponse,
  CourseDepartmentWithCount,
  CourseLevelWithCount,
} from "@/types";
import { apiGet, apiPost, apiPatch, apiDeleteVoid } from "./api-utils";

export async function fetchCourses(params: FetchCoursesParams, init?: RequestInit): Promise<PaginatedResponse<Course>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('page_size', String(params.pageSize));
  if (params.ordering) q.set('ordering', params.ordering);
  if (params.subjectCode) q.set('subjectCode', params.subjectCode);
  (params.department || []).forEach((d) => q.append('department', d));
  if (params.category) q.set('category', params.category);
  (params.categories || []).forEach((c) => q.append('categories', c));
  (params.level || []).forEach((lv) => q.append('level', lv));
  if (params.search) q.set('search', params.search);
  return apiGet<PaginatedResponse<Course>>(`/api/courses/?${q.toString()}`, init);
}

export async function fetchCourseById(courseId: string, init?: RequestInit): Promise<Course | null> {
  try {
    const data = await apiGet<Course>(`/api/courses/${encodeURIComponent(courseId)}/`, init);
    return data ?? null;
  } catch {
    return null;
  }
}

// Note: legacy fetchCourses() removed. Use paginated requests via apiGet on `/api/courses/`.

// ---------------- Reviews API (paginated) ----------------

export async function fetchCourseReviews(params: FetchCourseReviewsParams, init?: RequestInit): Promise<PaginatedResponse<CourseReview>> {
  const q = new URLSearchParams();
  q.set('courseId', params.courseId);
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

export async function createCourseReview(courseId: string, payload: CreateCourseReviewPayload): Promise<CourseReview> {
  return apiPost<CourseReview>(`/api/courses/${encodeURIComponent(courseId)}/reviews/`, payload);
}

// ---------------- Replies API (paginated) ----------------

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

export async function createReviewReply(reviewId: string, payload: CreateReplyPayload): Promise<CourseReviewReply> {
  return apiPost<CourseReviewReply>(`/api/replies/`, { reviewId, ...payload });
}

export async function deleteReviewReply(replyId: string): Promise<void> {
  return apiDeleteVoid(`/api/replies/${encodeURIComponent(replyId)}/`);
}

export async function deleteCourseReview(reviewId: string): Promise<void> {
  return apiDeleteVoid(`/api/reviews/${encodeURIComponent(reviewId)}/`);
}

export async function fetchCourseReviewById(reviewId: string): Promise<CourseReview> {
  return apiGet<CourseReview>(`/api/reviews/${encodeURIComponent(reviewId)}/`);
}

export async function findReviewByReplyId(replyId: string): Promise<{ replyId: string; reviewId: string; courseId: string }> {
  return apiGet<{ replyId: string; reviewId: string; courseId: string }>(
    `/api/replies/find-review/?replyId=${encodeURIComponent(replyId)}`
  );
}

// ---------------- Course vote API ----------------

export async function voteCourse(courseId: string, voteType: 'recommend' | 'notRecommend'): Promise<VoteCourseResponse> {
  return apiPost<VoteCourseResponse>(`/api/courses/${encodeURIComponent(courseId)}/vote/`, { voteType });
}

// ---------------- Review update API ----------------

export async function updateCourseReview(reviewId: string, payload: UpdateCourseReviewPayload): Promise<CourseReview> {
  return apiPatch<CourseReview>(`/api/reviews/${encodeURIComponent(reviewId)}/`, payload);
}

// ---------------- Meta: departments list (for filters) ----------------
export async function fetchCourseDepartments(): Promise<string[]> {
  const res = await apiGet<{ departments: string[] }>(`/api/courses/departments/`);
  return Array.isArray(res?.departments) ? res.departments : [];
}

// ---------------- Optimized: departments with counts (for browse page) ----------------
export async function fetchCourseDepartmentsWithCounts(init?: RequestInit): Promise<CourseDepartmentWithCount[]> {
  const res = await apiGet<{ departments: CourseDepartmentWithCount[] }>(`/api/courses/departments-with-counts/`, init);
  return Array.isArray(res?.departments) ? res.departments : [];
}

// ---------------- Optimized: department levels with counts (for browse page) ----------------
export async function fetchDepartmentLevels(department: string, init?: RequestInit): Promise<CourseLevelWithCount[]> {
  const q = new URLSearchParams();
  q.set('department', department);
  const res = await apiGet<{ levels: CourseLevelWithCount[] }>(`/api/courses/department-levels/?${q.toString()}`, init);
  return Array.isArray(res?.levels) ? res.levels : [];
}
