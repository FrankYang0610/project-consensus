'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { SiteNavigation } from '@/components/SiteNavigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
import { fetchSiteStats, type SiteStats } from '@/lib/api/site-stats';
import Link from 'next/link';

export default function AboutPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSiteStats()
      .then((data) => { if (!cancelled) { setStats(data); } })
      .catch(() => { /* Fail silently; the stats block will fallback to placeholders */ });
    return () => { cancelled = true; };
  }, []);

  const formatCount = (value: number | null | undefined): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) { return '—'; }
    try { return value.toLocaleString(); } catch { return String(value); }
  };

  return (
    <>
      <SiteNavigation />
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

      <main className={cn('mx-auto max-w-5xl p-8 space-y-8')}>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">{t('about.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('about.subtitle')}</p>
        </div>


        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('about.whatIsTitle')}</CardTitle>
              <CardDescription>{t('about.whatIsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">
                {t('about.whatIsContent')}
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href="/">{t('about.goToHome')}</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('about.repositoryTitle')}</CardTitle>
              <CardDescription>{t('about.repositoryDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{t('about.repositoryContent')}</p>
            </CardContent>
            <CardFooter className="gap-3">
              <Button asChild>
                <a href="https://github.com/FrankYang0610/project-consensus" target="_blank" rel="noopener noreferrer">{t('about.githubRepository')}</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://github.com/FrankYang0610/project-consensus/issues" target="_blank" rel="noopener noreferrer">{t('about.viewIssues')}</a>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('about.statsTitle')}</CardTitle>
            <CardDescription>{t('about.statsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('about.stats.forumPosts')}
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatCount(stats?.forumPosts)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('about.stats.courses')}
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatCount(stats?.courses)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('about.stats.courseReviews')}
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatCount(stats?.courseReviews)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('about.stats.teachers')}
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatCount(stats?.teachers)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('about.teamTitle')}</CardTitle>
            <CardDescription>{t('about.teamDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <a
                href="https://github.com/FivespeedDoc"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border p-4 transition-colors hover:bg-muted/60"
              >
                <div className="font-medium">Jim Yang</div>
                <div className="text-sm text-muted-foreground">{t('about.coCreator')}</div>
              </a>
              <a
                href="https://github.com/FrankYang0610"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border p-4 transition-colors hover:bg-muted/60"
              >
                <div className="font-medium">Frank Yang</div>
                <div className="text-sm text-muted-foreground">{t('about.coCreator')}</div>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
