import React, { useState, FormEvent, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onSubmit?: (query: string) => void;
  showMobileVersion?: boolean;
  enableLiveSearch?: boolean; // Enable automatic search as user types
  liveSearchDelay?: number; // Delay for live search (default: 500ms)
}

export function SearchBar({
  placeholder = "Search...",
  className = "",
  onSubmit,
  showMobileVersion = false,
  enableLiveSearch = false,
  liveSearchDelay = 500,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, liveSearchDelay);

  // Trigger search automatically when debounced query changes (if enabled)
  useEffect(() => {
    if (enableLiveSearch && debouncedQuery.trim() && onSubmit) {
      onSubmit(debouncedQuery.trim());
    }
  }, [debouncedQuery, enableLiveSearch, onSubmit]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSubmit) {
        onSubmit(searchQuery.trim());
      } else {
        // Default behavior - navigate to search page
        window.location.href = `/search?query=${encodeURIComponent(searchQuery)}`;
      }
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    // Clear search results immediately
    if (enableLiveSearch && onSubmit) {
      onSubmit('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-10",
            showMobileVersion ? "w-full h-9" : "w-64 h-9"
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    </form>
  );
}

