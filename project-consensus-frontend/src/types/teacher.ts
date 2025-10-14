/**
 * Teacher-related type definitions
 */

/**
 * Teacher rating metrics (0.0 - 10.0 where applicable)
 */
export interface TeacherRating {
  overall: number;
  difficulty?: number;
  friendliness?: number;
  clarity?: number;
  grading?: 'lenient' | 'balanced' | 'strict' | 'killer';
  reviewsCount: number;
}

/**
 * Lightweight course reference taught by a teacher
 */
export interface TeacherCourseRef {
  courseId: string;
  subjectCode?: string;
  title?: string;
}

/**
 * Teacher entity
 */
export interface Teacher {
  id: string; // UUID string
  name: string;
  title?: string; // e.g., Professor, Dr.
  department?: string;
  avatarUrl?: string;
  email?: string;
  office?: string;
  officeHours?: string;
  homepageUrl?: string; // external personal homepage (displayed on teacher profile)
  bio?: string; // plain text or simple HTML
  tags?: string[]; // areas of expertise
  languages?: string[]; // languages used in class
  yearsExperience?: number;
  rating?: TeacherRating;
  courses?: TeacherCourseRef[];
  createdAt?: string;
  updatedAt?: string;
}
