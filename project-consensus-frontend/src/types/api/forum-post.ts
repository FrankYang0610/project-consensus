// MARK: ============ Forum post API types ============

// GET /api/forum/posts/ query parameters
export interface FetchForumPostsParams {
  page?: number;
  pageSize?: number;
  ordering?: string; // created_at, -likes, -comments
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
