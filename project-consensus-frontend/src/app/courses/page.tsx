"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/hooks/useI18n";
import { CoursesBackgroundCard } from "@/components/CoursesBackgroundCard";
import { CoursesFilterBar } from "@/components/CoursesFilterBar";
import { CoursesPreviewCard } from "@/components/CoursesPreviewCard";
import { sampleCourses } from "@/data/sampleCourses";

export default function CoursesPage() {
    const { t } = useI18n();

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
                            <CoursesBackgroundCard>
                                <div className="space-y-4">
                                    <CoursesFilterBar onApply={() => { /* TODO: wire filters to list */ }} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {sampleCourses.map(course => (
                                            <CoursesPreviewCard
                                                key={course.subjectCode}
                                                subjectCode={course.subjectCode}
                                                title={course.title}
                                                term={course.term}
                                                terms={course.terms}
                                                rating={course.rating}
                                                attributes={course.attributes}
                                                teachers={course.teachers}
                                                department={course.department}
                                                lastUpdated={course.lastUpdated}
                                                href={course.href}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </CoursesBackgroundCard>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}


