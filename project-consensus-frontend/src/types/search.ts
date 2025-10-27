// Search result types

export type SearchResultType =
  | 'course'
  | 'forum_post'
  | 'forum_comment'
  | 'course_review'
  | 'wiki'
  | 'teacher'
  | 'user';

export interface SearchResultMetadata {
  [key: string]: string | number | null | undefined;
  // Course metadata
  subject_code?: string;
  department?: string;
  rating?: number;

  // Forum/Review metadata
  parent_id?: string;
  parent_title?: string;
  author?: string;
  likes_count?: number;

  // Teacher metadata
  title?: string;
  reviews_count?: number;

  // Wiki metadata
  view_count?: number;
  updated_at?: string;

  // User metadata
  nickname?: string;
  avatar_url?: string;
  posts_count?: number;

  // Common
  created_at?: string;
}

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  snippet: string;
  url: string;
  metadata: SearchResultMetadata;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  page_size: number;
}

export interface SearchParams {
  q: string;
  page?: number;
  page_size?: number;
  types?: string; // comma-separated list
}

