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
import { usePathname, useRouter } from "next/navigation";

interface ForumFilterBarProps {
  className?: string;
  initialSort?: string; // "default" | "newest" | "likes" | "comments"
  initialSearch?: string;
  initialTags?: string[];
}

// Sorting choices follow common industry defaults for forums/feeds.
// "default" relies on server's default ordering (newest first with engagement tiebreakers)
// without sending an explicit ordering param.
const sortOptionKeys = ["default", "newest", "updated", "likes", "comments"] as const;

export function ForumFilterBar({ className, initialSort, initialSearch, initialTags }: ForumFilterBarProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [sort, setSort] = React.useState<string>(initialSort ?? "default");
  const [search, setSearch] = React.useState<string>(initialSearch ?? "");
  const [tags, setTags] = React.useState<string[]>(initialTags ?? []);
  const onTagsChange = React.useCallback((next: string[]) => setTags(next), []);

  // Sync internal state when initial props change
  React.useEffect(() => {
    setSort(initialSort ?? "default");
  }, [initialSort]);
  React.useEffect(() => {
    setSearch(initialSearch ?? "");
  }, [initialSearch]);
  React.useEffect(() => {
    setTags(initialTags ?? []);
  }, [initialTags]);

  const clearAll = React.useCallback(() => {
    setSort("default");
    setSearch("");
    setTags([]);
    router.push(pathname);
  }, [pathname, router]);

  const mapSortToOrdering = (s: string): string | undefined => {
    switch (s) {
      case "newest":
        return "-created_at";
      case "updated":
        return "-updated_at";
      case "likes":
        return "-likes_count";
      case "comments":
        return "-comments_count";
      case "default":
      default:
        return undefined; // rely on server default ordering
    }
  };

  // Helper to build URL with given sort value (used for immediate apply on sort change)
  const applyWithSort = React.useCallback((newSort: string) => {
    const ordering = mapSortToOrdering(newSort);
    const params = new URLSearchParams();
    if (ordering) params.set("ordering", ordering);
    const s = search.trim();
    if (s) params.set("search", s);
    if (tags.length > 0) tags.forEach((t) => params.append("tags", t));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, search, tags]);

  // Handle sort change: update state and immediately apply
  const handleSortChange = React.useCallback((newSort: string) => {
    setSort(newSort);
    applyWithSort(newSort);
  }, [applyWithSort]);

  const handleApply = React.useCallback(() => {
    applyWithSort(sort);
  }, [applyWithSort, sort]);

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
              {t(`forum.sortBy.${sort}`)}
            </span>
            <ChevronDown className="ml-2 size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuRadioGroup value={sort} onValueChange={handleSortChange}>
            {sortOptionKeys.map(key => (
              <DropdownMenuRadioItem key={key} value={key} className="text-xs">
                {t(`forum.sortBy.${key}`)}
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


