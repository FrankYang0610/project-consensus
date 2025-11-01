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
  phone?: string;
  office?: string;
  officeHours?: string;
  websiteName?: string;
  websiteUrl?: string; // external personal website (displayed on teacher profile)
  profileUrl?: string;
  scholarsHubUrl?: string;
  biography?: string;
  researchInterests?: string;
  academicAndProfessionalExperience?: string;
  professionalQualifications?: string;
  tags?: string[];
  languages?: string[]; // languages used in class
  yearsExperience?: number;
  orcid?: { id?: string; url?: string } | null;
  scopus?: { id?: string; url?: string } | null;
  researchId?: { id?: string; url?: string } | null;
  rating?: TeacherRating;
  courses?: TeacherCourseRef[];
  createdAt?: string;
  updatedAt?: string;
}
