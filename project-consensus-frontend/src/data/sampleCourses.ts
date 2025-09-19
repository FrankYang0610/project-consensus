import type { SemesterKey } from '@/types';

export interface SampleCoursePreview {
    subjectId: string; // unique stable course id
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
    };
    attributes: {
        difficulty: "veryEasy" | "easy" | "medium" | "hard" | "veryHard";
        workload: "light" | "moderate" | "heavy" | "veryHeavy";
        grading: "lenient" | "balanced" | "strict";
        gain: "low" | "decent" | "high";
    };
    teachers?: string[];
    department?: string;
    lastUpdated?: string;
    href?: string; // optional override; otherwise computed from subjectId
}

export const sampleCourses: SampleCoursePreview[] = [
    {
        subjectId: "crs_0001",
        subjectCode: "APSS1A01",
        title: "Introduction to Social Sciences",
        term: { year: 2025, semester: "fall" },
        terms: [
            { year: 2025, semester: "fall" },
            { year: 2024, semester: "fall" },
            { year: 2024, semester: "spring" },
        ],
        rating: { score: 8.6, reviewsCount: 128 },
        attributes: {
            difficulty: "medium",
            workload: "moderate",
            grading: "balanced",
            gain: "decent",
        },
        teachers: ["Prof. Wang Yao Wu"],
        department: "APSS",
        lastUpdated: "2025-08-15T12:00:00Z",
    },
    {
        subjectId: "crs_0002",
        subjectCode: "APSS2B10",
        title: "Social Research Methods",
        term: { year: 2025, semester: "spring" },
        terms: [
            { year: 2025, semester: "spring" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 7.8, reviewsCount: 89 },
        attributes: {
            difficulty: "medium",
            workload: "heavy",
            grading: "balanced",
            gain: "high",
        },
        teachers: ["Dr. Lee"],
        department: "APSS",
        lastUpdated: "2025-03-20T08:00:00Z",
    },
    {
        subjectId: "crs_0002_chan", // 不同老师的同一门课
        subjectCode: "APSS2B10",
        title: "Social Research Methods",
        term: { year: 2025, semester: "spring" },
        terms: [
            { year: 2025, semester: "spring" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 7.5, reviewsCount: 67 }, // 不同的评分和评论数
        attributes: {
            difficulty: "medium",
            workload: "heavy", 
            grading: "strict", // 不同的评分标准
            gain: "high",
        },
        teachers: ["Dr. Chan"],
        department: "APSS",
        lastUpdated: "2025-03-18T14:30:00Z",
    },
    {
        subjectId: "crs_0002_cheung", // 不同老师的同一门课
        subjectCode: "APSS2B10",
        title: "Social Research Methods", 
        term: { year: 2025, semester: "spring" },
        terms: [
            { year: 2025, semester: "spring" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 8.1, reviewsCount: 54 }, // 不同的评分和评论数
        attributes: {
            difficulty: "hard", // 不同的难度评价
            workload: "heavy",
            grading: "balanced",
            gain: "decent", // 不同的收获评价
        },
        teachers: ["Dr. Cheung"],
        department: "APSS",
        lastUpdated: "2025-03-25T11:00:00Z",
    },
    {
        subjectId: "crs_0003",
        subjectCode: "COMP1011",
        title: "Programming Fundamentals",
        term: { year: 2025, semester: "fall" },
        terms: [
            { year: 2025, semester: "fall" },
            { year: 2025, semester: "summer" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 8.9, reviewsCount: 412 },
        attributes: {
            difficulty: "easy",
            workload: "moderate",
            grading: "lenient",
            gain: "high",
        },
        teachers: ["Prof. Lau"],
        department: "COMP",
        lastUpdated: "2025-09-01T10:00:00Z",
    },
    {
        subjectId: "crs_0003_ma", // Dr. Ma's Programming Fundamentals
        subjectCode: "COMP1011",
        title: "Programming Fundamentals",
        term: { year: 2025, semester: "fall" },
        terms: [
            { year: 2025, semester: "fall" },
            { year: 2025, semester: "summer" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 8.7, reviewsCount: 183 },
        attributes: {
            difficulty: "easy",
            workload: "light", // Dr. Ma给分更轻松
            grading: "lenient",
            gain: "high",
        },
        teachers: ["Dr. Ma"],
        department: "COMP",
        lastUpdated: "2025-08-28T15:20:00Z",
    },
    {
        subjectId: "crs_0003_tam", // Dr. Tam's Programming Fundamentals
        subjectCode: "COMP1011", 
        title: "Programming Fundamentals",
        term: { year: 2025, semester: "fall" },
        terms: [
            { year: 2025, semester: "fall" },
            { year: 2025, semester: "summer" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 9.1, reviewsCount: 156 },
        attributes: {
            difficulty: "medium", // Dr. Tam的课稍难一些
            workload: "moderate",
            grading: "balanced", // 更公平的评分
            gain: "high",
        },
        teachers: ["Dr. Tam"],
        department: "COMP", 
        lastUpdated: "2025-08-30T09:45:00Z",
    },
    {
        subjectId: "crs_0003_yu", // Dr. Yu's Programming Fundamentals
        subjectCode: "COMP1011",
        title: "Programming Fundamentals",
        term: { year: 2025, semester: "fall" },
        terms: [
            { year: 2025, semester: "fall" },
            { year: 2025, semester: "summer" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 8.5, reviewsCount: 203 },
        attributes: {
            difficulty: "easy",
            workload: "heavy", // Dr. Yu作业较多
            grading: "lenient",
            gain: "decent", // 收获中等
        },
        teachers: ["Dr. Yu"],
        department: "COMP",
        lastUpdated: "2025-09-02T13:10:00Z",
    },
    {
        subjectId: "crs_0004",
        subjectCode: "MATH2001",
        title: "Calculus II",
        term: { year: 2024, semester: "spring" },
        terms: [
            { year: 2024, semester: "spring" },
            { year: 2023, semester: "fall" },
        ],
        rating: { score: 6.5, reviewsCount: 236 },
        attributes: {
            difficulty: "hard",
            workload: "heavy",
            grading: "strict",
            gain: "decent",
        },
        teachers: ["Dr. Wong"],
        department: "AMA",
        lastUpdated: "2024-04-10T12:40:00Z",
    },
    {
        subjectId: "crs_0004_cheng", // Dr. Cheng's Calculus II
        subjectCode: "MATH2001",
        title: "Calculus II",
        term: { year: 2024, semester: "spring" },
        terms: [
            { year: 2024, semester: "spring" },
            { year: 2023, semester: "fall" },
        ],
        rating: { score: 7.2, reviewsCount: 154 }, // Dr. Cheng评分稍高
        attributes: {
            difficulty: "hard",
            workload: "moderate", // 作业量稍轻
            grading: "balanced", // 评分更公平
            gain: "high", // 收获更多
        },
        teachers: ["Dr. Cheng"],
        department: "AMA",
        lastUpdated: "2024-04-12T16:20:00Z",
    },
    {
        subjectId: "crs_0005",
        subjectCode: "ENG3003",
        title: "Technical Writing",
        term: { year: 2025, semester: "summer" },
        terms: [
            { year: 2025, semester: "summer" },
            { year: 2024, semester: "summer" },
        ],
        rating: { score: 8.1, reviewsCount: 142 },
        attributes: {
            difficulty: "medium",
            workload: "moderate",
            grading: "balanced",
            gain: "high",
        },
        teachers: ["Ms. Chan"],
        department: "ELC",
        lastUpdated: "2025-06-18T09:30:00Z",
    },
    {
        subjectId: "crs_0005_lee", // Mr. Lee's Technical Writing
        subjectCode: "ENG3003",
        title: "Technical Writing",
        term: { year: 2025, semester: "summer" },
        terms: [
            { year: 2025, semester: "summer" },
            { year: 2024, semester: "summer" },
        ],
        rating: { score: 7.8, reviewsCount: 87 },
        attributes: {
            difficulty: "easy", // Mr. Lee的课程更容易
            workload: "light", // 作业量较轻
            grading: "lenient", // 给分更宽松
            gain: "decent", // 收获中等
        },
        teachers: ["Mr. Lee"],
        department: "ELC",
        lastUpdated: "2025-06-20T14:45:00Z",
    },
    {
        subjectId: "crs_0006",
        subjectCode: "MM3005",
        title: "Manufacturing Processes",
        term: { year: 2025, semester: "spring" },
        terms: [
            { year: 2025, semester: "spring" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 7.2, reviewsCount: 98 },
        attributes: {
            difficulty: "medium",
            workload: "moderate",
            grading: "balanced",
            gain: "decent",
        },
        teachers: ["Dr. Ho"],
        department: "MM",
        lastUpdated: "2025-03-02T10:15:00Z",
    },
    {
        subjectId: "crs_0006_lam", // Dr. Lam's Manufacturing Processes
        subjectCode: "MM3005",
        title: "Manufacturing Processes",
        term: { year: 2025, semester: "spring" },
        terms: [
            { year: 2025, semester: "spring" },
            { year: 2024, semester: "fall" },
        ],
        rating: { score: 6.8, reviewsCount: 72 },
        attributes: {
            difficulty: "hard", // Dr. Lam的课程更难
            workload: "heavy", // 作业量更多
            grading: "strict", // 评分更严
            gain: "high", // 但收获更多
        },
        teachers: ["Dr. Lam"],
        department: "MM",
        lastUpdated: "2025-03-05T08:30:00Z",
    },
    {
        subjectId: "crs_0007",
        subjectCode: "APSS3C22",
        title: "Community Engagement Project",
        term: { year: 2024, semester: "fall" },
        terms: [
            { year: 2024, semester: "fall" },
            { year: 2023, semester: "spring" },
        ],
        rating: { score: 9.0, reviewsCount: 61 },
        attributes: {
            difficulty: "easy",
            workload: "light",
            grading: "lenient",
            gain: "high",
        },
        teachers: ["Dr. Lee"],
        department: "APSS",
        lastUpdated: "2024-10-08T16:00:00Z",
    },
    {
        subjectId: "crs_0007_yip", // Dr. Yip's Community Engagement Project
        subjectCode: "APSS3C22",
        title: "Community Engagement Project",
        term: { year: 2024, semester: "fall" },
        terms: [
            { year: 2024, semester: "fall" },
            { year: 2023, semester: "spring" },
        ],
        rating: { score: 8.7, reviewsCount: 43 },
        attributes: {
            difficulty: "easy",
            workload: "moderate", // 稍微多一些工作量
            grading: "lenient",
            gain: "decent", // 收获中等
        },
        teachers: ["Dr. Yip"],
        department: "APSS",
        lastUpdated: "2024-10-10T11:30:00Z",
    },
    {
        subjectId: "crs_0007_poon", // Dr. Poon's Community Engagement Project
        subjectCode: "APSS3C22",
        title: "Community Engagement Project",
        term: { year: 2024, semester: "fall" },
        terms: [
            { year: 2024, semester: "fall" },
            { year: 2023, semester: "spring" },
        ],
        rating: { score: 9.3, reviewsCount: 38 },
        attributes: {
            difficulty: "veryEasy", // Dr. Poon的课非常容易
            workload: "light",
            grading: "lenient", 
            gain: "high",
        },
        teachers: ["Dr. Poon"],
        department: "APSS",
        lastUpdated: "2024-10-12T14:15:00Z",
    },
    {
        subjectId: "crs_0007_hui", // Dr. Hui's Community Engagement Project
        subjectCode: "APSS3C22",
        title: "Community Engagement Project",
        term: { year: 2024, semester: "fall" },
        terms: [
            { year: 2024, semester: "fall" },
            { year: 2023, semester: "spring" },
        ],
        rating: { score: 8.9, reviewsCount: 52 },
        attributes: {
            difficulty: "medium", // Dr. Hui要求更高
            workload: "moderate",
            grading: "balanced", // 更公平评分
            gain: "high",
        },
        teachers: ["Dr. Hui"],
        department: "APSS",
        lastUpdated: "2024-10-05T09:20:00Z",
    },
    {
        subjectId: "crs_0007_ko", // Dr. Ko's Community Engagement Project
        subjectCode: "APSS3C22",
        title: "Community Engagement Project",
        term: { year: 2024, semester: "fall" },
        terms: [
            { year: 2024, semester: "fall" },
            { year: 2023, semester: "spring" },
        ],
        rating: { score: 8.5, reviewsCount: 47 },
        attributes: {
            difficulty: "easy",
            workload: "light",
            grading: "balanced", // Dr. Ko更客观
            gain: "decent",
        },
        teachers: ["Dr. Ko"],
        department: "APSS",
        lastUpdated: "2024-10-07T12:45:00Z",
    },
    {
        subjectId: "crs_0008",
        subjectCode: "EEE2B11",
        title: "Circuits and Systems",
        term: { year: 2025, semester: "spring" },
        terms: [
            { year: 2025, semester: "spring" },
            { year: 2024, semester: "spring" },
        ],
        rating: { score: 6.9, reviewsCount: 76 },
        attributes: {
            difficulty: "hard",
            workload: "heavy",
            grading: "strict",
            gain: "high",
        },
        teachers: ["Dr. Wong"],
        department: "EEE",
        lastUpdated: "2025-02-22T09:00:00Z",
    },
    {
        subjectId: "crs_0009",
        subjectCode: "ISE3C20",
        title: "Human-Computer Interaction",
        term: { year: 2024, semester: "summer" },
        terms: [
            { year: 2024, semester: "summer" },
            { year: 2023, semester: "summer" },
        ],
        rating: { score: 9.2, reviewsCount: 205 },
        attributes: {
            difficulty: "easy",
            workload: "light",
            grading: "lenient",
            gain: "high",
        },
        teachers: ["Prof. Ng"],
        department: "ISE",
        lastUpdated: "2024-07-05T14:30:00Z",
    },
    {
        subjectId: "crs_0010",
        subjectCode: "MM4D32",
        title: "Materials Science Fundamentals",
        term: { year: 2025, semester: "fall" },
        rating: { score: 7.4, reviewsCount: 53 },
        attributes: {
            difficulty: "medium",
            workload: "moderate",
            grading: "balanced",
            gain: "decent",
        },
        teachers: ["Dr. Ho"],
        department: "MM",
        lastUpdated: "2025-01-12T10:00:00Z",
    },
];

/**
 * Get other teachers teaching the same course (same subjectCode)
 * @param currentSubjectId Current course subject ID to exclude
 * @param subjectCode Course code to match
 * @returns Array of other teacher courses
 */
export function getOtherTeacherCourses(currentSubjectId: string, subjectCode: string) {
    return sampleCourses
        .filter(course => 
            course.subjectCode === subjectCode && 
            course.subjectId !== currentSubjectId
        )
        .map(course => ({
            subjectId: course.subjectId,
            teacherName: course.teachers?.[0] || "Unknown",
            teacherAvatarUrl: undefined, // Can be extended later
            rating: {
                score: course.rating.score,
                reviewsCount: course.rating.reviewsCount,
            },
            attributes: course.attributes,
        }));
}

/**
 * Get a course by subject ID
 * @param subjectId The subject ID to find
 * @returns The course or undefined if not found
 */
export function getCourseById(subjectId: string) {
    return sampleCourses.find(course => course.subjectId === subjectId);
}


