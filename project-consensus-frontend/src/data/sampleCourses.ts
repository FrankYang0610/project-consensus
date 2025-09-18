export type SemesterKey = "spring" | "summer" | "fall";

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
        teachers: ["Dr. Lee", "Dr. Chan", "Dr. Cheung"],
        department: "APSS",
        lastUpdated: "2025-03-20T08:00:00Z",
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
        teachers: ["Prof. Lau", "Dr. Ma", "Dr. Tam", "Dr. Yu"],
        department: "COMP",
        lastUpdated: "2025-09-01T10:00:00Z",
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
        teachers: ["Dr. Wong", "Dr. Cheng"],
        department: "AMA",
        lastUpdated: "2024-04-10T12:40:00Z",
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
        teachers: ["Ms. Chan", "Mr. Lee"],
        department: "ELC",
        lastUpdated: "2025-06-18T09:30:00Z",
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
        teachers: ["Dr. Ho", "Dr. Lam"],
        department: "MM",
        lastUpdated: "2025-03-02T10:15:00Z",
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
        teachers: ["Dr. Lee", "Dr. Yip", "Dr. Poon", "Dr. Hui", "Dr. Ko"],
        department: "APSS",
        lastUpdated: "2024-10-08T16:00:00Z",
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


