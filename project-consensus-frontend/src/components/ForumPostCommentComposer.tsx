'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Client-only CKEditor wrapper
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

export interface ForumPostCommentComposerProps {
  anchorId: string;
  isReply?: boolean;
  value: string;
  onChange?: (html: string) => void;
  placeholder: string;
  isAnonymous: boolean;
  onAnonymousChange?: (checked: boolean) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  isSubmitDisabled?: boolean;
  closeAriaLabel: string;
  anonymousLabel: string;
  postLabel: string;
}

export function ForumPostCommentComposer({
  anchorId,
  isReply,
  value,
  onChange,
  placeholder,
  isAnonymous,
  onAnonymousChange,
  onSubmit,
  onCancel,
  isSubmitDisabled,
  closeAriaLabel,
  anonymousLabel,
  postLabel,
}: ForumPostCommentComposerProps) {
  return (
    <div id={anchorId} className={cn('mt-3 border rounded-md p-3 relative', isReply && 'ml-11')}>
      {onCancel && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={closeAriaLabel}
          onClick={onCancel}
          className="absolute top-1 right-1 h-8 w-8 z-30 text-muted-foreground hover:text-foreground rounded-md"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <RichTextEditor
        value={value}
        onChange={(v: string) => onChange?.(v)}
        placeholder={placeholder}
        className="w-full min-h-[80px]"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox id={`comment-anonymous-${anchorId}`} checked={!!isAnonymous} onCheckedChange={(v) => onAnonymousChange?.(Boolean(v))} />
          <Label htmlFor={`comment-anonymous-${anchorId}`} className="text-sm cursor-pointer select-none">{anonymousLabel}</Label>
        </div>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!!isSubmitDisabled}
        >
          {postLabel}
        </Button>
      </div>
    </div>
  );
}

export default ForumPostCommentComposer;


