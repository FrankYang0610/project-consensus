import type { Course } from "@/types";

function apiBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export async function fetchCourseById(subjectId: string, init?: RequestInit): Promise<Course | null> {
  const base = apiBase();
  const url = `${base}/api/courses/${encodeURIComponent(subjectId)}/`;
  try {
    const res = await fetch(url, { ...init, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data as Course;
  } catch (e) {
    return null;
  }
}

export interface FetchCoursesParams {
  subjectCode?: string;
  department?: string;
  teacherId?: string;
  ordering?: string; // e.g., -last_updated, rating_score
  search?: string;   // mapped to `search` param
}

export async function fetchCourses(params: FetchCoursesParams = {}, init?: RequestInit): Promise<Course[]> {
  const base = apiBase();
  const q = new URLSearchParams();
  if (params.subjectCode) q.set('subjectCode', params.subjectCode);
  if (params.department) q.set('department', params.department);
  if (params.teacherId) q.set('teacherId', params.teacherId);
  if (params.ordering) q.set('ordering', params.ordering);
  if (params.search) q.set('search', params.search);
  const url = `${base}/api/courses/${q.toString() ? `?${q}` : ''}`;
  try {
    const res = await fetch(url, { ...init, cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    // If paginated in future, adapt here. Currently expecting plain list.
    return Array.isArray(data) ? (data as Course[]) : (data?.results ?? []);
  } catch (e) {
    return [];
  }
}
