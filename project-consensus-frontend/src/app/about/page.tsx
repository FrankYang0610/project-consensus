import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import { SiteNavigation } from '@/components/SiteNavigation';

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
                    project-consensus is a campus forum and course review community designed by Frank Yang and Jim Yang.
                </p>
                <p className="text-sm">
                    GitHub Repo:{' '}
                    <a
                        href="https://github.com/FrankYang0610/project-consensus"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                    >
                        Here
                    </a>
                </p>
            </main>
        </>
    );
}
