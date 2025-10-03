'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SiteNavigation } from '@/components/SiteNavigation';
import { useApp } from '@/contexts/AppContext';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPronounsForProfilePageDisplay } from '@/lib/pronouns-utils';
import { getPublicUser, getPublicUserPosts, getPublicUserComments, getPublicUserReviews } from '@/lib/api/public-user';
import { stripHtmlTags } from '@/lib/html-utils';
import ClientOnlyTime from '@/components/ClientOnlyTime';
import type { User } from '@/types/user';
import type { ForumPost, ForumPostComment } from '@/types/forum';
import type { CourseReview } from '@/types/course';

export default function PublicUserPage() {
  const params = useParams();
  const userId = params.userId as string;
  const { user: currentUser } = useApp();
  const { t } = useI18n();
  
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [comments, setComments] = useState<ForumPostComment[]>([]);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = user?.name || '';
  const avatarText = user?.name ? user.name.charAt(0).toUpperCase() : '';
  const formattedPronouns = user?.pronounsShared && user?.pronouns ? formatPronounsForProfilePageDisplay(user.pronouns) : "";

  const userStats = user?.stats || {
    posts: 0,
    comments: 0,
    reviews: 0,
    joinedDays: 0
  };

  // Fetch user information
  useEffect(() => {
    if (userId) {
      getPublicUser(userId)
        .then(data => {
          setUser(data);
          setLoadingUser(false);
        })
        .catch(error => {
          console.error('Failed to fetch user:', error);
          setError('User not found');
          setLoadingUser(false);
        });
    }
  }, [userId]);

  // Fetch user's posts
  useEffect(() => {
    if (userId && user?.showForumPostsPublicly) {
      getPublicUserPosts(userId)
        .then(data => {
          setPosts(data);
          setLoadingPosts(false);
        })
        .catch(error => {
          console.error('Failed to fetch posts:', error);
          setLoadingPosts(false);
        });
    } else if (user && !user.showForumPostsPublicly) {
      setLoadingPosts(false);
    }
  }, [userId, user?.showForumPostsPublicly]);

  // Fetch user's comments
  useEffect(() => {
    if (userId && user?.showForumPostCommentsPublicly) {
      getPublicUserComments(userId)
        .then(data => {
          setComments(data);
          setLoadingComments(false);
        })
        .catch(error => {
          console.error('Failed to fetch comments:', error);
          setLoadingComments(false);
        });
    } else if (user && !user.showForumPostCommentsPublicly) {
      setLoadingComments(false);
    }
  }, [userId, user?.showForumPostCommentsPublicly]);

  // Fetch user's reviews
  useEffect(() => {
    if (userId && user?.showCourseReviewsPublicly) {
      getPublicUserReviews(userId)
        .then(data => {
          setReviews(data);
          setLoadingReviews(false);
        })
        .catch(error => {
          console.error('Failed to fetch reviews:', error);
          setLoadingReviews(false);
        });
    } else if (user && !user.showCourseReviewsPublicly) {
      setLoadingReviews(false);
    }
  }, [userId, user?.showCourseReviewsPublicly]);

  if (loadingUser) {
    return (
      <>
        <SiteNavigation />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <main className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center py-20 text-muted-foreground">Loading...</div>
          </main>
        </div>
      </>
    );
  }

  if (error || !user) {
    return (
      <>
        <SiteNavigation />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <main className="max-w-6xl mx-auto px-4 py-8">
            <div className="text-center py-20">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">User Not Found</h1>
              <p className="text-muted-foreground">The user you are looking for does not exist.</p>
            </div>
          </main>
        </div>
      </>
    );
  }

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
                  {displayName}
                </h1>
                <p className="text-lg text-muted-foreground">{t('profile.subtitle')}</p>
              </div>
              {currentUser?.id === userId && (
                <Button asChild variant="outline" size="sm" className="shadow-md">
                  <Link href="/profile">{t('profile.actions.viewPrivate')}</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Profile Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Card */}
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    {user.avatar ? (
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
                      {user.pronounsShared && (
                        <p className="text-gray-600 dark:text-gray-300 mt-1">{formattedPronouns}</p>
                      )}
                      <Badge variant="secondary" className="mt-2">
                        {t('profile.memberFor', { days: userStats.joinedDays })}
                      </Badge>
                    </div>
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
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{userStats.posts}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('profile.stats.posts')}</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{userStats.comments}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('profile.stats.comments')}</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{userStats.reviews}</div>
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
              {/* Posts */}
              {user.showForumPostsPublicly && (
                <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">📝 {t('profile.activity.myPosts.title')}</CardTitle>
                    <CardDescription>{t('profile.activity.myPosts.subtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingPosts ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : posts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">{t('profile.activity.myPosts.empty')}</div>
                    ) : (
                      <div className="space-y-3">
                        {posts.slice(0, 5).map((post) => (
                          <Link 
                            key={post.id} 
                            href={`/post/${post.id}`}
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
                                  <span className="text-gray-500 dark:text-gray-400">💬 {post.comments}</span>
                                  <span className="text-gray-500 dark:text-gray-400">❤️ {post.likes}</span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Comments */}
              {user.showForumPostCommentsPublicly && (
                <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">💬 {t('profile.activity.myComments.title')}</CardTitle>
                    <CardDescription>{t('profile.activity.myComments.subtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingComments ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : comments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">{t('profile.activity.myComments.empty')}</div>
                    ) : (
                      <div className="space-y-3">
                        {comments.slice(0, 5).map((comment) => (
                          <Link 
                            key={comment.id} 
                            href={`/post/${comment.postId}#comment-${comment.id}`}
                            className="block p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border border-gray-100 dark:border-slate-700"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white line-clamp-2 mb-2">
                                {stripHtmlTags(comment.content)}
                              </p>
                              <div className="flex items-center gap-3 text-xs">
                                <ClientOnlyTime dateString={comment.createdAt} className="text-gray-500 dark:text-gray-400" />
                                <span className="text-gray-500 dark:text-gray-400">❤️ {comment.likes}</span>
                                {comment.replyTo && <span className="text-gray-500 dark:text-gray-400">{t('profile.activity.myComments.inReplyTo')}</span>}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Reviews */}
              {user.showCourseReviewsPublicly && (
                <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">⭐ {t('profile.activity.myReviews.title')}</CardTitle>
                    <CardDescription>{t('profile.activity.myReviews.subtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingReviews ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : reviews.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">{t('profile.activity.myReviews.empty')}</div>
                    ) : (
                      <div className="space-y-3">
                        {reviews.slice(0, 5).map((review) => (
                          <Link 
                            key={review.id} 
                            href={`/courses/${review.subjectId}/review`}
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
                                  <span className="text-gray-500 dark:text-gray-400">❤️ {review.likesCount}</span>
                                  {(review.repliesCount ?? 0) > 0 && <span className="text-gray-500 dark:text-gray-400">💬 {review.repliesCount}</span>}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Privacy Notice */}
              {(!user.showForumPostsPublicly || !user.showForumPostCommentsPublicly || !user.showCourseReviewsPublicly) && (
                <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground text-center">
                      {t('profile.privacyNotice')}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

