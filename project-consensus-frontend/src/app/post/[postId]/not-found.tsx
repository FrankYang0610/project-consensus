"use client";

import { SiteNavigation } from "@/components/SiteNavigation";
import { useI18n } from "@/hooks/use-i18n";
import { Card, CardContent } from "@/components/ui/card";

export default function ForumPostNotFoundPage() {
  const { t } = useI18n();
  return (
    <>
      <SiteNavigation showBackButton={true} />
      <div className="min-h-screen bg-background">
        <main className="w-full py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">{t('post.notExist')}</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}


