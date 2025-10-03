import type { SemesterKey, TeacherInfo } from '@/types';

// Local mapping to avoid circular import with sampleTeachers
const T = {
  WANG: { id: 'tch_3b9d6a54-3a5a-4e58-9e3d-1b2c4f5a6d71', name: 'Prof. Wang Yao Wu', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang' },
  LEE: { id: 'tch_b2a1c8f3-0a44-4d6c-9b8a-0c1d2e3f4a5b', name: 'Dr. Lee', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lee' },
  CHAN: { id: 'tch_c3d2e1f0-9a8b-4c7d-6e5f-4a3b2c1d0e9f', name: 'Dr. Chan', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=chan' },
  CHEUNG: { id: 'tch_d4e3f2a1-8b7c-6d5e-4f3a-2b1c0d9e8f7a', name: 'Dr. Cheung', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cheung' },
  LAU: { id: 'tch_e5f4a3b2-7c8d-9e0f-1a2b-3c4d5e6f7a8b', name: 'Prof. Lau', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lau' },
  MA: { id: 'tch_f6a5b4c3-2d1e-0f9a-8b7c-6d5e4f3a2b1c', name: 'Dr. Ma', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ma' },
  TAM: { id: 'tch_a7c6d5e4-3f2a-1b0c-9e8d-7c6b5a4f3e2d', name: 'Dr. Tam', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tam' },
  YU: { id: 'tch_b8d7e6f5-4a3b-2c1d-0e9f-8d7c6b5a4f3e', name: 'Dr. Yu', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yu' },
  MS_CHAN: { id: 'tch_7f9a3b1c-2d4e-5f6a-7b8c-9d0e1f2a3b4c', name: 'Ms. Chan' },
  MR_LEE: { id: 'tch_6e5d4c3b-2a1f-0e9d-8c7b-6a5f4e3d2c1b', name: 'Mr. Lee' },
  WONG: { id: 'tch_5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d', name: 'Dr. Wong' },
  CHENG: { id: 'tch_4b3c2d1e-0f9a-8b7c-6d5e-4f3a2b1c0d9e', name: 'Dr. Cheng' },
  HO: { id: 'tch_3c2d1e0f-9a8b-7c6d-5e4f-3a2b1c0d9e8f', name: 'Dr. Ho' },
  LAM: { id: 'tch_2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a', name: 'Dr. Lam' },
  NG: { id: 'tch_1e0f9a8b-7c6d-5e4f-3a2b-1c0d9e8f7a6b', name: 'Prof. Ng', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ng' },
  HUI: { id: 'tch_0f9a8b7c-6d5e-4f3a-2b1c-0d9e8f7a6b5c', name: 'Dr. Hui' },
  KO: { id: 'tch_9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d', name: 'Dr. Ko' },
  YIP: { id: 'tch_8c7d6e5f-4a3b-2c1d-0e9f-7a6b5c4d3e2f', name: 'Dr. Yip' },
  POON: { id: 'tch_7d6e5f4a-3b2c-1d0e-9f8a-6b5c4d3e2f1a', name: 'Dr. Poon' },
} as const;

export interface SampleCoursePreview {
  courseId: string; // unique stable course id
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
  teachers?: TeacherInfo[];
  department?: string;
  lastUpdated?: string;
  href?: string; // optional override; otherwise computed from courseId
}

export const sampleCourses: SampleCoursePreview[] = [
  {
    courseId: "crs_0001",
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
    teachers: [T.WANG],
    department: "APSS",
    lastUpdated: "2025-08-15T12:00:00Z",
  },
  {
    courseId: "crs_0002",
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
    teachers: [T.LEE],
    department: "APSS",
    lastUpdated: "2025-03-20T08:00:00Z",
  },
  {
    courseId: "crs_0002_chan", // 不同老师的同一门课
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
    teachers: [T.CHAN],
    department: "APSS",
    lastUpdated: "2025-03-18T14:30:00Z",
  },
  {
    courseId: "crs_0002_cheung", // 不同老师的同一门课
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
    teachers: [T.CHEUNG],
    department: "APSS",
    lastUpdated: "2025-03-25T11:00:00Z",
  },
  {
    courseId: "crs_0003",
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
    teachers: [T.LAU],
    department: "COMP",
    lastUpdated: "2025-09-01T10:00:00Z",
  },
  {
    courseId: "crs_0003_ma", // Dr. Ma's Programming Fundamentals
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
    teachers: [T.MA],
    department: "COMP",
    lastUpdated: "2025-08-28T15:20:00Z",
  },
  {
    courseId: "crs_0003_tam", // Dr. Tam's Programming Fundamentals
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
    teachers: [T.TAM],
    department: "COMP",
    lastUpdated: "2025-08-30T09:45:00Z",
  },
  {
    courseId: "crs_0003_yu", // Dr. Yu's Programming Fundamentals
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
    teachers: [T.YU],
    department: "COMP",
    lastUpdated: "2025-09-02T13:10:00Z",
  },
  {
    courseId: "crs_0004",
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
    teachers: [T.WONG],
    department: "AMA",
    lastUpdated: "2024-04-10T12:40:00Z",
  },
  {
    courseId: "crs_0004_cheng", // Dr. Cheng's Calculus II
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
    teachers: [T.CHENG],
    department: "AMA",
    lastUpdated: "2024-04-12T16:20:00Z",
  },
  {
    courseId: "crs_0005",
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
    teachers: [T.MS_CHAN],
    department: "ELC",
    lastUpdated: "2025-06-18T09:30:00Z",
  },
  {
    courseId: "crs_0005_lee", // Mr. Lee's Technical Writing
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
    teachers: [T.MR_LEE],
    department: "ELC",
    lastUpdated: "2025-06-20T14:45:00Z",
  },
  {
    courseId: "crs_0006",
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
    teachers: [T.HO],
    department: "MM",
    lastUpdated: "2025-03-02T10:15:00Z",
  },
  {
    courseId: "crs_0006_lam", // Dr. Lam's Manufacturing Processes
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
    teachers: [T.LAM],
    department: "MM",
    lastUpdated: "2025-03-05T08:30:00Z",
  },
  {
    courseId: "crs_0007",
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
    teachers: [T.LEE],
    department: "APSS",
    lastUpdated: "2024-10-08T16:00:00Z",
  },
  {
    courseId: "crs_0007_yip", // Dr. Yip's Community Engagement Project
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
    teachers: [T.YIP],
    department: "APSS",
    lastUpdated: "2024-10-10T11:30:00Z",
  },
  {
    courseId: "crs_0007_poon", // Dr. Poon's Community Engagement Project
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
    teachers: [T.POON],
    department: "APSS",
    lastUpdated: "2024-10-12T14:15:00Z",
  },
  {
    courseId: "crs_0007_hui", // Dr. Hui's Community Engagement Project
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
    teachers: [T.HUI],
    department: "APSS",
    lastUpdated: "2024-10-05T09:20:00Z",
  },
  {
    courseId: "crs_0007_ko", // Dr. Ko's Community Engagement Project
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
    teachers: [T.KO],
    department: "APSS",
    lastUpdated: "2024-10-07T12:45:00Z",
  },
  {
    courseId: "crs_0008",
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
    teachers: [T.WONG],
    department: "EEE",
    lastUpdated: "2025-02-22T09:00:00Z",
  },
  {
    courseId: "crs_0009",
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
    teachers: [T.NG],
    department: "ISE",
    lastUpdated: "2024-07-05T14:30:00Z",
  },
  {
    courseId: "crs_0010",
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
    teachers: [T.HO],
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
      course.courseId !== currentSubjectId
    )
    .map(course => ({
      courseId: course.courseId,
      teacherName: course.teachers?.[0]?.name || "Unknown",
      teacherAvatarUrl: undefined, // Resolve via teachers directory if needed
      rating: {
        score: course.rating.score,
        reviewsCount: course.rating.reviewsCount,
      },
      attributes: course.attributes,
    }));
}

/**
 * Get a course by subject ID
 * @param courseId The subject ID to find
 * @returns The course or undefined if not found
 */
export function getCourseById(courseId: string) {
  return sampleCourses.find(course => course.courseId === courseId);
}
