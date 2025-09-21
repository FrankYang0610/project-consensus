"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/hooks/useI18n";

export default function TosPage() {
  const { t } = useI18n();

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-8">
          <div className="w-full p-6">
            <div className="max-w-7xl mx-auto mb-6">
              <Alert className="mb-6">
                <AlertTitle>{t('common.note')}</AlertTitle>
                <AlertDescription>
                  {t('common.developmentNotice')}
                </AlertDescription>
              </Alert>
              <h1 className="text-2xl font-bold">{t("tos.title")}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {t("tos.updatedAt", { date: "2025-09-16" })}
              </p>
            </div>
          </div>

          <div className="w-full p-6 pt-0">
            <div className="max-w-7xl mx-auto space-y-6">
              <p>{t("tos.intro")}</p>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.acceptance.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.acceptance.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.accounts.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.accounts.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.userContent.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.userContent.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.prohibited.title')}</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <li key={i}>{t(`tos.sections.prohibited.items.${i}`)}</li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.intellectualProperty.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.intellectualProperty.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.disclaimer.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.disclaimer.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.limitation.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.limitation.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.privacy.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.privacy.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.changes.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.changes.content')}</p>
              </section>

              <section className="space-y-2">
                <h2 className="text-xl font-semibold">{t('tos.sections.contact.title')}</h2>
                <p className="text-muted-foreground">{t('tos.sections.contact.content')}</p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}


