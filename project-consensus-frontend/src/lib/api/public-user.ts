import { apiGet } from './api-utils';
import type { PublicUser } from '@/types/user';
import type { ForumPost, ForumPostComment } from '@/types/forum';
import type { CourseReview } from '@/types/course';

/**
 * Get public profile information for a specific user
 */
export async function getPublicUser(userId: string): Promise<PublicUser> {
  return await apiGet<PublicUser>(`/api/accounts/users/${userId}/`);
}

/**
 * Get public posts from a specific user
 */
export async function getPublicUserPosts(userId: string): Promise<ForumPost[]> {
  return await apiGet<ForumPost[]>(`/api/accounts/users/${userId}/posts/`);
}

/**
 * Get public comments from a specific user
 */
export async function getPublicUserComments(userId: string): Promise<ForumPostComment[]> {
  return await apiGet<ForumPostComment[]>(`/api/accounts/users/${userId}/comments/`);
}

/**
 * Get public reviews from a specific user
 */
export async function getPublicUserReviews(userId: string): Promise<CourseReview[]> {
  return await apiGet<CourseReview[]>(`/api/accounts/users/${userId}/reviews/`);
}

