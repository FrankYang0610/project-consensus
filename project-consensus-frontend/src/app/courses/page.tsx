"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CourseBackgroundCard } from "@/components/CourseBackgroundCard";
import { CoursePreviewCard } from "@/components/CoursePreviewCard";
import { useI18n } from "@/hooks/use-i18n";
import type { Course, CourseDepartmentData } from "@/types";
import { fetchCourses, fetchCourseDepartmentsWithCounts, fetchDepartmentLevels } from "@/lib/api/course";
import { Building2, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// No longer needed - levels are loaded from backend

export default function CourseBrowsePage() {
  const { t } = useI18n();
  const [departments, setDepartments] = React.useState<CourseDepartmentData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Selection state for three-column layout (with persistence)
  const [selectedDepartment, setSelectedDepartment] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('courses_selectedDepartment') || null;
    }
    return null;
  });
  const [selectedLevel, setSelectedLevel] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('courses_selectedLevel') || null;
    }
    return null;
  });
  
  // Track if we've already restored the selection to prevent infinite loops
  const hasRestoredRef = React.useRef(false);
  
  // Track active requests for cancellation
  const abortControllersRef = React.useRef<Map<string, AbortController>>(new Map());

  // Initial load: fetch department list with counts
  React.useEffect(() => {
    const abortController = new AbortController();
    
    const loadDepartmentList = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch departments with counts in a single optimized request
        const deptInfos = await fetchCourseDepartmentsWithCounts();
        
        // Check if component is unmounted
        if (abortController.signal.aborted) return;
        
        // Data is already sorted by backend
        
        setDepartments(deptInfos);
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error("Failed to load departments:", err);
        setError(t("common.loadFailedRetry"));
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
  }, [t]);

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
      const levels = await fetchDepartmentLevels(deptName);
      
      if (abortController.signal.aborted) return;

      setDepartments((prev) =>
        prev.map((dept) =>
          dept.name === deptName
            ? { ...dept, levels, loading: false }
            : dept
        )
      );
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.error(`Failed to load levels for ${deptName}:`, err);
      setDepartments((prev) =>
        prev.map((dept) =>
          dept.name === deptName ? { ...dept, loading: false, error: true } : dept
        )
      );
    } finally {
      abortControllersRef.current.delete(key);
    }
  }, []);

  // Load courses for a specific department and level
  const loadLevelCourses = React.useCallback(async (deptName: string, level: string) => {
    // Cancel previous request for this department-level combination
    const key = `courses-${deptName}-${level}`;
    abortControllersRef.current.get(key)?.abort();
    const abortController = new AbortController();
    abortControllersRef.current.set(key, abortController);

    setDepartments((prev) =>
      prev.map((dept) =>
        dept.name === deptName ? { ...dept, loading: true, error: false } : dept
      )
    );

    try {
      // Fetch courses for specific department + level (precise query)
      const response = await fetchCourses({
        page: 1,
        pageSize: 100, // Should be enough for one level
        department: [deptName],
        level: [level === "Other" ? "" : level], // Handle "Other" case
        ordering: "-rating_score",
      });
      
      if (abortController.signal.aborted) return;

      setDepartments((prev) =>
        prev.map((dept) =>
          dept.name === deptName
            ? { ...dept, courses: response.results, loading: false }
            : dept
        )
      );
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.error(`Failed to load courses for ${deptName} level ${level}:`, err);
      setDepartments((prev) =>
        prev.map((dept) =>
          dept.name === deptName ? { ...dept, loading: false, error: true } : dept
        )
      );
    } finally {
      abortControllersRef.current.delete(key);
    }
  }, []);

  // Restore previous selection after departments are loaded
  React.useEffect(() => {
    // Only restore once and only after initial load completes
    if (loading || departments.length === 0 || hasRestoredRef.current) return;
    if (!selectedDepartment) return;
    
    hasRestoredRef.current = true; // Mark as restored to prevent re-runs
    
    const dept = departments.find((d) => d.name === selectedDepartment);
    if (!dept) return;
    
    // Async function to handle the restoration sequence
    const restoreSelection = async () => {
      try {
        // Step 1: Load levels if needed
        if (!dept.levels && !dept.loading) {
          await loadDepartmentLevels(selectedDepartment);
          
          // Step 2: After levels are loaded, load courses if there's a selected level
          // Use a small delay to allow React to process the state update
          if (selectedLevel) {
            await new Promise(resolve => setTimeout(resolve, 50));
            // Re-check departments state via a callback-based approach
            setDepartments((currentDepts) => {
              const updatedDept = currentDepts.find((d) => d.name === selectedDepartment);
              if (updatedDept?.levels && selectedLevel) {
                const levelExists = updatedDept.levels.some(l => l.level === selectedLevel);
                if (levelExists) {
                  // Trigger course loading outside state setter
                  Promise.resolve().then(() => loadLevelCourses(selectedDepartment, selectedLevel));
                }
              }
              return currentDepts; // No state change
            });
          }
        } else if (dept.levels && selectedLevel) {
          // Levels already exist, just load courses
          const levelExists = dept.levels.some(l => l.level === selectedLevel);
          if (levelExists) {
            loadLevelCourses(selectedDepartment, selectedLevel);
          }
        }
      } catch (err) {
        console.error('Failed to restore selection:', err);
      }
    };
    
    restoreSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, departments.length]); // Intentionally minimal dependencies

  // Handle department selection
  const handleDepartmentClick = React.useCallback(
    (deptName: string) => {
      setSelectedDepartment(deptName);
      setSelectedLevel(null); // Reset level selection
      
      // Save to session storage (client-side only, but these callbacks only run client-side)
      sessionStorage.setItem('courses_selectedDepartment', deptName);
      sessionStorage.removeItem('courses_selectedLevel');
      
      // Load levels if not already loaded
      const dept = departments.find((d) => d.name === deptName);
      if (dept && !dept.levels && !dept.loading) {
        loadDepartmentLevels(deptName);
      }
    },
    [departments, loadDepartmentLevels]
  );

  // Handle level selection
  const handleLevelClick = React.useCallback(
    (level: string) => {
      if (!selectedDepartment) return;
      
      setSelectedLevel(level);
      
      // Save to session storage (client-side only, but these callbacks only run client-side)
      sessionStorage.setItem('courses_selectedLevel', level);
      
      // Load courses for this specific level
      loadLevelCourses(selectedDepartment, level);
    },
    [selectedDepartment, loadLevelCourses]
  );

  // Get levels for selected department (from loaded data)
  const selectedDeptLevels = React.useMemo(() => {
    if (!selectedDepartment) return [];
    const dept = departments.find((d) => d.name === selectedDepartment);
    return dept?.levels || [];
  }, [selectedDepartment, departments]);

  // Get courses for selected level (from loaded data)
  const selectedLevelCourses = React.useMemo(() => {
    if (!selectedDepartment || !selectedLevel) return [];
    const dept = departments.find((d) => d.name === selectedDepartment);
    return dept?.courses || [];
  }, [selectedDepartment, selectedLevel, departments]);

  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-6 sm:py-8">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto mb-6">
              <Alert>
                <AlertTitle>{t("common.note")}</AlertTitle>
                <AlertDescription>
                  {t("common.developmentNotice")}
                </AlertDescription>
              </Alert>
            </div>

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
                    <p className="text-destructive">{error}</p>
                    <button
                      onClick={async () => {
                        setError(null);
                        setLoading(true);
                        try {
                          const deptInfos = await fetchCourseDepartmentsWithCounts();
                          setDepartments(deptInfos);
                        } catch (err) {
                          console.error("Retry failed:", err);
                          setError(t("common.loadFailedRetry"));
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      {t("search.retry")}
                    </button>
                  </div>
                )}

                {/* Three-Column Layout */}
                {!loading && !error && departments.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
                    {/* Left Column: Departments */}
                    <div className="lg:col-span-3 space-y-2">
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
                            <span className="text-sm font-medium truncate">{dept.name}</span>
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
                    <div className="lg:col-span-3 space-y-2">
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
