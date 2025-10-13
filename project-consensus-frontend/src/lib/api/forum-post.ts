import type {
  PaginatedResponse,
} from "@/types";
import type { ForumPost } from "@/types/forum";
import type {
  FetchForumPostsParams,
  CreateForumPostPayload,
  UpdateForumPostPayload,
} from "@/types/api";
import { apiGet, apiPost, apiPatch, apiDeleteVoid, HttpError } from "./api-utils";

/**
 * Fetch a single forum post by ID
 * @param postId - Post UUID
 * @param init - Optional fetch init options
 * @returns Forum post object or null if not found
 */
export async function fetchForumPostById(
  postId: string,
  init?: RequestInit
): Promise<ForumPost | null> {
  try {
    const data = await apiGet<ForumPost>(
      `/api/forum/posts/${encodeURIComponent(postId)}/`,
      init
    );
    return data ?? null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null; // Missing post is not an error
    }
    console.error(`Failed to fetch forum post ${postId}:`, error);
    return null;
  }
}

/**
 * Fetch forum posts with optional filters and pagination
 * @param params - Search and pagination parameters
 * @param init - Optional fetch init options
 * @returns Paginated forum post list
 */
export async function fetchForumPosts(
  params?: FetchForumPostsParams,
  init?: RequestInit
): Promise<PaginatedResponse<ForumPost>> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.pageSize) queryParams.set('page_size', String(params.pageSize));
  if (params?.ordering) queryParams.set('ordering', params.ordering);
  if (params?.search) queryParams.set('search', params.search);
  if (params?.tags && params.tags.length > 0) {
    params.tags.forEach((tag: string) => queryParams.append('tags', tag));
  }
  if (params?.author) queryParams.set('author', params.author);
  if (params?.mine) queryParams.set('mine', '1');

  const queryString = queryParams.toString();
  const url = `/api/forum/posts/${queryString ? `?${queryString}` : ''}`;
  return apiGet<PaginatedResponse<ForumPost>>(url, init);
}

/**
 * Create a new forum post
 * @param payload - Post creation data
 * @param init - Optional fetch init options
 * @returns Created forum post
 */
export async function createForumPost(
  payload: CreateForumPostPayload,
  init?: RequestInit
): Promise<ForumPost> {
  return apiPost<ForumPost>('/api/forum/posts/', payload, init);
}

/**
 * Update an existing forum post
 * @param postId - Post UUID
 * @param payload - Post update data
 * @param init - Optional fetch init options
 * @returns Updated forum post
 */
export async function updateForumPost(
  postId: string,
  payload: UpdateForumPostPayload,
  init?: RequestInit
): Promise<ForumPost> {
  return apiPatch<ForumPost>(
    `/api/forum/posts/${encodeURIComponent(postId)}/`,
    payload,
    init
  );
}

/**
 * Delete a forum post
 * @param postId - Post UUID
 * @param init - Optional fetch init options
 */
export async function deleteForumPost(
  postId: string,
  init?: RequestInit
): Promise<void> {
  return apiDeleteVoid(`/api/forum/posts/${encodeURIComponent(postId)}/`, init);
}

/**
 * Like a forum post
 * @param postId - Post UUID
 * @param init - Optional fetch init options
 * @returns Updated forum post with like status
 */
export async function likeForumPost(
  postId: string,
  init?: RequestInit
): Promise<ForumPost> {
  return apiPost<ForumPost>(
    `/api/forum/posts/${encodeURIComponent(postId)}/like/`,
    {},
    init
  );
}

/**
 * Unlike a forum post
 * @param postId - Post UUID
 * @param init - Optional fetch init options
 * @returns Updated forum post with like status
 */
export async function unlikeForumPost(
  postId: string,
  init?: RequestInit
): Promise<ForumPost> {
  return apiPost<ForumPost>(
    `/api/forum/posts/${encodeURIComponent(postId)}/unlike/`,
    {},
    init
  );
}

/**
 * Toggle like status of a forum post
 * @param postId - Post UUID
 * @param init - Optional fetch init options
 * @returns Updated forum post with like status
 */
export async function toggleLikeForumPost(
  postId: string,
  init?: RequestInit
): Promise<ForumPost> {
  return apiPost<ForumPost>(
    `/api/forum/posts/${encodeURIComponent(postId)}/toggle_like/`,
    {},
    init
  );
}
