"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { CourseBackgroundCard } from "@/components/CourseBackgroundCard";
import { CoursePreviewCard } from "@/components/CoursePreviewCard";
import { useI18n } from "@/hooks/use-i18n";
import type { CourseDepartmentData } from "@/types";
import { fetchCourses, fetchCourseDepartmentsWithCounts, fetchDepartmentLevels } from "@/lib/api/course";
import { Building2, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatDepartmentTitle } from "@/lib/dept-display-utils";

export default function CourseBrowsePage() {
  const { t } = useI18n();
  const [departments, setDepartments] = React.useState<CourseDepartmentData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Selection state for three-column layout (with persistence)
  const [selectedDepartment, setSelectedDepartment] = React.useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = React.useState<string | null>(null);
  
  // Mobile step navigation: 1 = departments, 2 = levels, 3 = courses
  const [mobileStep, setMobileStep] = React.useState<1 | 2 | 3>(1);
  
  // Track active requests for cancellation
  const abortControllersRef = React.useRef<Map<string, AbortController>>(new Map());

  // Restore selection from sessionStorage after hydration (client-side only)
  React.useEffect(() => {
    const savedDepartment = sessionStorage.getItem('courses_selectedDepartment');
    const savedLevel = sessionStorage.getItem('courses_selectedLevel');
    
    if (savedDepartment) {
      setSelectedDepartment(savedDepartment);
    }
    if (savedLevel) {
      setSelectedLevel(savedLevel);
    }
  }, []);

  // Initial load: fetch department list with counts
  React.useEffect(() => {
    const abortController = new AbortController();
    
    const loadDepartmentList = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch departments with counts in a single optimized request
        const deptInfos = await fetchCourseDepartmentsWithCounts({ signal: abortController.signal });
        
        // Check if component is unmounted
        if (abortController.signal.aborted) return;
        
        setDepartments(deptInfos);
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error("Failed to load departments:", err);
        // Store the translation key instead of translated text
        // to avoid t function dependency causing re-runs on language change
        setError("common.loadFailedRetry");
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadDepartmentList();
    
    // Cleanup function to abort requests on unmount
    return () => {
      abortController.abort();
    };
    // Empty dependency array - only run once on mount
  }, []);

  // Load levels for a specific department
  const loadDepartmentLevels = React.useCallback(async (deptName: string) => {
    // Cancel previous request for this department
    const key = `levels-${deptName}`;
    abortControllersRef.current.get(key)?.abort();
    const abortController = new AbortController();
    abortControllersRef.current.set(key, abortController);

    setDepartments((prev) =>
      prev.map((dept) =>
        dept.name === deptName ? { ...dept, loading: true, error: false } : dept
      )
    );

    try {
      // Fetch level distribution (lightweight query)
      const levels = await fetchDepartmentLevels(deptName, { signal: abortController.signal });
      
      if (abortController.signal.aborted) return undefined;

      setDepartments((prev) =>
        prev.map((dept) =>
          dept.name === deptName
            ? { ...dept, levels, loading: false }
            : dept
        )
      );
      
      return levels; // Return the loaded levels for use by caller
    } catch (err) {
      if (abortController.signal.aborted) return undefined;
      console.error(`Failed to load levels for ${deptName}:`, err);
      setDepartments((prev) =>
        prev.map((dept) =>
          dept.name === deptName ? { ...dept, loading: false, error: true } : dept
        )
      );
      return undefined;
    } finally {
      const current = abortControllersRef.current.get(key);
      if (current === abortController) {
        abortControllersRef.current.delete(key);
        if (abortController.signal.aborted) {
          // Reset loading to false if this request was aborted and is still the latest for this key
          setDepartments((prev) =>
            prev.map((dept) =>
              dept.name === deptName ? { ...dept, loading: false } : dept
            )
          );
        }
      }
    }
  }, []);

  // Load courses for a specific department and level
  const loadLevelCourses = React.useCallback(async (deptName: string, level: string) => {
    // Cancel previous request for this department-level combination
    const key = `courses-${deptName}-${level}`;
    abortControllersRef.current.get(key)?.abort();
    const abortController = new AbortController();
    abortControllersRef.current.set(key, abortController);

    // Set loading state for this specific level
    setDepartments((prev) =>
      prev.map((dept) => {
        if (dept.name !== deptName) return dept;
        
        const coursesByLevel = dept.coursesByLevel || {};
        return {
          ...dept,
          coursesByLevel: {
            ...coursesByLevel,
            [level]: {
              courses: coursesByLevel[level]?.courses || [],
              loading: true,
              error: false,
            }
          }
        };
      })
    );

    try {
      // Fetch courses for specific department + level (precise query)
      const response = await fetchCourses({
        page: 1,
        pageSize: 100, // Should be enough for one level
        departments: [deptName],
        level: [level === "Other" ? "" : level], // Handle "Other" case
        ordering: "-rating_score",
      }, { signal: abortController.signal });
      
      if (abortController.signal.aborted) return;

      // Store courses in per-level cache
      setDepartments((prev) =>
        prev.map((dept) => {
          if (dept.name !== deptName) return dept;
          
          const coursesByLevel = dept.coursesByLevel || {};
          return {
            ...dept,
            coursesByLevel: {
              ...coursesByLevel,
              [level]: {
                courses: response.results,
                loading: false,
                error: false,
              }
            }
          };
        })
      );
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.error(`Failed to load courses for ${deptName} level ${level}:`, err);
      
      // Set error state for this specific level
      setDepartments((prev) =>
        prev.map((dept) => {
          if (dept.name !== deptName) return dept;
          
          const coursesByLevel = dept.coursesByLevel || {};
          return {
            ...dept,
            coursesByLevel: {
              ...coursesByLevel,
              [level]: {
                courses: coursesByLevel[level]?.courses || [],
                loading: false,
                error: true,
              }
            }
          };
        })
      );
    } finally {
      const current = abortControllersRef.current.get(key);
      if (current === abortController) {
        abortControllersRef.current.delete(key);
        if (abortController.signal.aborted) {
          // Reset level-specific loading to false if this request was aborted and is still the latest for this key
          setDepartments((prev) =>
            prev.map((dept) => {
              if (dept.name !== deptName) return dept;
              const coursesByLevel = dept.coursesByLevel || {};
              const prevLevel = coursesByLevel[level] || { courses: [] };
              return {
                ...dept,
                coursesByLevel: {
                  ...coursesByLevel,
                  [level]: {
                    ...prevLevel,
                    loading: false,
                  },
                },
              };
            })
          );
        }
      }
    }
  }, []);

  // Auto-load levels when a department is selected
  React.useEffect(() => {
    if (!selectedDepartment || loading || departments.length === 0) return;
    
    const dept = departments.find((d) => d.name === selectedDepartment);
    if (!dept) return;
    
    // Load levels if not already loaded or loading
    if (!dept.levels && !dept.loading) {
      loadDepartmentLevels(selectedDepartment);
    }
  }, [selectedDepartment, loading, departments, loadDepartmentLevels]);

  // Auto-load courses when a level is selected and levels are available
  React.useEffect(() => {
    if (!selectedDepartment || !selectedLevel || loading || departments.length === 0) return;
    
    const dept = departments.find((d) => d.name === selectedDepartment);
    if (!dept?.levels || dept.loading) return;
    
    // Check if the selected level exists in the loaded levels
    const levelExists = dept.levels.some(l => l.level === selectedLevel);
    if (!levelExists) return;
    
    // Check if courses for this level are already cached
    const levelCache = dept.coursesByLevel?.[selectedLevel];
    if (levelCache?.courses && levelCache.courses.length > 0) {
      // Already have data for this level, no need to reload
      return;
    }
    
    // Check if already loading for this level
    if (levelCache?.loading) {
      return;
    }
    
    // Load courses for the selected level
    loadLevelCourses(selectedDepartment, selectedLevel);
  }, [selectedDepartment, selectedLevel, loading, departments, loadLevelCourses]);

  // Handle department selection
  const handleDepartmentClick = React.useCallback(
    (deptName: string) => {
      setSelectedDepartment(deptName);
      setSelectedLevel(null); // Reset level selection
      setMobileStep(2); // Go to level selection on mobile
      
      // Save to session storage
      sessionStorage.setItem('courses_selectedDepartment', deptName);
      sessionStorage.removeItem('courses_selectedLevel');
      
      // Note: levels will be auto-loaded by the effect above
    },
    []
  );

  // Handle level selection
  const handleLevelClick = React.useCallback(
    (level: string) => {
      if (!selectedDepartment) return;
      
      setSelectedLevel(level);
      setMobileStep(3); // Go to courses on mobile
      
      // Save to session storage
      sessionStorage.setItem('courses_selectedLevel', level);
      
      // Note: courses will be auto-loaded by the effect above
    },
    [selectedDepartment]
  );

  // Handle mobile back navigation
  const handleMobileBack = React.useCallback(() => {
    if (mobileStep === 3) {
      setMobileStep(2);
    } else if (mobileStep === 2) {
      setMobileStep(1);
      setSelectedDepartment(null);
      setSelectedLevel(null);
      sessionStorage.removeItem('courses_selectedDepartment');
      sessionStorage.removeItem('courses_selectedLevel');
    }
  }, [mobileStep]);

  // Get levels for selected department (from loaded data)
  const selectedDeptLevels = React.useMemo(() => {
    if (!selectedDepartment) return [];
    const dept = departments.find((d) => d.name === selectedDepartment);
    return dept?.levels || [];
  }, [selectedDepartment, departments]);

  // Get courses for selected level (from per-level cache)
  const selectedLevelCourses = React.useMemo(() => {
    if (!selectedDepartment || !selectedLevel) return [];
    const dept = departments.find((d) => d.name === selectedDepartment);
    return dept?.coursesByLevel?.[selectedLevel]?.courses || [];
  }, [selectedDepartment, selectedLevel, departments]);
  
  // Get loading/error state for selected level
  const selectedLevelLoading = React.useMemo(() => {
    if (!selectedDepartment || !selectedLevel) return false;
    const dept = departments.find((d) => d.name === selectedDepartment);
    return dept?.coursesByLevel?.[selectedLevel]?.loading || false;
  }, [selectedDepartment, selectedLevel, departments]);
  
  const selectedLevelError = React.useMemo(() => {
    if (!selectedDepartment || !selectedLevel) return false;
    const dept = departments.find((d) => d.name === selectedDepartment);
    return dept?.coursesByLevel?.[selectedLevel]?.error || false;
  }, [selectedDepartment, selectedLevel, departments]);

  // Handle retry after error
  const handleRetry = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const deptInfos = await fetchCourseDepartmentsWithCounts();
      setDepartments(deptInfos);
    } catch (err) {
      console.error("Retry failed:", err);
      setError("common.loadFailedRetry");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-4 sm:py-8">
          <div className="w-full px-2 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <CourseBackgroundCard>
                {/* Page Header */}
                <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 p-2.5 rounded-lg bg-primary/10">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-bold text-foreground">
                        {t("courses.byDepartment.title")}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        {t("courses.byDepartment.subtitle")}
                      </p>
                    </div>
                  </div>
                  {/* Guide Link to Advanced Search */}
                  <Link
                    href="/courses/advanced-search"
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 border border-primary/20 rounded-md hover:bg-primary/5 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("courses.byDepartment.advancedSearch")}</span>
                    <span className="sm:hidden">{t("courses.byDepartment.search")}</span>
                  </Link>
                </div>

                {/* Loading State */}
                {loading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {t("courses.byDepartment.loading")}
                    </span>
                  </div>
                )}

                {/* Error State */}
                {error && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <p className="text-destructive">{t(error)}</p>
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      {t("search.retry")}
                    </button>
                  </div>
                )}

                {/* Desktop: Three-Column Layout / Mobile: Step-by-Step */}
                {!loading && !error && departments.length > 0 && (
                  <>
                    {/* Desktop Layout (lg and above) */}
                    <div className="hidden lg:grid lg:grid-cols-12 gap-4 min-h-[600px]">
                      {/* Left Column: Departments */}
                      <div className="lg:col-span-4 space-y-2">
                        <div className="text-sm font-medium text-muted-foreground mb-3 px-1">
                          {t("courses.byDepartment.selectDepartment")}
                        </div>
                        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                          {departments.map((dept) => (
                            <button
                              key={dept.name}
                              onClick={() => handleDepartmentClick(dept.name)}
                              className={cn(
                                "w-full text-left px-3 py-2.5 rounded-md transition-colors",
                                "flex items-center justify-between gap-2",
                                selectedDepartment === dept.name
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent"
                              )}
                            >
                              <span className="text-sm font-medium truncate">{formatDepartmentTitle(dept.name)}</span>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                                selectedDepartment === dept.name
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                              )}>
                                {dept.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Middle Column: Levels */}
                      <div className="lg:col-span-2 space-y-2">
                        <div className="text-sm font-medium text-muted-foreground mb-3 px-1">
                          {t("courses.byDepartment.selectLevel")}
                        </div>
                        {!selectedDepartment ? (
                          <div className="flex items-center justify-center py-12 text-center">
                            <p className="text-sm text-muted-foreground">
                              {t("courses.byDepartment.selectDepartmentFirst")}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                            {departments.find(d => d.name === selectedDepartment)?.loading && (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                              </div>
                            )}
                            {selectedDeptLevels.map(({ level, count }) => (
                              <button
                                key={level}
                                onClick={() => handleLevelClick(level)}
                                className={cn(
                                  "w-full text-left px-3 py-2.5 rounded-md transition-colors",
                                  "flex items-center justify-between gap-2",
                                  selectedLevel === level
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent"
                                )}
                              >
                                <span className="text-sm font-medium">
                                  {t("courses.byDepartment.levelLabel", { level })}
                                </span>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                                  selectedLevel === level
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-secondary text-muted-foreground"
                                )}>
                                  {count}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right Column: Courses */}
                      <div className="lg:col-span-6">
                        <div className="text-sm font-medium text-muted-foreground mb-3 px-1">
                          {t("courses.byDepartment.courses")}
                        </div>
                        {!selectedLevel ? (
                          <div className="flex items-center justify-center py-12 text-center">
                            <p className="text-sm text-muted-foreground">
                              {t("courses.byDepartment.selectLevelFirst")}
                            </p>
                          </div>
                        ) : selectedLevelLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : selectedLevelError ? (
                          <div className="flex items-center justify-center py-12 text-center">
                            <p className="text-sm text-destructive">
                              {t("common.loadFailedRetry")}
                            </p>
                          </div>
                        ) : selectedLevelCourses.length === 0 ? (
                          <div className="flex items-center justify-center py-12 text-center">
                            <p className="text-sm text-muted-foreground">
                              {t("courses.byDepartment.noCourses")}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {selectedLevelCourses.map((course) => (
                              <CoursePreviewCard
                                key={course.courseId}
                                courseId={course.courseId}
                                subjectCode={course.subjectCode}
                                title={course.title}
                                term={course.term}
                                terms={course.terms}
                                rating={course.rating}
                                attributes={course.attributes}
                                teachers={course.teachers}
                                department={course.department}
                                lastUpdated={course.lastUpdated}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile Layout (below lg) - Step by Step */}
                    <div className="lg:hidden">
                      {/* Mobile Step 1: Departments */}
                      {mobileStep === 1 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center py-2">
                            <span className="text-sm font-medium text-foreground">
                              {t("courses.byDepartment.step1")}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {departments.map((dept) => (
                              <button
                                key={dept.name}
                                onClick={() => handleDepartmentClick(dept.name)}
                                className={cn(
                                  "w-full text-left px-3 py-3 rounded-md transition-colors",
                                  "flex items-center justify-between gap-2",
                                  "hover:bg-accent active:bg-accent/80"
                                )}
                              >
                                <span className="text-sm font-medium truncate">{formatDepartmentTitle(dept.name)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                    {dept.count}
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mobile Step 2: Levels */}
                      {mobileStep === 2 && selectedDepartment && (
                        <div className="space-y-3">
                          {/* Header: Back button + Step indicator */}
                          <div className="relative flex items-center justify-center py-2">
                            <button
                              onClick={handleMobileBack}
                              className="absolute left-0 flex items-center gap-1 px-2 py-1 text-sm text-primary rounded-md hover:bg-accent hover:shadow-sm transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              {t("courses.byDepartment.back")}
                            </button>
                            <span className="text-sm font-medium text-foreground">
                              {t("courses.byDepartment.step2")}
                            </span>
                          </div>
                          
                          {/* Selected department indicator */}
                          <div className="px-3 py-2 rounded-md bg-primary/10 border border-primary/20">
                            <span className="text-sm font-medium text-primary">{formatDepartmentTitle(selectedDepartment)}</span>
                          </div>
                          
                          {departments.find(d => d.name === selectedDepartment)?.loading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {selectedDeptLevels.map(({ level, count }) => (
                                <button
                                  key={level}
                                  onClick={() => handleLevelClick(level)}
                                  className={cn(
                                    "w-full text-left px-3 py-3 rounded-md transition-colors",
                                    "flex items-center justify-between gap-2",
                                    "hover:bg-accent active:bg-accent/80"
                                  )}
                                >
                                  <span className="text-sm font-medium">
                                    {t("courses.byDepartment.levelLabel", { level })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                      {count}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Mobile Step 3: Courses */}
                      {mobileStep === 3 && selectedDepartment && selectedLevel && (
                        <div className="space-y-3">
                          {/* Header: Back button + Step indicator */}
                          <div className="relative flex items-center justify-center py-2">
                            <button
                              onClick={handleMobileBack}
                              className="absolute left-0 flex items-center gap-1 px-2 py-1 text-sm text-primary rounded-md hover:bg-accent hover:shadow-sm transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              {t("courses.byDepartment.back")}
                            </button>
                            <span className="text-sm font-medium text-foreground">
                              {t("courses.byDepartment.step3")}
                            </span>
                          </div>
                          
                          {/* Breadcrumb */}
                          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                            <span className="truncate">{formatDepartmentTitle(selectedDepartment)}</span>
                            <ChevronRight className="w-3 h-3 flex-shrink-0" />
                            <span>{t("courses.byDepartment.levelLabel", { level: selectedLevel })}</span>
                          </div>
                          
                          {selectedLevelLoading ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                          ) : selectedLevelError ? (
                            <div className="flex items-center justify-center py-12 text-center">
                              <p className="text-sm text-destructive">
                                {t("common.loadFailedRetry")}
                              </p>
                            </div>
                          ) : selectedLevelCourses.length === 0 ? (
                            <div className="flex items-center justify-center py-12 text-center">
                              <p className="text-sm text-muted-foreground">
                                {t("courses.byDepartment.noCourses")}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {selectedLevelCourses.map((course) => (
                                <CoursePreviewCard
                                  key={course.courseId}
                                  courseId={course.courseId}
                                  subjectCode={course.subjectCode}
                                  title={course.title}
                                  term={course.term}
                                  terms={course.terms}
                                  rating={course.rating}
                                  attributes={course.attributes}
                                  teachers={course.teachers}
                                  department={course.department}
                                  lastUpdated={course.lastUpdated}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Empty State */}
                {!loading && !error && departments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">
                      {t("courses.byDepartment.noCourses")}
                    </p>
                  </div>
                )}
              </CourseBackgroundCard>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
