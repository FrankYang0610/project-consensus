'use client';

import { cn } from '@/lib/utils';
import { SiteNavigation } from '@/components/SiteNavigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import Link from 'next/link';

export default function AboutPage() {
    const { t } = useI18n();
    
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
                        <CardTitle>{t('about.teamTitle')}</CardTitle>
                        <CardDescription>{t('about.teamDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-md border p-4">
                                <div className="font-medium">Jim Yang</div>
                                <div className="text-sm text-muted-foreground">{t('about.coCreator')}</div>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="font-medium">Frank Yang</div>
                                <div className="text-sm text-muted-foreground">{t('about.coCreator')}</div>
                            </div>
                        </div>
                    </CardContent>
                    
                </Card>
            </main>
        </>
    );
}
