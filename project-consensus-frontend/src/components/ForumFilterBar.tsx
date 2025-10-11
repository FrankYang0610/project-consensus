"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { InlineTagManager } from "@/components/InlineTagManager";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";

interface ForumFilterBarProps {
  className?: string;
  onApply?: (filters: {
    ordering?: string;
    search?: string;
    tags?: string[];
  }) => void;
}

// Sorting choices follow common industry defaults for forums/feeds.
// "default" relies on server's default ordering (newest first with engagement tiebreakers)
// without sending an explicit ordering param.
const sortOptions = [
  { value: "default", label: "Default" },
  { value: "newest", label: "Newest" },
  { value: "likes", label: "Most liked" },
  { value: "comments", label: "Most commented" },
];

export function ForumFilterBar({ className, onApply }: ForumFilterBarProps) {
  const { t } = useI18n();
  const [sort, setSort] = React.useState<string>("default");
  const [search, setSearch] = React.useState<string>("");
  const [tags, setTags] = React.useState<string[]>([]);
  const onTagsChange = React.useCallback((next: string[]) => setTags(next), []);

  const clearAll = React.useCallback(() => {
    setSort("default");
    setSearch("");
    setTags([]);
    onApply?.({});
  }, [onApply]);

  const mapSortToOrdering = (s: string): string | undefined => {
    switch (s) {
      case "newest":
        return "-created_at";
      case "likes":
        return "-likes_count";
      case "comments":
        return "-comments_count";
      case "default":
      default:
        return undefined; // rely on server default ordering
    }
  };

  const handleApply = React.useCallback(() => {
    const ordering = mapSortToOrdering(sort);
    const payload: { ordering?: string; search?: string; tags?: string[] } = {};
    if (ordering) payload.ordering = ordering;
    const s = search.trim();
    if (s) payload.search = s;
    if (tags.length > 0) payload.tags = tags;
    onApply?.(payload);
  }, [onApply, search, sort, tags]);

  return (
    <div
      className={cn(
        "w-full flex flex-wrap items-center gap-2",
        // Wrap on small screens; keep single-line behavior from sm+ if needed
        "sm:whitespace-nowrap sm:overflow-x-auto",
        className
      )}
    >
      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <span>{t("courses.topbar.sortBy")}:</span>
            <span className="ml-1">
              {sortOptions.find(o => o.value === sort)?.label ?? t("common.default", { defaultValue: "Default" })}
            </span>
            <ChevronDown className="ml-2 size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
            {sortOptions.map(opt => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("search.placeholder")}
        className="h-8 text-xs flex-1 min-w-[140px] sm:max-w-[320px]"
      />

      {/* Tags dropdown for small screens */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs sm:hidden">
            <span>{t("post.tags", { defaultValue: "Tags" })}</span>
            {tags.length > 0 && <span className="ml-1 opacity-70">({tags.length})</span>}
            <ChevronDown className="ml-2 size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 p-2">
          <div className="flex items-center gap-2">
            <InlineTagManager
              value={tags}
              onChange={onTagsChange}
              placeholder={t("post.tagPlaceholder")}
              className="w-full"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inline Tag Manager */}
      <InlineTagManager
        value={tags}
        onChange={onTagsChange}
        placeholder={t("post.tagPlaceholder")}
        className="hidden sm:flex flex-1 h-auto sm:h-8 min-w-0 sm:min-w-[240px]"
      />

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2 flex-none">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>
          {t("courses.topbar.actions.clear")}
        </Button>
        <Button size="sm" className="h-8 text-xs" onClick={handleApply}>
          {t("courses.topbar.apply")}
        </Button>
      </div>
    </div>
  );
}


