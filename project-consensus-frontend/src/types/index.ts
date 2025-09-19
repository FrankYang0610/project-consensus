/**
 * 类型定义统一导出 / Unified type definitions export
 * 
 * 这个文件作为类型定义的统一入口点，重新导出各个模块的类型定义
 * This file serves as a unified entry point for type definitions, re-exporting types from various modules
 */

// 用户相关类型 / User-related types
export type { User, Author } from './user';

// 论坛相关类型 / Forum-related types
export type { ForumPost } from './forum';

// 应用全局状态相关类型 / App global state related types
export type { AppContextType, LoginResponse, ThemeMode, Language } from './app-types';

// 课程相关类型 / Course-related types
export type {
  SemesterKey,
  VotingState,
  VotingAction,
  TeacherInfo,
  OtherTeacherCourse,
  FilterState,
  FilterCallbacks,
  CoursesPreviewCardProps,
  CoursesDetailedCardProps,
  CourseReview,
  CourseReviewCardProps,
} from './course';
