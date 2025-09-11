import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import { SiteNavigation } from '@/components/site_navigation';

export const metadata: Metadata = {
    title: 'About | Project Consensus',
    description: 'About this project'
};

export default function AboutPage() {
    return (
        <>
            <SiteNavigation />
            <main className={cn('mx-auto max-w-2xl p-8 space-y-6')}>
                <h1 className="text-3xl font-semibold tracking-tight">About</h1>
                <p className="text-sm text-muted-foreground">
                    This page was added via the Next.js App Router. Edit `src/app/about/page.tsx` to update content.
                </p>
            </main>
        </>
    );
}
