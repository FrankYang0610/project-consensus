"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/hooks/useI18n";
import { getTeacherById, getCoursesByTeacherId } from "@/data/sampleTeachers";

export default function TeacherDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const teacherId = params.teacherId as string;

  const teacher = React.useMemo(() => getTeacherById(teacherId), [teacherId]);
  const courses = React.useMemo(() => getCoursesByTeacherId(teacherId), [teacherId]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [teacherId]);

  const handleBackClick = () => router.back();

  if (!teacher) {
    return (
      <>
        <SiteNavigation showBackButton={true} onBackClick={handleBackClick} />
        <div className="min-h-screen bg-background">
          <main className="w-full py-8">
            <div className="container mx-auto px-4 max-w-3xl">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">{t('teachers.notFound')}</p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNavigation showBackButton={true} onBackClick={handleBackClick} />
      <div className="min-h-screen bg-background">
        <main className="w-full py-6 sm:py-8">
          <div className="container mx-auto px-4 max-w-5xl grid gap-6">
            {/* Header card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <img
                    src={teacher.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(teacher.name)}`}
                    alt={teacher.name}
                    className="w-20 h-20 rounded-full border object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold leading-tight truncate">{teacher.name}</h1>
                    <div className="text-sm text-muted-foreground mt-1">
                      {[teacher.title, teacher.department].filter(Boolean).join(' · ')}
                    </div>
                    {/* External homepage link removed; navigate via internal UUID profile */}
                    {teacher.tags && teacher.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {teacher.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="sm:ml-auto grid grid-cols-3 gap-4 w-full sm:w-auto">
                    <div className="text-center">
                      <div className="text-2xl font-semibold">{teacher.rating?.overall?.toFixed(1) ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{t('teacher.stats.overall')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold">{courses.length}</div>
                      <div className="text-xs text-muted-foreground">{t('teacher.stats.courses')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold">{teacher.rating?.reviewsCount ?? 0}</div>
                      <div className="text-xs text-muted-foreground">{t('teacher.stats.reviews')}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact & About */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">{t('teacher.about')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-line leading-7 text-sm text-foreground">
                    {teacher.bio || t('teachers.noBio')}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('teacher.contact')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {teacher.email && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.email')}</div>
                      <div className="truncate">{teacher.email}</div>
                    </div>
                  )}
                  {teacher.office && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.office')}</div>
                      <div>{teacher.office}</div>
                    </div>
                  )}
                  {teacher.officeHours && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.officeHours')}</div>
                      <div>{teacher.officeHours}</div>
                    </div>
                  )}
                  {teacher.homepageUrl && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.homepage')}</div>
                      <Link className="text-primary underline break-all" href={teacher.homepageUrl} target="_blank">
                        {teacher.homepageUrl}
                      </Link>
                    </div>
                  )}
                  {typeof teacher.yearsExperience === 'number' && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.yearsExperience')}</div>
                      <div>{teacher.yearsExperience}</div>
                    </div>
                  )}
                  {teacher.languages && teacher.languages.length > 0 && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.languages')}</div>
                      <div>{teacher.languages.join(' / ')}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Courses taught */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('teacher.coursesTaught')}</CardTitle>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t('teacher.noCourses')}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {courses.map(course => (
                      <Link key={course.subjectId} href={`/courses/${course.subjectId}?teacher=${encodeURIComponent(teacher.name)}`}>
                        <div className="border rounded p-3 hover:border-primary transition-colors">
                          <div className="text-sm text-muted-foreground">{course.subjectCode}</div>
                          <div className="font-medium truncate">{course.title}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}
