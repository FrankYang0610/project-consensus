// MARK: ============ Forum comment API types ============

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

// GET /api/forum/comments/ query parameters
export interface FetchForumCommentsParams {
  postId: string;
  page?: number;
  pageSize?: number;
  ordering?: string; // created_at, -likes
  replyTo?: string; // filter by parent comment ID
}

// POST /api/forum/comments/ payload
export interface CreateForumCommentPayload {
  content: string;
  postId: string;
  replyTo?: string; // parent comment ID for replies
  isAnonymous?: boolean;
}

// PATCH /api/forum/comments/:id/ payload
export interface UpdateForumCommentPayload {
  content?: string;
  isAnonymous?: boolean;
}
