"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForumPostPreviewCard } from "@/components/ForumPostPreviewCard";
import { samplePosts, toggleLikeById } from "@/data/samplePosts";
import { useI18n } from "@/hooks/useI18n";
import CreateForumPostButton from "@/components/CreateForumPostButton";

export default function HomePage() {
    const { t } = useI18n();
    const [posts, setPosts] = React.useState(() => [...samplePosts]);

    const handleLike = (id: string) => {
        const updated = toggleLikeById(id);
        if (!updated) return;
        setPosts(prev => prev.map(p => (p.id === id ? { ...p, isLiked: updated.isLiked, likes: updated.likes } : p)));
    };

    return (
        <>
            <SiteNavigation />
            <div className="min-h-screen bg-background">
                <main className="w-full py-8">
                    <div className="w-full p-6">
                        <div className="max-w-7xl mx-auto mb-1">
                            <Alert>
                                <AlertTitle>{t('common.note')}</AlertTitle>
                                <AlertDescription>
                                    {t('common.developmentNotice')}
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                    
                    <div className="w-full p-6 pt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
                            {posts.map(post => (
                                <ForumPostPreviewCard key={post.id} post={post} onLike={handleLike} />
                            ))}
                        </div>
                    </div>
                </main>
            </div>
            <CreateForumPostButton />
        </>
    );
}
