"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/hooks/use-i18n";
import { CourseBackgroundCard } from "@/components/CourseBackgroundCard";
import { CourseFilterBar } from "@/components/CourseFilterBar";
import { CoursePreviewCard } from "@/components/CoursePreviewCard";
import type { Course } from "@/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { fetchCourses } from "@/lib/api/course";

export default function CourseAdvancedSearchPage() {
  const { t } = useI18n();
  const {
    items: courses,
    setItems: setCourses,
    loaderRef,
    hasMore,
    error: loadError,
    setError: setLoadError,
    loadMore,
    reset,
  } = useInfiniteList<Course, import("@/types").FetchCoursesParams>({
    pageFetcher: fetchCourses,
    initialParams: { page: 1, pageSize: 20, ordering: '-last_updated' },
    pageSize: 20,
    dedupeKey: (c) => c.courseId,
  });

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
                      const sort = String(filters.sort ?? 'composite');
                      const ordering = sort === 'rating' ? '-rating_score' : sort === 'reviews' ? '-rating_reviews_count' : '-last_updated';
                      const subjectCode = String(filters.subjectCode || '').trim() || undefined;
                      const departments = (Array.isArray(filters.departments) ? (filters.departments as string[]) : []).filter(Boolean);
                      const category = String(filters.category || '').trim();
                      const categories = (Array.isArray(filters.categories) ? (filters.categories as string[]) : []).filter(Boolean);
                      const levels = (Array.isArray(filters.levels) ? (filters.levels as string[]) : []).filter((lv) => lv && lv !== '0');
                      const subjectTitle = String(filters.subjectTitle || '').trim();
                      const teacherName = String(filters.teacherName || '').trim();
                      const search = [subjectTitle, teacherName].filter(Boolean).join(' ') || undefined;

                      reset({
                        page: 1,
                        pageSize: 20,
                        ordering,
                        ...(subjectCode ? { subjectCode } : {}),
                        ...(departments.length ? { departments: departments } : {}),
                        ...(category && category !== 'all' ? { category } : {}),
                        ...(categories.length ? { categories } : {}),
                        ...(levels.length ? { level: levels } : {}),
                        ...(search ? { search } : {}),
                      });
                    }}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {courses.map(course => (
                      <CoursePreviewCard
                        key={course.courseId}
                        courseId={course.courseId}
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
                  {/* Infinite scroll sentinel + retry (handled by useInfiniteList) */}
                  <div className="flex justify-center">
                    <div ref={loaderRef} className="h-8 w-full" aria-hidden="true" />
                  </div>
                  {loadError && (hasMore || courses.length === 0) && (
                    <div className="flex justify-center">
                      <button
                        className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        onClick={() => { setLoadError(false); loadMore(); }}
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
