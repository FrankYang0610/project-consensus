'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SiteNavigation } from '@/components/SiteNavigation';
import { useApp } from '@/contexts/AppContext';
import { useI18n } from '@/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPronounsForProfilePageDisplay } from '@/lib/pronouns-utils';

export default function ProfilePage() {
  const { user, isLoggedIn } = useApp();
  const { t } = useI18n();

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : '');
  const avatarText = user?.name
    ? user.name.charAt(0).toUpperCase()
    : (user?.email ? user.email.charAt(0).toUpperCase() : '');

  const formattedPronouns = user?.pronounsShared && user?.pronouns ? formatPronounsForProfilePageDisplay(user.pronouns) : "";

  // Mock data for demonstration
  const userStats = {
    posts: 12,
    comments: 45,
    reviews: 8,
    joinedDays: 156
  };

  const recentActivity = [
    { type: 'review', content: 'Reviewed CS101 - Data Structures', time: '2 hours ago' },
    { type: 'comment', content: 'Commented on "Best professors for CS courses"', time: '1 day ago' },
    { type: 'post', content: 'Posted "Study group for MATH201"', time: '3 days ago' },
    { type: 'review', content: 'Reviewed MATH201 - Calculus II', time: '1 week ago' },
    { type: 'comment', content: 'Commented on "CS102 assignment help needed"', time: '1 week ago' },
    { type: 'review', content: 'Reviewed PHYS101 - Physics I', time: '2 weeks ago' },
    { type: 'post', content: 'Posted "Looking for study partner for CHEM101"', time: '2 weeks ago' },
    { type: 'comment', content: 'Commented on "Professor recommendations for MATH202"', time: '3 weeks ago' },
    { type: 'review', content: 'Reviewed ENGL101 - Academic Writing', time: '3 weeks ago' },
    { type: 'post', content: 'Posted "Course selection advice needed"', time: '1 month ago' }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'review': return '⭐';
      case 'comment': return '💬';
      case 'post': return '📝';
      default: return '📄';
    }
  };

  return (
    <>
      <SiteNavigation />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {t('profile.title')}
                </h1>
                <p className="text-lg text-muted-foreground">{t('profile.subtitle')}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="shadow-md">
                <Link href="/settings">{t('profile.actions.edit')}</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Profile Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Card */}
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    {user?.avatar ? (
                      <Image
                        src={user.avatar}
                        alt={displayName}
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-2xl font-medium">
                        {avatarText}
                      </div>
                    )}

                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h2>
                      {user?.pronounsShared && (
                        <p className="text-gray-600 dark:text-gray-300 mt-1">{formattedPronouns}</p>
                      )}
                      <Badge variant="secondary" className="mt-2">
                        Member for {userStats.joinedDays} days
                      </Badge>
                    </div>

                    {!isLoggedIn && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 w-full">
                        <p className="text-amber-800 dark:text-amber-200 text-sm">
                          {t('settings.requireLogin')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Activity Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{userStats.posts}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Posts</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{userStats.comments}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Comments</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{userStats.reviews}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Reviews</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{userStats.joinedDays}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Days</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Activity & Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Activity */}
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Recent Activity</CardTitle>
                  <CardDescription>Your latest contributions to the community</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="text-2xl">{getActivityIcon(activity.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {activity.content}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </main>
      </div>
    </>
  );
}


