import type { Teacher, TeacherCourseRef } from '@/types';
import { sampleCourses } from '@/data/sample-courses';

/**
 * Sample teacher data with UUID identifiers
 */
export const sampleTeachers: Teacher[] = [
  {
    id: 'tch_3b9d6a54-3a5a-4e58-9e3d-1b2c4f5a6d71',
    name: 'Prof. Wang Yao Wu',
    title: 'Professor',
    department: 'APSS',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang',
    email: 'wang.yaowu@polyu.edu.hk',
    office: 'AG702',
    officeHours: 'Tue 14:00-16:00',
    homepageUrl: 'https://www.polyu.edu.hk/apss/',
    biography: 'Focus on social sciences and interdisciplinary research. Passionate about student mentorship and applied social research.',
    tags: ['Social Sciences', 'Research Methods', 'Mentorship'],
    languages: ['English', '普通话'],
    yearsExperience: 18,
    rating: { overall: 8.1, friendliness: 8.8, difficulty: 5.5, reviewsCount: 124, grading: 'lenient' },
  },
  // Additional teachers referenced by sampleCourses
  {
    id: 'tch_7f9a3b1c-2d4e-5f6a-7b8c-9d0e1f2a3b4c',
    name: 'Ms. Chan',
    title: 'Lecturer',
    department: 'ELC',
    languages: ['English'],
    rating: { overall: 7.9, reviewsCount: 142, grading: 'balanced' },
  },
  {
    id: 'tch_6e5d4c3b-2a1f-0e9d-8c7b-6a5f4e3d2c1b',
    name: 'Mr. Lee',
    title: 'Lecturer',
    department: 'ELC',
    languages: ['English'],
    rating: { overall: 7.8, reviewsCount: 87, grading: 'lenient' },
  },
  {
    id: 'tch_5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d',
    name: 'Dr. Wong',
    title: 'Lecturer',
    department: 'EEE',
    languages: ['English'],
    rating: { overall: 6.9, reviewsCount: 76, grading: 'strict' },
  },
  {
    id: 'tch_4b3c2d1e-0f9a-8b7c-6d5e-4f3a2b1c0d9e',
    name: 'Dr. Cheng',
    title: 'Lecturer',
    department: 'AMA',
    languages: ['English'],
    rating: { overall: 7.2, reviewsCount: 154, grading: 'balanced' },
  },
  {
    id: 'tch_8c7d6e5f-4a3b-2c1d-0e9f-7a6b5c4d3e2f',
    name: 'Dr. Yip',
    title: 'Lecturer',
    department: 'APSS',
    languages: ['English', '廣東話'],
    rating: { overall: 8.7, reviewsCount: 43, grading: 'lenient' },
  },
  {
    id: 'tch_7d6e5f4a-3b2c-1d0e-9f8a-6b5c4d3e2f1a',
    name: 'Dr. Poon',
    title: 'Lecturer',
    department: 'APSS',
    languages: ['English'],
    rating: { overall: 9.3, reviewsCount: 38, grading: 'lenient' },
  },
  {
    id: 'tch_0f9a8b7c-6d5e-4f3a-2b1c-0d9e8f7a6b5c',
    name: 'Dr. Hui',
    title: 'Lecturer',
    department: 'APSS',
    languages: ['English'],
    rating: { overall: 8.9, reviewsCount: 52, grading: 'balanced' },
  },
  {
    id: 'tch_9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
    name: 'Dr. Ko',
    title: 'Lecturer',
    department: 'APSS',
    languages: ['English'],
    rating: { overall: 8.5, reviewsCount: 47, grading: 'balanced' },
  },
  {
    id: 'tch_b2a1c8f3-0a44-4d6c-9b8a-0c1d2e3f4a5b',
    name: 'Dr. Lee',
    title: 'Assistant Professor',
    department: 'APSS',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lee',
    email: 'lee@polyu.edu.hk',
    office: 'AB512',
    officeHours: 'Thu 10:00-12:00',
    biography: 'Specializes in quantitative social research. Courses emphasize methodology and critical thinking.',
    homepageUrl: 'https://www.polyu.edu.hk/apss/',
    tags: ['Quantitative', 'Research Methods'],
    languages: ['English'],
    yearsExperience: 7,
    rating: { overall: 6.4, difficulty: 8.8, friendliness: 6.2, reviewsCount: 89, grading: 'strict' },
  },
  {
    id: 'tch_c3d2e1f0-9a8b-4c7d-6e5f-4a3b2c1d0e9f',
    name: 'Dr. Chan',
    title: 'Lecturer',
    department: 'APSS',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=chan',
    email: 'chan@polyu.edu.hk',
    office: 'AB310',
    officeHours: 'Mon 15:00-17:00',
    tags: ['Social Research', 'Seminar'],
    languages: ['English', '廣東話'],
    yearsExperience: 10,
    rating: { overall: 7.6, difficulty: 6.5, friendliness: 7.9, reviewsCount: 67, grading: 'balanced' },
  },
  {
    id: 'tch_d4e3f2a1-8b7c-6d5e-4f3a-2b1c0d9e8f7a',
    name: 'Dr. Cheung',
    title: 'Senior Lecturer',
    department: 'APSS',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cheung',
    tags: ['Research Methods', 'Workshop'],
    languages: ['English', '廣東話'],
    yearsExperience: 12,
    rating: { overall: 8.0, difficulty: 7.2, friendliness: 8.1, reviewsCount: 54, grading: 'balanced' },
  },
  {
    id: 'tch_e5f4a3b2-7c8d-9e0f-1a2b-3c4d5e6f7a8b',
    name: 'Prof. Lau',
    title: 'Professor',
    department: 'COMP',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lau',
    email: 'lau@polyu.edu.hk',
    office: 'BC102',
    tags: ['Programming', 'Software Engineering'],
    languages: ['English', '廣東話'],
    yearsExperience: 20,
    rating: { overall: 8.9, difficulty: 5.2, friendliness: 8.5, reviewsCount: 412, grading: 'lenient' },
  },
  {
    id: 'tch_f6a5b4c3-2d1e-0f9a-8b7c-6d5e4f3a2b1c',
    name: 'Dr. Ma',
    title: 'Associate Professor',
    department: 'COMP',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ma',
    tags: ['Programming', 'Systems'],
    languages: ['English'],
    yearsExperience: 14,
    rating: { overall: 8.7, difficulty: 4.8, friendliness: 8.2, reviewsCount: 183, grading: 'lenient' },
  },
  {
    id: 'tch_a7c6d5e4-3f2a-1b0c-9e8d-7c6b5a4f3e2d',
    name: 'Dr. Tam',
    title: 'Assistant Professor',
    department: 'COMP',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tam',
    tags: ['Programming', 'Algorithms'],
    languages: ['English'],
    yearsExperience: 8,
    rating: { overall: 8.9, difficulty: 6.0, friendliness: 7.8, reviewsCount: 156, grading: 'balanced' },
  },
  {
    id: 'tch_b8d7e6f5-4a3b-2c1d-0e9f-8d7c6b5a4f3e',
    name: 'Dr. Yu',
    title: 'Lecturer',
    department: 'COMP',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yu',
    tags: ['Programming', 'Databases'],
    languages: ['English', '普通话'],
    yearsExperience: 9,
    rating: { overall: 8.4, difficulty: 6.8, friendliness: 7.5, reviewsCount: 203, grading: 'lenient' },
  },
];

/**
 * Helpers
 */

export function getTeacherById(id: string): Teacher | null {
  return sampleTeachers.find(t => t.id === id) ?? null;
}

export function searchTeachers(query: string): Teacher[] {
  const q = query.trim().toLowerCase();
  if (!q) return sampleTeachers;
  return sampleTeachers.filter(t =>
    t.name.toLowerCase().includes(q) ||
    (t.department && t.department.toLowerCase().includes(q)) ||
    (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
  );
}

export function getCoursesByTeacherId(id: string): TeacherCourseRef[] {
  const teacher = getTeacherById(id);
  if (!teacher) return [];
  return sampleCourses
    .filter(c => Array.isArray(c.teachers) && c.teachers!.some(t => t.id === id || t.name === teacher.name))
    .map<TeacherCourseRef>(c => ({ courseId: c.courseId, subjectCode: c.subjectCode, title: c.title }));
}

/**
 * Find teacher by exact name match
 */
export function getTeacherByName(name: string): Teacher | null {
  const target = name.trim().toLowerCase();
  return sampleTeachers.find(t => t.name.trim().toLowerCase() === target) ?? null;
}
