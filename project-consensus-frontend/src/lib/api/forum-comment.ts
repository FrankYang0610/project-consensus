import type {
  PaginatedResponse,
} from "@/types";
import type { ForumPostComment } from "@/types/forum";
import type {
  FetchForumCommentsParams,
  CreateForumCommentPayload,
  UpdateForumCommentPayload,
  GetForumPostCommentPositionResponse,
} from "@/types/api";
import { apiGet, apiPost, apiPatch, apiDeleteVoid, HttpError } from "./api-utils";

export interface TranslatedForumComment {
  content: string;
}

/**
 * Fetch forum comments for a specific post
 * @param params - Query parameters including postId
 * @param init - Optional fetch init options
 * @returns Paginated forum comment list
 */
export async function fetchForumComments(
  params: FetchForumCommentsParams,
  init?: RequestInit
): Promise<PaginatedResponse<ForumPostComment>> {
  const queryParams = new URLSearchParams();
  
  queryParams.set('postId', params.postId);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.pageSize) queryParams.set('page_size', String(params.pageSize));
  if (params.ordering) queryParams.set('ordering', params.ordering);
  if (params.replyTo) queryParams.set('replyTo', params.replyTo);

  const queryString = queryParams.toString();
  const url = `/api/forum/comments/?${queryString}`;
  return apiGet<PaginatedResponse<ForumPostComment>>(url, init);
}

/**
 * Fetch a single forum comment by ID
 * @param commentId - Comment UUID
 * @param init - Optional fetch init options
 * @returns Forum comment object or null if not found
 */
export async function fetchForumCommentById(
  commentId: string,
  init?: RequestInit
): Promise<ForumPostComment | null> {
  try {
    const data = await apiGet<ForumPostComment>(
      `/api/forum/comments/${encodeURIComponent(commentId)}/`,
      init
    );
    return data ?? null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null; // Missing comment is not an error
    }
    console.error(`Failed to fetch forum comment ${commentId}:`, error);
    return null;
  }
}

/**
 * Create a new forum comment
 * @param payload - Comment creation data
 * @param init - Optional fetch init options
 * @returns Created forum comment
 */
export async function createForumComment(
  payload: CreateForumCommentPayload,
  init?: RequestInit
): Promise<ForumPostComment> {
  return apiPost<ForumPostComment>('/api/forum/comments/', payload, init);
}

/**
 * Update an existing forum comment
 * @param commentId - Comment UUID
 * @param payload - Comment update data
 * @param init - Optional fetch init options
 * @returns Updated forum comment
 */
export async function updateForumComment(
  commentId: string,
  payload: UpdateForumCommentPayload,
  init?: RequestInit
): Promise<ForumPostComment> {
  return apiPatch<ForumPostComment>(
    `/api/forum/comments/${encodeURIComponent(commentId)}/`,
    payload,
    init
  );
}

/**
 * Delete a forum comment
 * @param commentId - Comment UUID
 * @param init - Optional fetch init options
 */
export async function deleteForumComment(
  commentId: string,
  init?: RequestInit
): Promise<void> {
  return apiDeleteVoid(`/api/forum/comments/${encodeURIComponent(commentId)}/`, init);
}


/**
 * Translate a forum comment's content to the given language.
 * @param commentId - Comment UUID
 * @param uiLanguage - Frontend language code (e.g. "zh-CN", "en-US")
 */
export async function translateForumPostComment(
  commentId: string,
  uiLanguage: string,
): Promise<TranslatedForumComment> {
  const target_language = uiLanguage.startsWith("en") ? "en" : uiLanguage;
  return apiPost<TranslatedForumComment>(
    `/api/forum/comments/${encodeURIComponent(commentId)}/translate/`,
    { target_language },
  );
}

/**
 * Toggle like status for a forum comment.
 * If not liked, creates like; if already liked, removes like.
 */
export async function toggleLikeForumComment(
  commentId: string,
  init?: RequestInit
): Promise<ForumPostComment> {
  return apiPost<ForumPostComment>(
    `/api/forum/comments/${encodeURIComponent(commentId)}/toggle_like/`,
    {},
    init
  );
}

/**
 * Get the position of a specific comment within a post's comment list
 * @param postId - Post UUID
 * @param commentId - Comment UUID
 * @param pageSize - Page size for pagination calculation
 * @param init - Optional fetch init options
 * @returns Comment position information
 */
export async function getForumCommentPosition(
  postId: string,
  commentId: string,
  pageSize: number = 20,
  init?: RequestInit
): Promise<GetForumPostCommentPositionResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('postId', postId);
  queryParams.set('commentId', commentId);
  queryParams.set('page_size', String(pageSize));

  const url = `/api/forum/comments/position?${queryParams.toString()}`;
  return apiGet<GetForumPostCommentPositionResponse>(url, init);
}
