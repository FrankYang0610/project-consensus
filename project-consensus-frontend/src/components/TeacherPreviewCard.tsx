import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/use-i18n";
import type { Teacher } from "@/types";

export interface TeacherPreviewCardProps {
  teacher: Teacher;
}

export function TeacherPreviewCard({ teacher }: TeacherPreviewCardProps) {
  const { t } = useI18n();
  
  // Check if avatarUrl is a full URL or initials from backend
  const isUrl = teacher.avatarUrl?.startsWith('http://') || teacher.avatarUrl?.startsWith('https://');
  const initials = React.useMemo(() => {
    if (teacher.avatarUrl && !isUrl) {
      // Backend already provided initials
      return teacher.avatarUrl;
    }
    // Fallback: calculate initials from name
    const parts = teacher.name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 3).map(p => p[0]?.toUpperCase()).join("") || "?";
  }, [teacher.avatarUrl, teacher.name, isUrl]);

  return (
    <Link
      href={`/teachers/${teacher.id}`}
    >
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {isUrl ? (
              <img
                src={teacher.avatarUrl}
                alt={teacher.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-muted object-cover flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-muted bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-xl sm:text-2xl font-semibold text-muted-foreground">
                  {initials}
                </span>
              </div>
            )}

            {/* Teacher Info */}
            <div className="flex-1 min-w-0">
              {/* Name and Title */}
              <div className="mb-2">
                <h3 className="text-base sm:text-lg font-semibold truncate">
                  {teacher.name}
                </h3>
                {teacher.title && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {teacher.title}
                  </p>
                )}
                {teacher.department && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {teacher.department}
                  </p>
                )}
              </div>

              {/* Rating and Stats */}
              <div className="flex items-center gap-3 sm:gap-4 mb-3">
                {teacher.rating && teacher.rating.overall !== null && teacher.rating.overall !== undefined && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-lg sm:text-xl font-bold text-primary">
                        {teacher.rating.overall.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        /10
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {t("teachers.reviews", { count: teacher.rating.reviewsCount || 0 })}
                    </div>
                  </>
                )}
              </div>

              {/* Tags */}
              {teacher.tags && teacher.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {teacher.tags.slice(0, 3).map((tag, index) => (
                    <Badge
                      key={`${teacher.id}-tag-${index}`}
                      variant="secondary"
                      className="text-xs px-2 py-0.5"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {teacher.tags.length > 3 && (
                    <Badge
                      variant="outline"
                      className="text-xs px-2 py-0.5"
                    >
                      +{teacher.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Languages */}
              {teacher.languages && teacher.languages.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  🗣️ {teacher.languages.join(', ')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

