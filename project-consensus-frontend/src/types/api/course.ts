// MARK: ============ Course API types ============

// GET /api/courses/ query parameters
export interface FetchCoursesParams {
  page?: number;
  pageSize?: number;
  ordering?: string;
  subjectCode?: string;
  departments?: string[];
  category?: string;
  categories?: string[];
  level?: string[];
  search?: string;
}

// GET /api/reviews/ query parameters
export interface FetchCourseReviewsParams {
  courseId?: string; // Optional - when not provided, returns all reviews
  page?: number;
  pageSize?: number;
  ordering?: string; // created_at, -likes_count, overall_rating, etc.
  minRating?: number;
  maxRating?: number;
  termYear?: number;
  termSemester?: 'spring' | 'summer' | 'fall';
  mine?: boolean;
}

// POST /api/courses/:id/reviews/ payload
export interface CreateCourseReviewPayload {
  onlyText?: boolean;
  overallRating?: number;
  attributes?: { difficulty: string; workload: string; grading: string; gain: string };
  content: string;
  isAnonymous?: boolean;
  term?: { year: number; semester: 'spring' | 'summer' | 'fall' };
}

// PATCH /api/reviews/:id/ payload
export type UpdateCourseReviewPayload = Partial<{
  content: string;
  isAnonymous: boolean;
  onlyText: boolean;
  overallRating: number;
  attributes: { difficulty: string; workload: string; grading: string; gain: string };
  term: { year: number; semester: 'spring' | 'summer' | 'fall' };
}>;

// GET /api/replies/ query parameters
export interface FetchReviewRepliesParams {
  reviewId: string;
  page?: number;
  pageSize?: number;
  ordering?: string; // created_at, -likes_count
}

// POST /api/replies/ payload
export interface CreateReplyPayload {
  content: string;
  replyToUserId?: string;
}

// Course vote types
export type CourseUserVote = 'recommend' | 'notRecommend' | null;

// POST /api/courses/:id/vote/ response
export interface VoteCourseResponse {
  courseId: string;
  rating: { recommendCount: number; notRecommendCount: number };
  userVote: CourseUserVote;
}

// GET /api/courses/departments-with-counts/ response item
export interface CourseDepartmentWithCount {
  name: string;
  count: number;
}

// GET /api/courses/department-levels/ response item
export interface CourseLevelWithCount {
  level: string;
  count: number;
}

// Course browse page department data (UI state)
export interface CourseDepartmentData {
  name: string;
  count: number;
  levels?: CourseLevelWithCount[]; // Level distribution (lazy loaded)
  coursesByLevel?: Record<string, {
    courses: import('@/types').Course[];
    loading?: boolean;
    error?: boolean;
  }>; // Courses cached per level (lazy loaded)
  loading?: boolean; // Loading state for levels
  error?: boolean; // Error state for levels
}
