/**
 * 类型定义统一导出 / Unified type definitions export
 * 
 * 这个文件作为类型定义的统一入口点，重新导出各个模块的类型定义
 * 只包含前端与后端API交互所需的数据结构
 * This file serves as a unified entry point for type definitions, re-exporting types from various modules
 * Only includes data structures needed for frontend-backend API interaction
 */

// 用户相关类型 / User-related types
export type { User, PublicUser, Author, UserStats } from './user';

// 验证相关类型 / Validation-related types
export type { ValidationResult } from './validation';

// 论坛相关类型 / Forum-related types
export type { ForumPost } from './forum';

// 应用全局状态相关类型 / App global state related types
export type { AppContextType, LoginResponse, ThemeMode, Language } from './app-types';

// 课程相关类型 / Course-related types
export type {
  SemesterKey,
  TeacherInfo,
  OtherTeacherCourse,
  CourseReview,
  CourseReviewReply,
  Course,
  CurriculumYearLevel,
  CurriculumSemester,
  CurriculumMajor,
  CurriculumCollege,
} from './course';

// 教师相关类型 / Teacher-related types
export type {
  Teacher,
  TeacherRating,
  TeacherCourseRef,
} from './teacher';

// 搜索相关类型 / Search-related types
export type {
  SearchResult,
  SearchResponse,
  SearchResultType,
  SearchResultMetadata,
  SearchParams,
} from './search';

// API response types
export type {
  SendVerificationCodeResponse,
  RegisterResponse,
  LoginApiResponse,
  RegisterSuccessResponse,
  LoginSuccessResponse,
  ErrorResponse,
  PaginatedResponse,
  // Course API types
  FetchCoursesParams,
  FetchCourseReviewsParams,
  CreateCourseReviewPayload,
  UpdateCourseReviewPayload,
  FetchReviewRepliesParams,
  CreateReplyPayload,
  CourseUserVote,
  VoteCourseResponse,
  CourseDepartmentWithCount,
  CourseDepartmentData,
  // Teacher API types
  FetchTeachersParams,
  // Forum API types
  GetForumPostCommentPositionResponse,
  FetchForumPostsParams,
  CreateForumPostPayload,
  UpdateForumPostPayload,
  FetchForumCommentsParams,
  CreateForumCommentPayload,
  UpdateForumCommentPayload,
  // Notifications API types
  NotificationItem,
  NotificationSSEEvent,
} from './api';
