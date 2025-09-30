import { User } from './user';
import { ForumPost, ForumPostComment } from './forum';


// MARK: ============ Accounts API types ============

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


// MARK: ============  Common list and pagination (including forum list) ============

// DRF paginated response
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}


// MARK: ============  Forum post and forum post comment API types ============

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


// MARK: ============ Course API types ============

// GET /api/reviews/ query parameters
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

// POST /api/courses/:id/reviews/ payload
export interface CreateCourseReviewPayload {
  onlyText?: boolean;
  overallRating?: number;
  attributes?: { difficulty: string; workload: string; grading: string; gain: string };
  content: string;
  isAnonymous?: boolean;
  term?: { year: number; semester: 'spring' | 'summer' | 'fall' };
}

// PATCH /api/reviews/:id/ payload
export type UpdateCourseReviewPayload = Partial<{
  content: string;
  isAnonymous: boolean;
  onlyText: boolean;
  overallRating: number;
  attributes: { difficulty: string; workload: string; grading: string; gain: string };
  term: { year: number; semester: 'spring' | 'summer' | 'fall' };
}>;

// GET /api/replies/ query parameters
export interface FetchReviewRepliesParams {
  reviewId: string;
  page?: number;
  pageSize?: number;
  ordering?: string; // created_at, -likes_count
}

// POST /api/replies/ payload
export interface CreateReplyPayload {
  content: string;
  replyToUserId?: string;
}

// Course vote types
export type CourseUserVote = 'recommend' | 'notRecommend' | null;

// POST /api/courses/:id/vote/ response
export interface VoteCourseResponse {
  subjectId: string;
  rating: { recommendCount: number; notRecommendCount: number };
  userVote: CourseUserVote;
}
