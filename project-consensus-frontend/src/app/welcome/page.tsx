'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Settings, BookOpen, GraduationCap } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { useApp } from '@/contexts/AppContext';
import { SiteNavigation } from '@/components/SiteNavigation';

export default function WelcomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, isLoading } = useApp();

  // Redirect to home if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [isLoading, user, router]);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <div>
      <SiteNavigation />
      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{t('welcome.title')}</h1>
          <p className="text-lg text-muted-foreground">{t('welcome.subtitle')}</p>
        </div>

        {/* Success Alert */}
        <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            {t('welcome.registrationSuccess')}
          </AlertDescription>
        </Alert>

        {/* Action Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Complete Profile Card */}
          <Card 
            className="group cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-primary/50"
            onClick={() => handleNavigation('/settings')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Settings className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg">{t('welcome.completeProfile.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('welcome.completeProfile.description')}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button 
                className="w-full"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation('/settings');
                }}
              >
                {t('welcome.completeProfile.action')}
              </Button>
            </CardFooter>
          </Card>

          {/* Community Rules Card */}
          <Card 
            className="group cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-primary/50"
            onClick={() => handleNavigation('/wiki/community-rules')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg">{t('welcome.communityRules.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('welcome.communityRules.description')}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button 
                className="w-full"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation('/wiki/community-rules');
                }}
              >
                {t('welcome.communityRules.action')}
              </Button>
            </CardFooter>
          </Card>

          {/* Explore Courses Card */}
          <Card 
            className="group cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-primary/50"
            onClick={() => handleNavigation('/courses')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg">{t('welcome.exploreCourses.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('welcome.exploreCourses.description')}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button 
                className="w-full"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation('/courses');
                }}
              >
                {t('welcome.exploreCourses.action')}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Skip/Continue Section */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
          <Button 
            onClick={() => router.push('/')}
            variant="ghost"
            size="lg"
          >
            {t('welcome.continueToHome')}
          </Button>
        </div>
      </main>
    </div>
  );
}
