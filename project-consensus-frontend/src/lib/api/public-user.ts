import { apiGet } from './api-utils';
import type { PublicUser } from '@/types/user';
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
 * Get public profile information for a specific user
 */
export async function getPublicUser(userId: string): Promise<PublicUser> {
  return await apiGet<PublicUser>(`/api/accounts/users/${userId}/`);
}

/**
 * Get public posts from a specific user (paginated)
 */
export async function getPublicUserPosts(
  userId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<ForumPost>> {
  const qs = buildQuery(params);
  return await apiGet<PaginatedResponse<ForumPost>>(
    `/api/accounts/users/${userId}/posts/${qs}`,
  );
}

/**
 * Get public comments from a specific user (paginated)
 */
export async function getPublicUserComments(
  userId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<ForumPostComment>> {
  const qs = buildQuery(params);
  return await apiGet<PaginatedResponse<ForumPostComment>>(
    `/api/accounts/users/${userId}/comments/${qs}`,
  );
}

/**
 * Get public reviews from a specific user (paginated)
 */
export async function getPublicUserReviews(
  userId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<CourseReview>> {
  const qs = buildQuery(params);
  return await apiGet<PaginatedResponse<CourseReview>>(
    `/api/accounts/users/${userId}/reviews/${qs}`,
  );
}
