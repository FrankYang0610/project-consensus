import { apiGet } from './api-utils';
import type { ForumPost, ForumPostComment } from '@/types/forum';
import type { CourseReview } from '@/types/course';
import type { PaginatedResponse } from '@/types';

function buildQuery(params?: { page?: number; pageSize?: number }): string {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('page_size', String(params.pageSize));
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Get the current user's forum posts (paginated)
 */
export async function getMyPosts(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<ForumPost>> {
  const qs = buildQuery(params);
  return apiGet<PaginatedResponse<ForumPost>>(`/api/accounts/my-posts/${qs}`);
}

/**
 * Get the current user's forum comments (paginated)
 */
export async function getMyComments(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<ForumPostComment>> {
  const qs = buildQuery(params);
  return apiGet<PaginatedResponse<ForumPostComment>>(`/api/accounts/my-comments/${qs}`);
}

/**
 * Get the current user's course reviews (paginated)
 */
export async function getMyReviews(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<CourseReview>> {
  const qs = buildQuery(params);
  return apiGet<PaginatedResponse<CourseReview>>(`/api/accounts/my-reviews/${qs}`);
}
