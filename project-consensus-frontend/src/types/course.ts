/**
 * 课程与课程详情相关类型定义 / Course-related type definitions
 */

/**
 * 学期键 / Semester key
 */
export type SemesterKey = "spring" | "summer" | "fall";

/**
 * 投票状态 / Voting state
 */
export interface VotingState {
    userVote: 'recommend' | 'notRecommend' | null;
    recommendCount: number;
    notRecommendCount: number;
}

/**
 * 投票动作 / Voting action
 */
export type VotingAction =
    | { type: 'TOGGLE_VOTE'; voteType: 'recommend' | 'notRecommend' }
    | { type: 'RESET_VOTES'; recommendCount: number; notRecommendCount: number };

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
 * 课程详情卡片过滤器状态 / Filter state for course detail reviews
 */
export interface FilterState {
    sort: string;
    selectedTerms: Record<string, boolean>;
    ratingMin: number;
    ratingMax: number;
}

/**
 * 课程详情卡片过滤器回调 / Filter callbacks
 */
export interface FilterCallbacks {
    onSortChange: (value: string) => void;
    onTermsChange: (selected: Record<string, boolean>) => void;
    onRatingChange: (min: number, max: number) => void;
    onApplyFilters: () => void;
    onFilteredCountUpdate?: (filteredCount: number) => void;
}

/**
 * 课程详情卡片组件属性 / Props for CoursesDetailedCard
 */
export interface CoursesDetailedCardProps {
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
    className?: string;
    // Filter-related props
    filterState?: FilterState;
    filterCallbacks?: FilterCallbacks;
    // Other teachers teaching the same course
    otherTeacherCourses?: OtherTeacherCourse[];
}


