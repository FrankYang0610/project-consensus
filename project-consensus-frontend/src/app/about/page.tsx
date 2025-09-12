import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import { SiteNavigation } from '@/components/SiteNavigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'About | Project Consensus',
    description: 'About this project'
};

export default function AboutPage() {
    return (
        <>
            <SiteNavigation />
            <main className={cn('mx-auto max-w-5xl p-8 space-y-8')}>
                <div className="space-y-2">
                    <h1 className="text-4xl font-semibold tracking-tight">About</h1>
                    <p className="text-sm text-muted-foreground">Learn more about the project, its purpose, and the team behind it.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>What is project-consensus?</CardTitle>
                            <CardDescription>Campus forum and course review community</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm leading-relaxed">
                                project-consensus is a campus forum and course review community designed by Frank Yang and Jim Yang. It aims to help students share insights, discuss courses, and build a collaborative community.
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild>
                                <a href="/">Go to Home</a>
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Open-Source Repository</CardTitle>
                            <CardDescription>Explore the source code and contribute</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm">The project is open-source. Check out the repository and feel free to open issues or submit pull requests.</p>
                        </CardContent>
                        <CardFooter className="gap-3">
                            <Button asChild>
                                <a href="https://github.com/FrankYang0610/project-consensus" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
                            </Button>
                            <Button variant="outline" asChild>
                                <a href="https://github.com/FrankYang0610/project-consensus/issues" target="_blank" rel="noopener noreferrer">View Issues</a>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <Alert>
                    <AlertTitle>Note</AlertTitle>
                    <AlertDescription>
                        This site is under active development. UI and features may change frequently.
                    </AlertDescription>
                </Alert>

                <Card>
                    <CardHeader>
                        <CardTitle>Team</CardTitle>
                        <CardDescription>Meet the people behind project-consensus</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-md border p-4">
                                <div className="font-medium">Jim Yang</div>
                                <div className="text-sm text-muted-foreground">Co-creator</div>
                            </div>
                            <div className="rounded-md border p-4">
                                <div className="font-medium">Frank Yang</div>
                                <div className="text-sm text-muted-foreground">Co-creator</div>
                            </div>
                        </div>
                    </CardContent>
                    
                </Card>
            </main>
        </>
    );
}
