import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { searchSuggestions } from '@/lib/api/search';
import { SearchResult } from '@/types/search';
import { stripHtml, getHighlightParts, getSearchTypeLabel, validateSearchQuery, type TextPart } from '@/lib/search-utils';
import { useI18n } from '@/hooks/use-i18n';

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
import Link from 'next/link';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onSubmit?: (query: string) => void;
  showMobileVersion?: boolean;
  enableLiveSearch?: boolean; // Enable automatic search as user types
  liveSearchDelay?: number; // Delay for live search (default: 500ms)
  showSuggestions?: boolean; // Show dropdown suggestions (default: true)
}

export function SearchBar({
  placeholder = "search.placeholder",
  className = "",
  onSubmit,
  showMobileVersion = false,
  enableLiveSearch = false,
  liveSearchDelay = 500,
  showSuggestions = true,
}: SearchBarProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debouncedQuery = useDebounce(searchQuery, liveSearchDelay);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger search automatically when debounced query changes (if enabled)
  useEffect(() => {
    if (enableLiveSearch && debouncedQuery.trim() && onSubmit) {
      onSubmit(debouncedQuery.trim());
    }
  }, [debouncedQuery, enableLiveSearch, onSubmit]);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (showSuggestions && debouncedQuery.trim()) {
      setIsLoading(true);
      searchSuggestions(debouncedQuery, 5)
        .then((response) => {
          setSuggestions(response.results);
          setShowDropdown(response.results.length > 0);
          setIsLoading(false);
        })
        .catch(() => {
          setSuggestions([]);
          setShowDropdown(false);
          setIsLoading(false);
        });
    } else {
      setSuggestions([]);
      setShowDropdown(false);
      setIsLoading(false);
    }
  }, [debouncedQuery, showSuggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Validate search query before submission
      const validation = validateSearchQuery(searchQuery);
      if (!validation.isValid) {
        // Could show user-friendly error message here
        console.warn('Invalid search query:', validation.error);
        return;
      }

      setShowDropdown(false);
      if (onSubmit) {
        onSubmit(validation.sanitizedValue!);
      } else {
        // Default behavior - open search page in new tab
        window.open(`/search?q=${encodeURIComponent(validation.sanitizedValue!)}`, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    // Clear search results immediately
    if (enableLiveSearch && onSubmit) {
      onSubmit('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[selectedIndex];
      window.open(selected.url, '_blank', 'noopener,noreferrer');
      setShowDropdown(false);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };


  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={typeof placeholder === 'string' && placeholder.startsWith('search.') ? t(placeholder) : placeholder}
            className={cn(
              "pl-10 pr-10",
              showMobileVersion ? "w-full h-9" : "w-64 h-9"
            )}
          />
          {isLoading ? (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : searchQuery ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          ) : null}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <Link
                key={`${suggestion.type}-${suggestion.id}`}
                href={suggestion.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowDropdown(false)}
                className={cn(
                  "block px-4 py-3 border-b last:border-b-0 transition-colors",
                  "hover:bg-accent",
                  selectedIndex === index && "bg-accent"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-medium text-muted-foreground mt-1">
                    {getSearchTypeLabel(suggestion.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm line-clamp-1">
                      {renderHighlightedText(getHighlightParts(suggestion.title, searchQuery))}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {renderHighlightedText(getHighlightParts(stripHtml(suggestion.snippet), searchQuery))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <Link
            href={`/search?q=${encodeURIComponent(searchQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setShowDropdown(false)}
            className="block px-4 py-2 text-sm text-center text-primary hover:bg-accent border-t font-medium"
          >
            {t('search.seeAllResults')}
          </Link>
        </div>
      )}
    </div>
  );
}

