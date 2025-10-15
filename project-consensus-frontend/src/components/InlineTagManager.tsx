"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";

export interface InlineTagManagerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

/**
 * InlineTagManager
 *
 * A compact inline tag editor designed to fit in a single-row toolbar.
 * - Press Enter or comma to commit the current token as a tag
 * - Backspace on empty input removes the last tag
 * - Duplicate tags are ignored; tags are capped by maxTags
 */
export function InlineTagManager({
  value,
  onChange,
  placeholder,
  maxTags = 10,
  className = "",
}: InlineTagManagerProps) {
  const { t } = useI18n();
  const [input, setInput] = React.useState<string>("");

  const addTag = React.useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInput("");
      return;
    }
    if (value.length >= maxTags) return;
    onChange([...value, trimmed]);
    setInput("");
  }, [input, maxTags, onChange, value]);

  const removeTag = React.useCallback((tag: string) => {
    onChange(value.filter(t => t !== tag));
  }, [onChange, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
      return;
    }
    if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className={cn("flex items-center gap-2 border rounded-md px-2 h-8 text-xs min-w-[280px]", className)}> 
      <div className="flex items-center gap-1 overflow-hidden">
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="text-[10px] font-medium">
            <span>{tag}</span>
            <button
              type="button"
              className="ml-1 -mr-1 rounded hover:bg-muted"
              onClick={() => removeTag(tag)}
              aria-label={t("post.removeTag")}
            >
              <X className="inline-block align-[-2px] size-3 opacity-70" />
            </button>
          </Badge>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("post.tagPlaceholderWithHint", {
          base: value.length === 0 ? (placeholder ?? t("post.tagPlaceholder")) : t("post.tagPlaceholder"),
          hint: t("post.tagConfirmHint"),
        })}
        className="flex-1 outline-none bg-transparent placeholder:text-muted-foreground/70"
        maxLength={20}
      />
    </div>
  );
}


