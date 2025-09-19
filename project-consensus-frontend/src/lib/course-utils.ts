/**
 * 课程相关工具函数 / Course utility functions
 */

import type { SemesterKey } from '@/types';

/**
 * Clamp a numeric value between [min, max]
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Format semester term for display with proper spacing for different languages
 */
export function formatTerm(
    year: number, 
    semester: SemesterKey, 
    t: (key: string, opts?: Record<string, unknown>) => string, 
    language: string
): string {
    const semLabel = t(`courses.card.semester.${semester}`);
    const spacer = language.startsWith("zh") ? " " : " ";
    return `${year}${spacer}${semLabel}`;
}

/**
 * Format date for display with language-specific formatting
 */
export function formatDateDisplay(dateInput: string | Date, language: string): string {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    
    // Validate date
    if (isNaN(date.getTime())) {
        console.warn('Invalid date provided to formatDateDisplay:', dateInput);
        return 'Invalid Date';
    }
    
    try {
        return new Intl.DateTimeFormat(language, { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
        }).format(date);
    } catch {
        return date.toLocaleDateString();
    }
}

/**
 * Validate and clamp course rating
 */
export function validateRating(rating: number): number {
    if (typeof rating !== 'number' || isNaN(rating)) {
        console.warn('Invalid rating provided:', rating);
        return 0;
    }
    return clamp(rating, 0, 10);
}

/**
 * Sort terms by year and semester (most recent first)
 */
export function sortTerms(terms: Array<{ year: number; semester: SemesterKey }>): Array<{ year: number; semester: SemesterKey }> {
    const order: Record<SemesterKey, number> = { spring: 1, summer: 2, fall: 3 };
    return [...terms].sort((a, b) => (b.year - a.year) || (order[b.semester] - order[a.semester]));
}
