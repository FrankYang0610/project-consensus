"use client";

import Link from "next/link";
import {SiteNavigation} from "@/components/SiteNavigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useI18n } from "@/hooks/useI18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <>
        <SiteNavigation />

        <main className="min-h-[80vh] px-6 py-20 flex items-center justify-center">
        <div className="relative mx-auto w-full max-w-3xl text-center">
            <div className="absolute inset-0 -z-10 blur-3xl opacity-40">
            <div className="mx-auto h-48 w-48 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400/70 animate-pulse" />
            </div>

            <p className="mb-3 text-lg sm:text-xl font-medium tracking-wide text-muted-foreground">{t('notFound.error')}</p>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('notFound.title')}</h1>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                {t('notFound.desc')}
            </p>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 text-left">
                <Card className="bg-card/50">
                    <CardHeader>
                        <CardTitle className="text-sm">{t('notFound.quickActions')}</CardTitle>
                        <CardDescription>{t('notFound.quickActionsDesc')}</CardDescription>
                    </CardHeader>
                </Card>
                <Card className="bg-card/50">
                    <Link href="/" className="block">
                        <CardHeader>
                            <CardTitle className="text-sm">{t('notFound.goHome')}</CardTitle>
                            <CardDescription>{t('notFound.goHomeDesc')}</CardDescription>
                        </CardHeader>
                    </Link>
                </Card>
            </div>
        </div>
        </main>
    </>
  );
}


