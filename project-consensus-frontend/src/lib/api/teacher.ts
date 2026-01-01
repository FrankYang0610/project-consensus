import type {
  Teacher,
  TeacherCourseRef,
  PaginatedResponse,
  FetchTeachersParams,
} from "@/types";
import { apiGet, HttpError } from "./api-utils";

export interface TeacherStats {
  teachers: number;
}

/**
 * Fetch teacher stats (total count)
 * @param init - Optional fetch init options
 * @returns Teacher stats object
 */
export async function fetchTeacherStats(
  init?: RequestInit
): Promise<TeacherStats> {
  return apiGet<TeacherStats>("/api/teachers/stats/", init);
}

/**
 * Fetch a single teacher by ID
 * @param teacherId - Teacher UUID
 * @param init - Optional fetch init options
 * @returns Teacher object or null if not found
 */
export async function fetchTeacherById(
  teacherId: string,
  init?: RequestInit
): Promise<Teacher | null> {
  try {
    const data = await apiGet<Teacher>(
      `/api/teachers/${encodeURIComponent(teacherId)}/`,
      init
    );
    return data ?? null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null; // Missing teacher is not an error
    }
    console.error(`Failed to fetch teacher ${teacherId}:`, error);
    return null;
  }
}

/**
 * Fetch courses taught by a specific teacher
 * @param teacherId - Teacher UUID
 * @param init - Optional fetch init options
 * @returns Array of course references
 */
export async function fetchTeacherCourses(
  teacherId: string,
  init?: RequestInit
): Promise<TeacherCourseRef[]> {
  try {
    const data = await apiGet<TeacherCourseRef[]>(
      `/api/teachers/${encodeURIComponent(teacherId)}/courses/`,
      init
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return []; // Missing teacher courses is not an error
    }
    console.error(`Failed to fetch courses for teacher ${teacherId}:`, error);
    return [];
  }
}

/**
 * Search/list teachers with optional filters and pagination
 * @param params - Search and pagination parameters
 * @param init - Optional fetch init options
 * @returns Paginated teacher list
 */
export async function fetchTeachers(
  params?: FetchTeachersParams,
  init?: RequestInit
): Promise<PaginatedResponse<Teacher>> {
  const q = params?.q?.trim();
  const page = Math.max(params?.page ?? 1, 1);
  const pageSize = Math.max(params?.pageSize ?? 20, 1);
  const ordering = params?.ordering;

  const buildListUrl = () => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    qs.set('page', String(page));
    qs.set('page_size', String(pageSize));
    if (ordering) qs.set('ordering', ordering);
    return `/api/teachers/?${qs.toString()}`;
  };

  if (q) {
    try {
      // Prefer backend-paginated Splink endpoint to mirror forum pagination behavior
      const qs = new URLSearchParams();
      qs.set('q', q);
      qs.set('page', String(page));
      qs.set('page_size', String(pageSize));
      return apiGet<PaginatedResponse<Teacher>>(
        `/api/teachers/search-splink/?${qs.toString()}`,
        init
      );
    } catch {
      return apiGet<PaginatedResponse<Teacher>>(buildListUrl(), init);
    }
  }

  return apiGet<PaginatedResponse<Teacher>>(buildListUrl(), init);
}

/**
 * Search teachers by name or department (simplified non-paginated version)
 * @param query - Search query string
 * @param init - Optional fetch init options
 * @returns Array of matching teachers
 */
export async function searchTeachers(
  query: string,
  init?: RequestInit
): Promise<Teacher[]> {
  try {
    // Fetch with large page size to get all results for simple search
    const response = await fetchTeachers(
      { q: query, pageSize: 100 },
      init
    );
    return response.results;
  } catch (error) {
    console.error('Failed to search teachers:', error);
    return [];
  }
}

