/**
 * Course-related type definitions
 */

/**
 * Semester key
 */
export type SemesterKey = "spring" | "summer" | "fall";

/**
 * Teacher information
 */
export interface TeacherInfo {
  id: string;             // Teacher UUID
  name: string;
  avatarUrl?: string;
  department?: string;
}

// Curriculum types (Phase 1 JSON field)
export type CurriculumYearLevel = 'y1' | 'y2' | 'y3' | 'y4' | 'y5';

export interface CurriculumSemester {
  id: string;
  year: number;
  semester: SemesterKey;
  url: string;
  yearLevel?: CurriculumYearLevel;
}

export interface CurriculumMajor {
  id: string;
  name: string;
  semesters: CurriculumSemester[];
}

export interface CurriculumCollege {
  id: string;
  name: string;
  majors: CurriculumMajor[];
}

/**
 * Other teacher's course info on the same course
 */
export interface OtherTeacherCourse {
  courseId: string;
  teacherName: string;
  teacherAvatarUrl?: string;
  rating: {
    score: number;
    reviewsCount: number;
  };
  attributes: {
    difficulty: 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard' | null;
    workload: 'light' | 'moderate' | 'heavy' | 'veryHeavy' | null;
    grading: 'lenient' | 'balanced' | 'strict' | 'killer' | null;
    gain: 'low' | 'decent' | 'high' | null;
  };
}

/**
 * Course review information
 */
export interface CourseReview {
  id: string;                   // Review unique identifier (UUID)
  courseId: string;             // Course ID (UUID string)
  courseSubjectCode?: string;   // Course subject code (e.g., APSS1A01)
  courseTitle?: string;         // Course title
  author: {
    id: string;                 // Author ID
    name: string;               // Author name  
    avatarUrl?: string;         // Avatar URL
  };
  isAnonymous?: boolean;        // Whether this review is anonymous. 
                                // If true and current viewer is not the author, backend will redact author.id to "".
                                // Frontend should display localized anonymous label accordingly.
  onlyText?: boolean;           // Text-only review (no scores/dimensions)
  overallRating?: number;       // Overall rating (undefined or 0 for onlyText reviews)
  attributes?: {
    difficulty: 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard';
    workload: 'light' | 'moderate' | 'heavy' | 'veryHeavy';
    grading: 'lenient' | 'balanced' | 'strict' | 'killer';
    gain: 'low' | 'decent' | 'high';
  } | null;
  content: string;              // Review content
  likesCount: number;           // Number of likes
  createdAt: string;            // Creation time
  updatedAt?: string;           // Last updated time
  isLiked?: boolean;            // Whether current user liked
  isEdited?: boolean;           // Whether review has been edited
  term?: {                      // Course term
    year: number;
    semester: SemesterKey;
  };
  repliesCount?: number;        // Number of replies
}

/**
 * Course basic information
 */
export interface Course {
  courseId: string;             // Backend UUID string
  subjectCode: string;
  title: string;
  term: {
    year: number;
    semester: SemesterKey;
  };
  terms?: Array<{
    year: number;
    semester: SemesterKey;
  }>;
  rating: {
    score: number; // 0.0 - 10.0
    reviewsCount: number;
    recommendCount?: number;
    notRecommendCount?: number;
    deletedReviewsCount?: number;
  };
  attributes: {
    difficulty: 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard' | null;
    workload: 'light' | 'moderate' | 'heavy' | 'veryHeavy' | null;
    grading: 'lenient' | 'balanced' | 'strict' | 'killer' | null;
    gain: 'low' | 'decent' | 'high' | null;
  };
  teachers?: TeacherInfo[];     // Backend should return teachers with both id and name for display and routing
  department?: string;
  lastUpdated?: string | Date;
  aiSummary?: string;           // AI generated course summary text. When empty or missing, UI should show a fallback.
  /* Course metadata */
  teachingType?: string;
  courseCategory?: string;
  offeringDepartment?: string;
  level?: string;
  credits?: number | string;
  courseHomepageUrl?: string;
  syllabusUrl?: string;
  otherTeacherCourses?: OtherTeacherCourse[];      // Other teachers teaching the same course
  curriculum?: CurriculumCollege[];                // Curriculum colleges/majors/semesters
  userVote?: 'recommend' | 'notRecommend' | null;  // Current user's vote on this course (detail only)
  userHasReview?: boolean;                         // Whether current user has already posted a review for this course (detail only)
}

/**
 * Course review reply information
 */
export interface CourseReviewReply {
  id: string;             // Reply unique identifier
  reviewId: string;       // Parent course review ID
  author: {
    id: string;           // Author ID
    name: string;         // Author name
    avatarUrl?: string;   // Optional avatar URL
  };
  content: string;        // Reply content (basic HTML allowed)
  createdAt: string;      // Creation time
  likes: number;          // Number of likes
  isLiked?: boolean;      // Whether current user liked this reply
  replyTo?: string;       // Optional: ID of the reply being replied to (if any)
  isDeleted?: boolean;    // Whether the reply is deleted
  isAnonymous?: boolean;  // Whether this reply is anonymous.
}
