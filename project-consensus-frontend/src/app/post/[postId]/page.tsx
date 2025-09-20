"use client";

import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SiteNavigation } from "@/components/SiteNavigation";
import { ForumPostDetailCard } from "@/components/ForumPostDetailCard";
import { ForumPostCommentList } from "@/components/ForumPostCommentList";
import { samplePosts, toggleLikeById } from "@/data/samplePosts";
import { toggleCommentLike, deleteComment } from "@/data/sampleComments";

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;

  // Find the post by ID and keep it in local state so UI updates
  const [post, setPost] = React.useState(() => samplePosts.find(p => p.id === postId));

  // Mock current user ID (in real app, this would come from auth context)
  const currentUserId = "user-1";

  // Scroll to top when component mounts
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [postId]);

  const handleBackClick = () => {
    router.back();
  };

  const handleCommentLike = (commentId: string) => {
    const updatedComment = toggleCommentLike(commentId);
    if (updatedComment) {
      // In a real app, you might want to trigger a re-render or update state
      console.log("Comment liked:", commentId);
    }
  };

  const handleCommentDelete = (commentId: string) => {
    const success = deleteComment(commentId);
    if (success) {
      // In a real app, you might want to trigger a re-render or update state
      console.log("Comment deleted:", commentId);
    }
  };

  const handleAddComment = () => {
    // TODO: Implement add comment functionality
    console.log("Add comment clicked");
  };

  const handleReplyToComment = (commentId: string) => {
    // TODO: Implement reply to comment functionality
    console.log("Reply to comment:", commentId);
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
      <div className="min-h-screen bg-background">
        <main className="w-full py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            <ForumPostDetailCard
              post={post}
              onLike={(id) => {
                const updated = toggleLikeById(id);
                if (!updated) return;
                setPost(prev => prev ? { ...prev, isLiked: updated.isLiked, likes: updated.likes } : prev);
              }}
            />
            <ForumPostCommentList
              onLike={handleCommentLike}
              onReply={handleReplyToComment}
              onDelete={handleCommentDelete}
              onAddComment={handleAddComment}
              currentUserId={currentUserId}
              postId={postId}
            />
          </div>
        </main>
      </div>
    </>
  );
}
