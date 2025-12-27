'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageSquare, FileText, Star } from 'lucide-react';
import { SiteNavigation } from '@/components/SiteNavigation';
import { useApp } from '@/contexts/AppContext';
import { useI18n } from '@/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMyPosts, getMyComments, getMyReviews } from '@/lib/api/user-activity';
import { stripHtmlTags } from '@/lib/html-utils';
import ClientOnlyTime from '@/components/ClientOnlyTime';
import type { ForumPost, ForumPostComment } from '@/types/forum';
import type { CourseReview } from '@/types/course';

export default function ProfilePage() {
  const { user, isLoggedIn } = useApp();
  const { t } = useI18n();
  
  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [comments, setComments] = useState<ForumPostComment[]>([]);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : '');
  const avatarText = user?.name
    ? user.name.charAt(0).toUpperCase()
    : (user?.email ? user.email.charAt(0).toUpperCase() : '');

  const formattedPronouns = user?.pronouns || "";

  // Get user statistics from API
  const userStats = user?.stats || {
    forumPostsCount: 0,
    forumPostCommentsCount: 0,
    courseReviewsCount: 0,
    joinedDays: 0,
  };

  // Fetch user's posts, comments, and reviews (first page, small page size for dashboard)
  useEffect(() => {
    if (isLoggedIn) {
      // Fetch posts
      getMyPosts({ page: 1, pageSize: 5 })
        .then(data => {
          setPosts(data.results ?? []);
          setLoadingPosts(false);
        })
        .catch(error => {
          console.error('Failed to fetch posts:', error);
          setLoadingPosts(false);
        });

      // Fetch comments
      getMyComments({ page: 1, pageSize: 5 })
        .then(data => {
          setComments(data.results ?? []);
          setLoadingComments(false);
        })
        .catch(error => {
          console.error('Failed to fetch comments:', error);
          setLoadingComments(false);
        });

      // Fetch reviews
      getMyReviews({ page: 1, pageSize: 5 })
        .then(data => {
          setReviews(data.results ?? []);
          setLoadingReviews(false);
        })
        .catch(error => {
          console.error('Failed to fetch reviews:', error);
          setLoadingReviews(false);
        });
    }
  }, [isLoggedIn]);

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
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="shadow-md">
                  <Link href={`/user/${user?.id}`}>{t('profile.actions.viewPublic')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="shadow-md">
                  <Link href="/settings">{t('profile.actions.edit')}</Link>
                </Button>
              </div>
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

                    <div className="w-full">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h2>
                      {formattedPronouns && (
                        <p className="text-gray-600 dark:text-gray-300 mt-1">{formattedPronouns}</p>
                      )}
                      {user?.email && (
                        <p className="text-sm text-muted-foreground mt-2 break-all">{user.email}</p>
                      )}
                      <Badge variant="secondary" className="mt-2">
                        {t('profile.memberFor', { days: userStats.joinedDays })}
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
                  <CardTitle className="text-lg">{t('profile.stats.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{userStats.forumPostsCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('profile.stats.posts')}</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{userStats.forumPostCommentsCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('profile.stats.comments')}</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{userStats.courseReviewsCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('profile.stats.reviews')}</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{userStats.joinedDays}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('profile.stats.days')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Activity & Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Posts */}
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><FileText className="w-5 h-5" /> {t('profile.activity.recentPosts.title')}</CardTitle>
                  <CardDescription>{t('profile.activity.recentPosts.subtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPosts ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : posts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{t('profile.activity.recentPosts.empty')}</div>
                  ) : (
                    <div className="space-y-3">
                      {posts.slice(0, 5).map((post) => (
                        <Link 
                          key={post.id} 
                          href={`/post/${post.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border border-gray-100 dark:border-slate-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 dark:text-white mb-1 line-clamp-1">
                                {post.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                                {stripHtmlTags(post.content)}
                              </p>
                              <div className="flex items-center gap-3 text-xs">
                                <ClientOnlyTime dateString={post.createdAt} className="text-gray-500 dark:text-gray-400" />
                                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {post.commentsCount}
                                </span>
                                <span className={cn(
                                  "flex items-center gap-1",
                                  post.isLiked ? "text-red-500 font-medium" : "text-gray-500 dark:text-gray-400"
                                )}>
                                <Heart className={cn("w-3 h-3", post.isLiked && "fill-current")} />
                                {post.likesCount}
                                </span>
                                {post.isAnonymous && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t('profile.activity.anonymousBadge')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Comments */}
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><MessageSquare className="w-5 h-5" /> {t('profile.activity.recentComments.title')}</CardTitle>
                  <CardDescription>{t('profile.activity.recentComments.subtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingComments ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{t('profile.activity.recentComments.empty')}</div>
                  ) : (
                    <div className="space-y-3">
                      {comments.slice(0, 5).map((comment) => (
                        <Link 
                          key={comment.id} 
                          href={`/post/${comment.postId}#comment-${comment.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border border-gray-100 dark:border-slate-700"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white line-clamp-2 mb-2">
                              {stripHtmlTags(comment.content)}
                            </p>
                            <div className="flex items-center gap-3 text-xs">
                              <ClientOnlyTime dateString={comment.createdAt} className="text-gray-500 dark:text-gray-400" />
                              <span className={cn(
                                "flex items-center gap-1",
                                comment.isLiked ? "text-red-500 font-medium" : "text-gray-500 dark:text-gray-400"
                              )}>
                                <Heart className={cn("w-3 h-3", comment.isLiked && "fill-current")} />
                                {comment.likesCount}
                              </span>
                              {comment.replyTo && <span className="text-gray-500 dark:text-gray-400">{t('profile.activity.recentComments.inReplyTo')}</span>}
                              {comment.isAnonymous && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('profile.activity.anonymousBadge')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Reviews */}
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Star className="w-5 h-5" /> {t('profile.activity.recentReviews.title')}</CardTitle>
                  <CardDescription>{t('profile.activity.recentReviews.subtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingReviews ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : reviews.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{t('profile.activity.recentReviews.empty')}</div>
                  ) : (
                    <div className="space-y-3">
                      {reviews.slice(0, 5).map((review) => (
                        <Link 
                          key={review.id} 
                          href={`/courses/${review.courseId}#review-${review.id}`}
                          className="block p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border border-gray-100 dark:border-slate-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {!review.onlyText && review.overallRating !== undefined && (
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    {review.overallRating.toFixed(1)}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">/ 10</span>
                                </div>
                              )}
                              <p className="text-sm text-gray-900 dark:text-white line-clamp-3 mb-2">
                                {stripHtmlTags(review.content)}
                              </p>
                              <div className="flex items-center gap-3 text-xs">
                                <ClientOnlyTime dateString={review.createdAt} className="text-gray-500 dark:text-gray-400" />
                                <span className={cn(
                                  "flex items-center gap-1",
                                  review.isLiked ? "text-red-500 font-medium" : "text-gray-500 dark:text-gray-400"
                                )}>
                                  <Heart className={cn("w-3 h-3", review.isLiked && "fill-current")} />
                                  {review.likesCount}
                                </span>
                                {(review.repliesCount ?? 0) > 0 && (
                                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {review.repliesCount}
                                  </span>
                                )}
                                {review.isAnonymous && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t('profile.activity.anonymousBadge')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </main>
      </div>
    </>
  );
}


