import type { SemesterKey } from "@/types";

// 第三级的学期条目 / Third-level: semesters
export interface CurriculumSemester {
  id: string;
  year: number;
  semester: SemesterKey; // 'spring' | 'summer' | 'fall'
  url: string; // 点击后跳转的链接
  yearLevel?: 'y1' | 'y2' | 'y3' | 'y4' | 'y5'; // 大一-大五 / Year 1-5
}

// 第二级的专业 / Second-level: majors
export interface CurriculumMajor {
  id: string;
  name: string;
  semesters: CurriculumSemester[];
}

// 第一级的学院 / First-level: colleges
export interface CurriculumCollege {
  id: string;
  name: string;
  majors: CurriculumMajor[];
}

// 示例数据（未来应由后端提供）/ Sample data (should come from backend later)
export const curriculumSampleData: CurriculumCollege[] = [
  {
    id: "eng",
    name: "Faculty of Engineering",
    majors: [
      {
        id: "cs",
        name: "Computer Science",
        semesters: [
          { id: "cs-2024-fall", year: 2024, semester: "fall", url: "/programs/eng/cs/2024-fall", yearLevel: 'y3' },
          { id: "cs-2025-spring", year: 2025, semester: "spring", url: "/programs/eng/cs/2025-spring", yearLevel: 'y3' },
        ],
      },
      {
        id: "ee",
        name: "Electrical Engineering",
        semesters: [
          { id: "ee-2024-fall", year: 2024, semester: "fall", url: "/programs/eng/ee/2024-fall", yearLevel: 'y2' },
          { id: "ee-2025-spring", year: 2025, semester: "spring", url: "/programs/eng/ee/2025-spring", yearLevel: 'y2' },
        ],
      },
    ],
  },
  {
    id: "fb",
    name: "Faculty of Business",
    majors: [
      {
        id: "acc",
        name: "Accounting",
        semesters: [
          { id: "acc-2024-fall", year: 2024, semester: "fall", url: "/programs/fb/acc/2024-fall", yearLevel: 'y1' },
          { id: "acc-2025-spring", year: 2025, semester: "spring", url: "/programs/fb/acc/2025-spring", yearLevel: 'y2' },
        ],
      },
      {
        id: "mkt",
        name: "Marketing",
        semesters: [
          { id: "mkt-2024-fall", year: 2024, semester: "fall", url: "/programs/fb/mkt/2024-fall", yearLevel: 'y4' },
          { id: "mkt-2025-spring", year: 2025, semester: "spring", url: "/programs/fb/mkt/2025-spring", yearLevel: 'y4' },
        ],
      },
    ],
  },
  {
    id: "fh",
    name: "Faculty of Humanities",
    majors: [
      {
        id: "ling",
        name: "Linguistics",
        semesters: [
          { id: "ling-2024-fall", year: 2024, semester: "fall", url: "/programs/fh/ling/2024-fall", yearLevel: 'y3' },
          { id: "ling-2025-spring", year: 2025, semester: "spring", url: "/programs/fh/ling/2025-spring", yearLevel: 'y3' },
        ],
      },
      {
        id: "trans",
        name: "Translation",
        semesters: [
          { id: "trans-2024-fall", year: 2024, semester: "fall", url: "/programs/fh/trans/2024-fall", yearLevel: 'y2' },
          { id: "trans-2025-spring", year: 2025, semester: "spring", url: "/programs/fh/trans/2025-spring", yearLevel: 'y2' },
        ],
      },
    ],
  },
];

// 根据课程或其他条件筛选（当前直接返回全量示例）/ Filter by subject (currently returns all)
export function getSampleCurriculumForSubject(_courseId?: string) {
  return curriculumSampleData;
}
