"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/hooks/useI18n";
import { CourseBackgroundCard } from "@/components/CourseBackgroundCard";
import { CourseFilterBar } from "@/components/CourseFilterBar";
import { CoursePreviewCard } from "@/components/CoursePreviewCard";
import type { Paginated } from "@/lib/api/courses";
import { apiGet } from "@/lib/utils";
import type { Course } from "@/types";

export default function CoursesPage() {
  const { t } = useI18n();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const loaderRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);
  const [nextUrl, setNextUrl] = React.useState<string | null>(`/api/courses/?page=1&page_size=20&ordering=-last_updated`);
  const [loadError, setLoadError] = React.useState(false);

  const fetchMore = React.useCallback(async () => {
    if (!nextUrl || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await apiGet<Paginated<Course> | Course[]>(nextUrl);
      const results: Course[] = Array.isArray(data) ? data : (data.results ?? []);
      setCourses(prev => {
        const existing = new Set(prev.map(c => c.subjectId));
        const deduped = results.filter(c => !existing.has(c.subjectId));
        return [...prev, ...deduped];
      });
      const next = Array.isArray(data) ? null : data.next;
      setNextUrl(next ? new URL(next).pathname + new URL(next).search : null);
      setLoadError(false);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      loadingRef.current = false;
    }
  }, [nextUrl]);

  React.useEffect(() => {
    if (courses.length === 0 && nextUrl) {
      fetchMore();
    }
  }, []);

  React.useEffect(() => {
    if (!loaderRef.current) return;
    const target = loaderRef.current;
    const remaining = nextUrl ? 1 : 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && remaining > 0) {
          fetchMore();
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [nextUrl, fetchMore]);

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-8">
          <div className="w-full p-6">
            <div className="max-w-7xl mx-auto mb-1">
              <Alert>
                <AlertTitle>{t('common.note')}</AlertTitle>
                <AlertDescription>
                  {t('common.developmentNotice')}
                </AlertDescription>
              </Alert>
            </div>
            <div className="max-w-7xl mx-auto grid grid-cols-1 gap-6 pt-4">
              <CourseBackgroundCard>
                <div className="space-y-4">
                  <CourseFilterBar
                    onApply={(filters) => {
                      const q = new URLSearchParams();
                      q.set('page', '1');
                      q.set('page_size', '20');
                      // map sort to ordering
                      const sort = String(filters.sort ?? 'composite');
                      const ordering = sort === 'rating' ? '-rating_score' : sort === 'reviews' ? '-rating_reviews_count' : '-last_updated';
                      q.set('ordering', ordering);
                      // subject code
                      const subjectCode = String(filters.subjectCode || '').trim();
                      if (subjectCode) q.set('subjectCode', subjectCode);
                      // department (multi); append repeated keys with department names from backend
                      const departments = Array.isArray(filters.departments) ? (filters.departments as string[]) : [];
                      if (departments.length > 0) {
                        for (const d of departments) q.append('department', d);
                      }
                      // category (maps to selectionCategory); ignore 'all'
                      const category = String(filters.category || '').trim();
                      if (category && category !== 'all') q.set('category', category);
                      // detailed categories (maps to courseCategory), support multi
                      const categories = Array.isArray(filters.categories) ? (filters.categories as string[]) : [];
                      if (categories.length > 0) {
                        for (const c of categories) q.append('categories', c);
                      }
                      // levels 1..6 (multi)
                      const levels = Array.isArray(filters.levels) ? (filters.levels as string[]) : [];
                      if (levels.length > 0) {
                        for (const lv of levels) {
                          const s = String(lv).trim();
                          if (s && s !== '0') q.append('level', s);
                        }
                      }
                      // search: combine title and teacher name where applicable
                      const terms: string[] = [];
                      const subjectTitle = String(filters.subjectTitle || '').trim();
                      if (subjectTitle) terms.push(subjectTitle);
                      const teacherName = String(filters.teacherName || '').trim();
                      if (teacherName) terms.push(teacherName);
                      if (terms.length > 0) q.set('search', terms.join(' '));

                      setCourses([]);
                      setNextUrl(`/api/courses/?${q.toString()}`);
                      setLoadError(false);
                    }}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {courses.map(course => (
                      <CoursePreviewCard
                        key={course.subjectId}
                        subjectId={course.subjectId}
                        subjectCode={course.subjectCode}
                        title={course.title}
                        term={course.term}
                        terms={course.terms}
                        rating={course.rating}
                        attributes={course.attributes}
                        teachers={course.teachers}
                        department={course.department}
                        lastUpdated={course.lastUpdated}
                      />
                    ))}
                  </div>
                  {/* Infinite scroll sentinel + retry */}
                  <div className="flex justify-center">
                    <div ref={loaderRef} className="h-8 w-full" aria-hidden="true" />
                  </div>
                  {loadError && nextUrl && (
                    <div className="flex justify-center">
                      <button
                        className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        onClick={() => { setLoadError(false); fetchMore(); }}
                      >
                        {t('common.loadFailedRetry')}
                      </button>
                    </div>
                  )}
                </div>
              </CourseBackgroundCard>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
