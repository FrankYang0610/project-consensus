import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SearchResult } from '@/types/search';
import { MessageSquare, BookOpen, FileText, User, GraduationCap, Star, Users } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { stripHtml, getHighlightParts, buildSearchResultTitle, translateAuthorName, type TextPart } from '@/lib/search-utils';

// Render highlighted text from TextPart array
function renderHighlightedText(parts: TextPart[]): React.ReactNode {
  return parts.map((part, i) => 
    part.isHighlighted ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
        {part.text}
      </mark>
    ) : (
      part.text
    )
  );
}

interface SearchResultCardProps {
  result: SearchResult;
  className?: string;
  highlight?: string; // Search query to highlight
}

export function SearchResultCard({ result, className, highlight }: SearchResultCardProps) {
  const { t } = useI18n();

  // Build localized title based on backend metadata
  const displayTitle = buildSearchResultTitle(result.title, result.metadata, t);

  // Get icon and color based on type
  const getTypeInfo = () => {
    switch (result.type) {
      case 'course':
        return {
          icon: <GraduationCap className="w-5 h-5" />,
          label: t('search.types.course'),
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-950'
        };
      case 'forum_post':
        return {
          icon: <MessageSquare className="w-5 h-5" />,
          label: t('search.types.forum_post'),
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950'
        };
      case 'forum_comment':
        return {
          icon: <MessageSquare className="w-5 h-5" />,
          label: t('search.types.forum_comment'),
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950'
        };
      case 'course_review':
        return {
          icon: <Star className="w-5 h-5" />,
          label: t('search.types.course_review'),
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-50 dark:bg-amber-950'
        };
      case 'wiki':
        return {
          icon: <BookOpen className="w-5 h-5" />,
          label: t('search.types.wiki'),
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-950'
        };
      case 'teacher':
        return {
          icon: <User className="w-5 h-5" />,
          label: t('search.types.teacher'),
          color: 'text-indigo-600 dark:text-indigo-400',
          bgColor: 'bg-indigo-50 dark:bg-indigo-950'
        };
      case 'user':
        return {
          icon: <Users className="w-5 h-5" />,
          label: t('search.types.user'),
          color: 'text-pink-600 dark:text-pink-400',
          bgColor: 'bg-pink-50 dark:bg-pink-950'
        };
      default:
        return {
          icon: <FileText className="w-5 h-5" />,
          label: result.type,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950'
        };
    }
  };

  const typeInfo = getTypeInfo();
  
  // Strip HTML and prepare snippet
  const cleanSnippet = stripHtml(result.snippet);

  return (
    <Link
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block p-4 rounded-lg border transition-colors",
        "hover:bg-accent hover:border-accent-foreground/20",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
    >
      {/* Header with type badge */}
      <div className="flex items-start gap-3 mb-2">
        <div className={cn(
          "p-2 rounded-md shrink-0",
          typeInfo.bgColor
        )}>
          <div className={typeInfo.color}>
            {typeInfo.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              typeInfo.bgColor,
              typeInfo.color
            )}>
              {typeInfo.label}
            </span>
            {result.metadata.rating && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="w-3 h-3 fill-current text-yellow-500" />
                {result.metadata.rating.toFixed(1)}
              </span>
            )}
          </div>
          {/* Title with highlight */}
          <h3 className="font-semibold text-base line-clamp-2 break-words">
            {renderHighlightedText(getHighlightParts(displayTitle, highlight))}
          </h3>
        </div>
      </div>

      {/* Snippet with highlight */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-2 ml-[52px]">
        {renderHighlightedText(getHighlightParts(cleanSnippet, highlight))}
      </p>

      {/* Metadata footer */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground ml-[52px]">
        {result.metadata.author && (
          <span>
            {translateAuthorName(result.metadata.author, t)}
          </span>
        )}
        {result.metadata.department && (
          <span>
            {result.metadata.department}
          </span>
        )}
        {result.metadata.posts_count !== undefined && result.metadata.reviews_count !== undefined && (
          <span>
            {t('search.resultTitle.userStats', { 
              posts: result.metadata.posts_count, 
              reviews: result.metadata.reviews_count 
            })}
          </span>
        )}
        {result.metadata.created_at && (
          <span>
            {new Date(result.metadata.created_at).toLocaleDateString()}
          </span>
        )}
        {result.metadata.likes_count !== undefined && result.metadata.likes_count > 0 && (
          <span>
            {result.metadata.likes_count} {t('search.likes')}
          </span>
        )}
        {result.metadata.view_count !== undefined && result.metadata.view_count > 0 && (
          <span>
            {result.metadata.view_count} {t('search.views')}
          </span>
        )}
      </div>
    </Link>
  );
}

