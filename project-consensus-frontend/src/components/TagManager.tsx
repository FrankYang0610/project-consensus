"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/hooks/useI18n";

interface TagManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
  className?: string;
}

export function TagManager({ 
  tags, 
  onTagsChange, 
  maxTags = 10, 
  className = "" 
}: TagManagerProps) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = React.useState("");

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;
    
    // Check if tag already exists
    if (tags.includes(trimmedValue)) {
      setInputValue("");
      return;
    }
    
    // Check max tags limit
    if (tags.length >= maxTags) {
      return;
    }
    
    onTagsChange([...tags, trimmedValue]);
    setInputValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground">
          {t("post.tags")}
        </label>
        <span className="text-xs text-muted-foreground">
          ({tags.length}/{maxTags})
        </span>
      </div>
      
      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:bg-primary/20 rounded-sm p-0.5 transition-colors"
                aria-label={t("post.removeTag")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Add Tag Input */}
      {tags.length < maxTags && (
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t("post.tagPlaceholder")}
            className="flex-1"
            maxLength={20}
          />
          <Button
            type="button"
            onClick={handleAddTag}
            disabled={!inputValue.trim()}
            size="sm"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {tags.length >= maxTags && (
        <p className="text-xs text-muted-foreground">
          {t("post.maxTagsReached", { max: maxTags })}
        </p>
      )}
    </div>
  );
}
