import { apiGet } from "./api-utils";
import type { SearchResponse, SearchParams } from "@/types/search";
import { validateSearchQuery } from "@/lib/search-utils";

/**
 * Global search API with input validation
 * @param params - Search parameters including query, page, page_size, and types
 * @param init - Optional fetch init options
 */
export async function searchGlobal(
  params: SearchParams,
  init?: RequestInit
): Promise<SearchResponse> {
  // Validate and sanitize query on frontend
  const validation = validateSearchQuery(params.q);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid search query");
  }

  const q = new URLSearchParams();
  q.set('q', validation.sanitizedValue!);
  
  if (params.page) q.set('page', String(params.page));
  if (params.page_size) q.set('page_size', String(params.page_size));
  if (params.types) q.set('types', params.types);
  
  return apiGet<SearchResponse>(`/api/search/?${q.toString()}`, init);
}

/**
 * Quick search suggestions (limited results for dropdown)
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 5)
 * @param init - Optional fetch init options
 */
export async function searchSuggestions(
  query: string,
  limit: number = 5,
  init?: RequestInit
): Promise<SearchResponse> {
  return searchGlobal(
    {
      q: query,
      page: 1,
      page_size: limit
    },
    init
  );
}

