import type {
  Teacher,
  TeacherCourseRef,
  PaginatedResponse,
  FetchTeachersParams,
} from "@/types";
import { apiGet } from "./api-utils";

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
  const queryParams = new URLSearchParams();
  
  if (params?.q) queryParams.set('q', params.q);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.pageSize) queryParams.set('page_size', String(params.pageSize));
  if (params?.ordering) queryParams.set('ordering', params.ordering);

  const queryString = queryParams.toString();
  const url = `/api/teachers/${queryString ? `?${queryString}` : ''}`;
  
  try {
    return await apiGet<PaginatedResponse<Teacher>>(url, init);
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    // Return empty paginated response on error
    return {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  }
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

