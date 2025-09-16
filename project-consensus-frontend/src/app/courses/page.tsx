"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/hooks/useI18n";

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
                    </div>

                    <div className="w-full p-6 pt-0">
                        <div className="max-w-7xl mx-auto">
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}


