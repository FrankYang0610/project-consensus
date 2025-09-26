"use client";

import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SiteNavigation } from "@/components/SiteNavigation";
import { ForumPostDetailCard } from "@/components/ForumPostDetailCard";
import { ForumPostCommentList } from "@/components/ForumPostCommentList";
import { apiGet } from "@/lib/utils";
import { ForumPost } from "@/types";

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;

  const [post, setPost] = React.useState<ForumPost | null>(null);
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
    console.log("Comment liked:", commentId);
  };

  const handleCommentDelete = (commentId: string) => {
    console.log("Comment deleted:", commentId);
  };

  const handleAddComment = () => {
    // TODO: Implement add comment functionality
    console.log("Add comment clicked");
  };

  const handleReplyToComment = (commentId: string) => {
    // TODO: Implement reply to comment functionality
    console.log("Reply to comment:", commentId);
  };

  const handleCommentShare = (commentId: string) => {
    // TODO: Implement comment share functionality
    console.log("Share comment:", commentId);
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
                setPost(prev => prev ? { ...prev, isLiked: !prev.isLiked, likes: Math.max(0, prev.likes + (!prev.isLiked ? 1 : -1)) } : prev);
              }}
            />
            <ForumPostCommentList
              onLike={handleCommentLike}
              onReply={handleReplyToComment}
              onDelete={handleCommentDelete}
              onShare={handleCommentShare}
              onAddComment={handleAddComment}
              currentUserId={currentUserId}
              postId={postId}
              totalCount={post.comments}
            />
          </div>
        </main>
      </div>
    </>
  );
}
