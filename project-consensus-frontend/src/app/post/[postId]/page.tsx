"use client";

import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { SiteNavigation } from "@/components/SiteNavigation";
import { ForumPostDetailCard } from "@/components/ForumPostDetailCard";
import { ForumPostCommentList } from "@/components/ForumPostCommentList";
import { apiGet, apiPost, apiPostVoid, apiDeleteVoid, isContentEmpty } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { ForumPost } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ForumPostComment } from "@/types/forum";

// Dynamic import for client-only CKEditor component
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;

  const [post, setPost] = React.useState<ForumPost | null>(null);
  const [commentContent, setCommentContent] = React.useState("");
  const [commentIsAnonymous, setCommentIsAnonymous] = React.useState(false);
  const [replyToId, setReplyToId] = React.useState<string | undefined>(undefined);
  const [commentsRefreshKey, setCommentsRefreshKey] = React.useState(0);
  const composerRef = React.useRef<HTMLDivElement | null>(null);
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    apiGet<ForumPost>(`/api/forum/posts/${postId}/`)
      .then((data) => {
        if (mounted) setPost(data);
      })
      .catch((e) => console.error(e));
    return () => {
      mounted = false;
    };
  }, [postId]);

  const { user } = useApp();
  const currentUserId = user?.id;

  // Scroll to top when component mounts
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [postId]);

  const handleBackClick = () => {
    router.back();
  };

  const handleCommentLike = (commentId: string) => {
    // Optimistic toggle like state for comment within the list via custom event update
    const toggleEvent = new CustomEvent('pc:toggle-comment-like', { detail: { id: commentId } });
    window.dispatchEvent(toggleEvent);
  };

  const handleCommentDelete = (commentId: string) => {
    // Dispatch event to let the list perform optimistic delete + API
    const ev = new CustomEvent('pc:delete-comment', { detail: { id: commentId } });
    window.dispatchEvent(ev);
  };

  const handleAddComment = () => {
    setIsComposerOpen(true);
    setReplyToId(undefined);
    requestAnimationFrame(() => {
      const el = document.getElementById('composer-top');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleReplyToComment = (commentId: string) => {
    setIsComposerOpen(true);
    setReplyToId(commentId);
    requestAnimationFrame(() => {
      const el = document.getElementById(`composer-for-comment-${commentId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };


  const handleDeletePost = async (id: string) => {
    try {
      await apiDeleteVoid(`/api/forum/posts/${id}/`);
      router.push("/");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitComment = async () => {
    if (!post) return;
    // For rich text content, we need to check if there's actual content beyond just HTML tags
    if (isContentEmpty(commentContent)) return;
    try {
      const created = await apiPost<ForumPostComment>(`/api/forum/comments/`, {
        content: commentContent.trim(),
        postId: postId,
        replyTo: replyToId,
        isAnonymous: commentIsAnonymous,
      });
      // Optimistically bump post comment count
      setPost(prev => prev ? { ...prev, comments: Math.max(0, (prev.comments ?? 0) + 1) } : prev);
      setCommentContent("");
      setCommentIsAnonymous(false);
      setReplyToId(undefined);
      setIsComposerOpen(false);
      // Notify list that a comment is created (to bump parent replies immediately)
      window.dispatchEvent(new CustomEvent('pc:comment-created', { detail: { comment: created } }));
      // Ask the comment list to load pages up to the new comment and scroll to it
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('pc:jump-to-comment', { detail: { id: created.id } }));
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!post) {
    return (
      <>
        <SiteNavigation showBackButton={true} onBackClick={handleBackClick} />
        <div className="min-h-screen bg-background">
          <main className="w-full py-8">
            <div className="container mx-auto px-4 max-w-4xl">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    Post not found
                  </p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNavigation showBackButton={true} onBackClick={handleBackClick} />
      <div className="min-h-screen bg-background overflow-x-hidden">
        <main className="w-full py-4 sm:py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            <ForumPostDetailCard
              post={post}
              onLike={(id) => {
                if (!post) return;
                const wasLiked = post.isLiked ?? false;
                const willLike = !wasLiked;
                // optimistic
                setPost(prev => prev ? { ...prev, isLiked: willLike, likes: Math.max(0, prev.likes + (willLike ? 1 : -1)) } : prev);

                let reverted = false;
                const timer = setTimeout(() => {
                  if (reverted) return;
                  setPost(prev => prev ? { ...prev, isLiked: wasLiked, likes: Math.max(0, prev.likes + (willLike ? -1 : 1)) } : prev);
                  reverted = true;
                }, 3000);

                const endpoint = willLike ? `/api/forum/posts/${id}/like/` : `/api/forum/posts/${id}/unlike/`;
                apiPostVoid(endpoint)
                  .then(() => {
                    if (reverted) return;
                    clearTimeout(timer);
                  })
                  .catch(() => {
                    if (reverted) return;
                    clearTimeout(timer);
                    setPost(prev => prev ? { ...prev, isLiked: wasLiked, likes: Math.max(0, prev.likes + (willLike ? -1 : 1)) } : prev);
                  });
              }}
              onDelete={handleDeletePost}
            />
            <ForumPostCommentList
              onLike={handleCommentLike}
              onReply={handleReplyToComment}
              onDelete={handleCommentDelete}
              onAddComment={handleAddComment}
              currentUserId={currentUserId}
              postId={postId}
              totalCount={post.comments ?? 0}
              isComposerOpen={isComposerOpen}
              replyToId={replyToId}
              composerValue={commentContent}
              onComposerChange={setCommentContent}
              composerIsAnonymous={commentIsAnonymous}
              onComposerAnonymousChange={(v) => setCommentIsAnonymous(Boolean(v))}
              onSubmitComposer={handleSubmitComment}
              onCancelComposer={() => { setReplyToId(undefined); setIsComposerOpen(false); }}
              key={commentsRefreshKey}
            />
          </div>
        </main>
      </div>
    </>
  );
}
