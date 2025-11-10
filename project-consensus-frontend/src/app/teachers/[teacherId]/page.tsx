"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/hooks/use-i18n";
import { fetchTeacherById, fetchTeacherCourses } from "@/lib/api/teacher";
import type { Teacher, TeacherCourseRef } from "@/types";

/**
 * Teacher avatar component with fallback to 2-letter initials
 * Handles both URL and initials from backend
 */
function TeacherAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  // Check if avatarUrl is a full URL or initials from backend
  const isUrl = avatarUrl?.startsWith('http://') || avatarUrl?.startsWith('https://');
  
  const initials = React.useMemo(() => {
    if (avatarUrl && !isUrl) {
      // Backend already provided initials (e.g., "WYW")
      return avatarUrl;
    }
    // Fallback: calculate 2-letter initials from name
    if (!name || typeof name !== 'string') return '?';
    const trimmedName = name.trim();
    if (!trimmedName) return '?';

    const parts = trimmedName.split(/\s+/).filter(Boolean);
    const initialsText = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
    return initialsText || trimmedName[0]?.toUpperCase() || "?";
  }, [name, avatarUrl, isUrl]);

  return isUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={name}
      className="w-20 h-20 rounded-full border object-cover"
      loading="lazy"
    />
  ) : (
    <div className="w-20 h-20 rounded-full border bg-muted flex items-center justify-center">
      <span className="text-2xl font-semibold text-muted-foreground">
        {initials}
      </span>
    </div>
  );
}

export default function TeacherDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const teacherId = params.teacherId as string;

  const [teacher, setTeacher] = React.useState<Teacher | null>(null);
  const [courses, setCourses] = React.useState<TeacherCourseRef[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch teacher data from backend
  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      try {
        const [teacherData, coursesData] = await Promise.all([
          fetchTeacherById(teacherId),
          fetchTeacherCourses(teacherId),
        ]);

        if (!cancelled) {
          setTeacher(teacherData);
          setCourses(coursesData);
        }
      } catch (error) {
        console.error('Failed to load teacher data:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [teacherId]);

  const handleBackClick = () => router.back();

  // Loading state
  if (isLoading) {
    return (
      <>
        <SiteNavigation showBackButton={true} onBackClick={handleBackClick} />
        <div className="min-h-screen bg-background">
          <main className="w-full py-8">
            <div className="container mx-auto px-4 max-w-3xl">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">{t('teachers.loading')}</p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </>
    );
  }

  // Not found state
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
                  <TeacherAvatar name={teacher.name} avatarUrl={teacher.avatarUrl} />
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold leading-tight truncate">{teacher.name}</h1>
                    <div className="text-sm text-muted-foreground mt-1">
                      {[teacher.title, teacher.department].filter(Boolean).join(' · ')}
                    </div>
                    {/* External homepage link removed; navigate via internal UUID profile */}
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
                  <div className="space-y-4 text-sm text-foreground">
                    {teacher.biography && (
                      <div>
                        <div className="text-muted-foreground mb-1">{t('teacher.biography')}</div>
                        <div className="whitespace-pre-line leading-7">{teacher.biography}</div>
                      </div>
                    )}
                    {teacher.researchInterests && (
                      <div>
                        <div className="text-muted-foreground mb-1">{t('teacher.researchInterests')}</div>
                        <div className="whitespace-pre-line leading-7">{teacher.researchInterests}</div>
                      </div>
                    )}
                    {teacher.academicAndProfessionalExperience && (
                      <div>
                        <div className="text-muted-foreground mb-1">{t('teacher.experience')}</div>
                        <div className="whitespace-pre-line leading-7">{teacher.academicAndProfessionalExperience}</div>
                      </div>
                    )}
                    {teacher.professionalQualifications && (
                      <div>
                        <div className="text-muted-foreground mb-1">{t('teacher.qualifications')}</div>
                        <div className="whitespace-pre-line leading-7">{teacher.professionalQualifications}</div>
                      </div>
                    )}
                    {!teacher.biography && !teacher.researchInterests && !teacher.academicAndProfessionalExperience && !teacher.professionalQualifications && (
                      <div className="text-muted-foreground">{t('teachers.noBio')}</div>
                    )}
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
                  {teacher.websiteUrl && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.homepage')}</div>
                      <Link className="text-primary underline break-all" href={teacher.websiteUrl} target="_blank">
                        {teacher.websiteName || teacher.websiteUrl}
                      </Link>
                    </div>
                  )}
                  {teacher.phone && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.phone')}</div>
                      <div className="truncate">{teacher.phone}</div>
                    </div>
                  )}
                  {teacher.profileUrl && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.profile')}</div>
                      <Link className="text-primary underline break-all" href={teacher.profileUrl} target="_blank">
                        {teacher.profileUrl}
                      </Link>
                    </div>
                  )}
                  {teacher.scholarsHubUrl && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.scholarsHub')}</div>
                      <Link className="text-primary underline break-all" href={teacher.scholarsHubUrl} target="_blank">
                        {teacher.scholarsHubUrl}
                      </Link>
                    </div>
                  )}
                  {teacher.orcid && (teacher.orcid.id || teacher.orcid.url) && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.orcid')}</div>
                      {teacher.orcid.url ? (
                        <Link className="text-primary underline break-all" href={teacher.orcid.url} target="_blank">
                          {teacher.orcid.id || teacher.orcid.url}
                        </Link>
                      ) : (
                        <div className="truncate">{teacher.orcid.id}</div>
                      )}
                    </div>
                  )}
                  {teacher.scopus && (teacher.scopus.id || teacher.scopus.url) && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.scopus')}</div>
                      {teacher.scopus.url ? (
                        <Link className="text-primary underline break-all" href={teacher.scopus.url} target="_blank">
                          {teacher.scopus.id || teacher.scopus.url}
                        </Link>
                      ) : (
                        <div className="truncate">{teacher.scopus.id}</div>
                      )}
                    </div>
                  )}
                  {teacher.researchId && (teacher.researchId.id || teacher.researchId.url) && (
                    <div>
                      <div className="text-muted-foreground">{t('teacher.researcherId')}</div>
                      {teacher.researchId.url ? (
                        <Link className="text-primary underline break-all" href={teacher.researchId.url} target="_blank">
                          {teacher.researchId.id || teacher.researchId.url}
                        </Link>
                      ) : (
                        <div className="truncate">{teacher.researchId.id}</div>
                      )}
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
                      <Link key={course.courseId} href={`/courses/${course.courseId}`}>
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
