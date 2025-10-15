// MARK: ============ Forum post API types ============

// GET /api/forum/posts/ query parameters
export interface FetchForumPostsParams {
  page?: number;
  pageSize?: number;
  // Ordering tokens follow standard DRF ordering conventions:
  // - "-created_at": newest first
  // - "-likes_count": most liked first
  // - "-comments_count": most commented first
  // If omitted, server uses its default ordering (newest first with sensible tie-breakers).
  ordering?: string;
  search?: string; // search in title and content
  tags?: string[]; // filter by tags
  author?: string; // filter by author ID
  mine?: boolean; // only my posts
}

// POST /api/forum/posts/ payload
export interface CreateForumPostPayload {
  title: string;
  content: string;
  tags: string[];
  isAnonymous?: boolean;
}

// PATCH /api/forum/posts/:id/ payload
export interface UpdateForumPostPayload {
  title?: string;
  content?: string;
  tags?: string[];
  isAnonymous?: boolean;
}
