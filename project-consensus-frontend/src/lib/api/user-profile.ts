import { apiPatch } from './api-utils';
import type { User } from '@/types/user';

/**
 * Update user profile (display name, avatar, pronouns)
 */
export async function updateProfile(data: {
  display_name?: string;
  avatar_url?: string;
  pronouns?: string;
  pronouns_shared?: boolean;
}): Promise<{ success: boolean; user: User }> {
  return await apiPatch<{ success: boolean; user: User }>(
    '/api/accounts/profile/',
    data
  );
}

/**
 * Update user privacy settings
 */
export async function updatePrivacySettings(data: {
  show_forum_posts_publicly?: boolean;
  show_forum_post_comments_publicly?: boolean;
  show_course_reviews_publicly?: boolean;
}): Promise<{ success: boolean; user: User }> {
  return await apiPatch<{ success: boolean; user: User }>(
    '/api/accounts/profile/',
    data
  );
}

