import { apiGet } from './api-utils';

export interface SiteStats {
  forumPosts: number;
  courses: number;
  courseReviews: number;
  teachers: number;
}

type ForumStatsResponse = {
  forumPosts?: number;
} | null;

type CourseStatsResponse = {
  courses?: number;
} | null;

type CourseReviewStatsResponse = {
  courseReviews?: number;
} | null;

type TeacherStatsResponse = {
  teachers?: number;
} | null;

/**
 * Aggregate site-wide statistics by delegating to each app's own stats endpoint.
 *
 * - Forum:    GET /api/forum/posts/stats/
 * - Courses:  GET /api/courses/stats/
 * - Reviews:  GET /api/reviews/stats/
 * - Teachers: GET /api/teachers/stats/
 */
export async function fetchSiteStats(init?: RequestInit): Promise<SiteStats> {
  const commonInit: RequestInit | undefined = init
    ? { ...init }
    : undefined;

  const [forum, course, courseReview, teacher] = await Promise.all([
    apiGet<ForumStatsResponse>('/api/forum/posts/stats/', commonInit).catch(() => null),
    apiGet<CourseStatsResponse>('/api/courses/stats/', commonInit).catch(() => null),
    apiGet<CourseReviewStatsResponse>('/api/reviews/stats/', commonInit).catch(() => null),
    apiGet<TeacherStatsResponse>('/api/teachers/stats/', commonInit).catch(() => null),
  ]);

  return {
    forumPosts: typeof forum?.forumPosts === 'number' ? forum.forumPosts : 0,
    courses: typeof course?.courses === 'number' ? course.courses : 0,
    courseReviews: typeof courseReview?.courseReviews === 'number' ? courseReview.courseReviews : 0,
    teachers: typeof teacher?.teachers === 'number' ? teacher.teachers : 0,
  };
}

