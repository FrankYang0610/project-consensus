import { apiGet, buildPaginationQuery } from './api-utils';
import type { ForumPost, ForumPostComment } from '@/types/forum';
import type { CourseReview } from '@/types/course';
import type { PaginatedResponse } from '@/types';

/**
 * Get the current user's forum posts (paginated)
 */
export async function getMyPosts(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<ForumPost>> {
  const qs = buildPaginationQuery(params);
  return apiGet<PaginatedResponse<ForumPost>>(`/api/accounts/my-posts/${qs}`);
}

/**
 * Get the current user's forum comments (paginated)
 */
export async function getMyComments(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<ForumPostComment>> {
  const qs = buildPaginationQuery(params);
  return apiGet<PaginatedResponse<ForumPostComment>>(`/api/accounts/my-comments/${qs}`);
}

/**
 * Get the current user's course reviews (paginated)
 */
export async function getMyReviews(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<CourseReview>> {
  const qs = buildPaginationQuery(params);
  return apiGet<PaginatedResponse<CourseReview>>(`/api/accounts/my-reviews/${qs}`);
}
