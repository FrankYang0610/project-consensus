import { User } from './user';
import { ForumPost, ForumPostComment } from './forum';

/**
 * API response types aligned with backend accounts endpoints.
 */

// POST /api/accounts/send_verification_code/
export interface SendVerificationCodeResponse {
  success: boolean;
  message?: string;
}

// POST /api/accounts/register/
export interface RegisterSuccessResponse {
  success: true;
  user: User;
}

export interface ErrorResponse {
  message?: string;
  detail?: string;
}

// POST /api/accounts/login/
export interface LoginSuccessResponse {
  success: true;
  user: User;
}

export type RegisterResponse = RegisterSuccessResponse | ErrorResponse;
export type LoginApiResponse = LoginSuccessResponse | ErrorResponse;


// DRF paginated response
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ListPostsResponse = PaginatedResponse<ForumPost>
export type ListCommentsResponse = PaginatedResponse<ForumPostComment>

// GET /api/forum/comments/position?postId=..&commentId=..&page_size=..
export interface GetForumPostCommentPositionResponse {
  index: number;
  page: number; // 1-based page number where the comment resides
  pageSize: number;
  countBefore: number; // number of comments before the target
  pagesBefore: number; // page - 1
  totalCount: number; // total comments under the post
  pageUrls: string[]; // relative URLs for pages 1..page
}
