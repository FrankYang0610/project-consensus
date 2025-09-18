"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { SiteNavigation } from "@/components/SiteNavigation";
import CoursesDetailedCard, { TeacherInfo } from "@/components/CoursesDetailedCard";
import { sampleCourses } from "@/data/sampleCourses";
import { useI18n } from "@/hooks/useI18n";

export default function CourseDetailPage({ params }: { params: Promise<{ subjectId: string }> }) {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const teacherQuery = searchParams.get("teacher") || undefined;
    
    // Unwrap params Promise for Next.js 15
    const resolvedParams = React.use(params);
    const { subjectId } = resolvedParams;

    const course = React.useMemo(() => sampleCourses.find(c => c.subjectId === subjectId) ?? null, [subjectId]);

    // Simple hydration-safe fallback for teacher info
    const teachers: TeacherInfo[] = React.useMemo(() => {
        const names = course?.teachers ?? [];
        return names.map(n => ({ name: n }));
    }, [course]);

    const highlightedTeachers = React.useMemo(() => {
        return teachers.length > 0 && teacherQuery
            ? [ { name: teacherQuery }, ...teachers.filter(t => t.name !== teacherQuery) ]
            : teachers;
    }, [teachers, teacherQuery]);


    if (!course) {
        return (
            <div className="min-h-screen bg-background">
                <SiteNavigation />
                <main className="w-full py-10">
                    <div className="max-w-5xl mx-auto p-6">
                        <div className="text-center text-muted-foreground">{t("courses.detail.courseNotFound")}</div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <SiteNavigation />
            <main className="w-full py-8">
                <div className="w-full p-6">
                    <div className="max-w-6xl mx-auto grid grid-cols-1 gap-6 pt-2">
                        <div className="px-4">
                                <CoursesDetailedCard
                                    subjectId={course.subjectId}
                                    subjectCode={course.subjectCode}
                                    title={course.title}
                                    term={course.term}
                                    terms={course.terms}
                                    rating={{
                                        ...course.rating,
                                        recommendCount: Math.floor(course.rating.reviewsCount * 0.7),
                                        notRecommendCount: Math.floor(course.rating.reviewsCount * 0.2)
                                    }}
                                    attributes={course.attributes}
                                    teachers={highlightedTeachers}
                                    department={course.department}
                                    lastUpdated={course.lastUpdated}
                                    // placeholders - can be wired later
                                    selectionCategory={"—"}
                                    teachingType={"—"}
                                    courseCategory={"—"}
                                    offeringDepartment={course.department}
                                    level={"—"}
                                    credits={"—"}
                                    courseHomepageUrl={undefined}
                                    syllabusUrl={undefined}
                                />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}


