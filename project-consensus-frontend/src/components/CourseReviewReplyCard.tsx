"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Reply, Trash2, Languages } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { sanitizeHtml } from "@/lib/html-utils";

import ClientOnlyTime from "./ClientOnlyTime";

// Use shared type from central types to keep UI and data layer in sync
import type { CourseReviewReply } from "@/types";

export interface CourseReviewReplyCardProps {
  reply: CourseReviewReply;
  onLike?: (replyId: string) => void;
  onReply?: (replyId: string) => void;
  onDelete?: (replyId: string) => void;
  className?: string;
  replyToReply?: CourseReviewReply;  // The reply being replied to (if this is a nested reply)
}

/**
 * Course review reply card (single layer, no images), aligned with forum comment style
 */
export function CourseReviewReplyCard({
  reply,
  onLike,
  onReply,
  onDelete,
  className,
  replyToReply,
}: CourseReviewReplyCardProps) {
  const { t } = useI18n();
  const { user } = useApp();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isTranslated, setIsTranslated] = React.useState(false);

  // Check if current user is the author of this anonymous reply
  const isOwner = user?.id && String(user.id) === String(reply.author.id);
  const canDelete = isOwner;
  
  // Derive display author name considering anonymity rules
  const displayName = React.useMemo(() => {
    if (reply.isAnonymous) {
      if (isOwner) {
        return `${reply.author.name} (${t("common.anonymous") || "Anonymous"})`;
      } else {
        return t("common.anonymous") || "Anonymous";
      }
    }
    return reply.author.name;
  }, [reply.author.name, reply.isAnonymous, isOwner, t]);

  // Whether to show as anonymous (no link to profile)
  const showAsAnonymous = reply.isAnonymous && !isOwner;

  // Initials-only avatar (no image). Must be declared before any early return to respect hooks rules
  const initials = React.useMemo(() => {
    const name = (displayName || "?").trim();
    if (!name) return "?";
    const parts = name.split(/\s+/).filter(Boolean);
    const text = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
    return text || name[0]?.toUpperCase() || "?";
  }, [displayName]);

  if (reply.isDeleted) {
    return (
      <div className={cn("text-muted-foreground text-sm italic py-2", className)}>
        {t("comment.deleted")}
      </div>
    );
  }

  const handleLike = () => onLike?.(reply.id);
  const handleReply = () => onReply?.(reply.id);
  const handleTranslate = () => setIsTranslated((v) => !v);
  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      // Await the callback in case it returns a Promise
      await onDelete(reply.id);
    } catch (err) {
      // Optional: surface error to UI/logging with context
      console.error('Failed to delete reply', reply.id, err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className={cn("transition-all duration-200 hover:shadow-sm border-0 shadow-none py-2 gap-2", className)}>
      <CardContent className="px-2 py-0">
        <div className="flex items-start gap-2 group">
          {/* Avatar (initials only, no image) */}
          <div className="flex-shrink-0">
            {showAsAnonymous ? (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">{initials}</span>
              </div>
            ) : (
              <Link
                href={`/user/${reply.author.id}`}
                className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ring-0 group-hover:ring-2 group-hover:ring-primary/30">
                  <span className="text-xs font-medium text-primary">{initials}</span>
                </div>
              </Link>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {showAsAnonymous ? (
                <span className="font-medium text-sm text-muted-foreground">
                  {displayName}
                </span>
              ) : (
                <Link
                  href={`/user/${reply.author.id}`}
                  className="font-medium text-sm text-foreground group-hover:text-primary group-hover:underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {displayName}
                </Link>
              )}
              {replyToReply && (
                <span className="text-xs text-muted-foreground">
                  {t("comment.replyTo") + " @" + (replyToReply.isAnonymous ? t("common.anonymous") : replyToReply.author.name)}
                </span>
              )}
              <ClientOnlyTime dateString={reply.createdAt} className="text-xs text-muted-foreground" />
            </div>

            <div
              className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed mb-0.5"
              dangerouslySetInnerHTML={{
                __html: isTranslated
                  ? sanitizeHtml(t("post.translateUnavailable"))
                  : sanitizeHtml(reply.content),
              }}
            />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={cn(
                  "h-7 px-1 text-xs",
                  reply.isLiked && "text-red-500 hover:text-red-600"
                )}
              >
                <Heart className={cn("w-3 h-3 mr-1", reply.isLiked && "fill-current")} />
                {reply.likes > 0 && reply.likes}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleReply}
                className="h-7 px-1 text-xs"
              >
                <Reply className="w-3 h-3 mr-1" />
                {t("comment.reply")}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleTranslate}
              className={cn(
                "h-7 px-1 text-xs",
                isTranslated
                  ? "text-primary hover:text-primary/90"
                  : "text-muted-foreground hover:text-foreground"
              )}
              >
                <Languages className="w-3 h-3 mr-1" />
                {isTranslated ? t("comment.showOriginal") : t("comment.translate")}
              </Button>

              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-7 px-1 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  {isDeleting ? t("comment.deleting") : t("comment.delete")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CourseReviewReplyCard;
