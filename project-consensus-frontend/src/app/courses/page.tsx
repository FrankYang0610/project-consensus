"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/hooks/useI18n";
import { CoursesBackgroundCard } from "@/components/CoursesBackgroundCard";
import { CoursesFilterBar } from "@/components/CoursesFilterBar";

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
                                    <div>
                                        {/* TODO: course list content */}
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


