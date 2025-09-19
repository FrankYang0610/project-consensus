/**
 * 课程与课程详情相关类型定义 / Course-related type definitions
 * 这些类型用于前端与后端API交互
 */

/**
 * 学期键 / Semester key
 */
export type SemesterKey = "spring" | "summer" | "fall";

/**
 * 教师信息 / Teacher information
 */
export interface TeacherInfo {
    name: string;
    avatarUrl?: string;
    homepageUrl?: string;
}

/**
 * 其他教师的同课程信息 / Other teacher's course info
 */
export interface OtherTeacherCourse {
    subjectId: string;
    teacherName: string;
    teacherAvatarUrl?: string;
    rating: {
        score: number;
        reviewsCount: number;
    };
    attributes: {
        difficulty: 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard';
        workload: 'light' | 'moderate' | 'heavy' | 'veryHeavy';
        grading: 'lenient' | 'balanced' | 'strict';
        gain: 'low' | 'decent' | 'high';
    };
}

/**
 * 课程评价信息 / Course review information
 */
export interface CourseReview {
    id: string; // 评价唯一标识符 / Review unique identifier
    subjectId: string; // 课程ID / Course ID
    author: {
        id: string; // 作者ID / Author ID
        name: string; // 作者姓名 / Author name  
        avatarUrl?: string; // 头像URL / Avatar URL
    };
    overallRating: number; // 总体评分 0.0 - 10.0 / Overall rating
    attributes: {
        difficulty: 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard';
        workload: 'light' | 'moderate' | 'heavy' | 'veryHeavy';
        grading: 'lenient' | 'balanced' | 'strict';
        gain: 'low' | 'decent' | 'high';
    };
    content: string; // 评价正文 / Review content
    likesCount: number; // 点赞数 / Number of likes
    createdAt: string | Date; // 发布时间 / Creation time
    updatedAt?: string | Date; // 编辑时间 / Last updated time
    isLiked?: boolean; // 当前用户是否点赞 / Whether current user liked
    term?: {
        year: number;
        semester: SemesterKey;
    }; // 上课学期 / Course term
    repliesCount?: number; // 回复数量 / Number of replies
}

/**
 * 课程基础信息 / Course basic information
 */
export interface Course {
    subjectId: string;
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
    };
    attributes: {
        difficulty: 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard';
        workload: 'light' | 'moderate' | 'heavy' | 'veryHeavy';
        grading: 'lenient' | 'balanced' | 'strict';
        gain: 'low' | 'decent' | 'high';
    };
    teachers: TeacherInfo[];
    department?: string;
    lastUpdated?: string | Date;
    // Course metadata
    selectionCategory?: string;
    teachingType?: string;
    courseCategory?: string;
    offeringDepartment?: string;
    level?: string;
    credits?: number | string;
    courseHomepageUrl?: string;
    syllabusUrl?: string;
    // Other teachers teaching the same course
    otherTeacherCourses?: OtherTeacherCourse[];
}
