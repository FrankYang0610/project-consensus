import { apiGet } from './api-utils';
import type { ForumPost, ForumPostComment } from '@/types/forum';
import type { CourseReview } from '@/types/course';

/**
 * Get the current user's forum posts
 */
export async function getMyPosts(): Promise<ForumPost[]> {
  const response = await apiGet<ForumPost[]>('/api/accounts/my-posts/');
  return response;
}

/**
 * Get the current user's forum comments
 */
export async function getMyComments(): Promise<ForumPostComment[]> {
  const response = await apiGet<ForumPostComment[]>('/api/accounts/my-comments/');
  return response;
}

/**
 * Get the current user's course reviews
 */
export async function getMyReviews(): Promise<CourseReview[]> {
  const response = await apiGet<CourseReview[]>('/api/accounts/my-reviews/');
  return response;
}

