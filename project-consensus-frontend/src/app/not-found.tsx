import Link from "next/link";
import {SiteNavigation} from "@/components/SiteNavigation";

export default function NotFound() {
  return (
    <>
        <SiteNavigation />

        <main className="min-h-[80vh] px-6 py-20 flex items-center justify-center">
        <div className="relative mx-auto w-full max-w-3xl text-center">
            <div className="absolute inset-0 -z-10 blur-3xl opacity-40">
            <div className="mx-auto h-48 w-48 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400/70 animate-pulse" />
            </div>

            <p className="mb-3 text-lg sm:text-xl font-medium tracking-wide text-muted-foreground">Error 404</p>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">Page not found</h1>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                Sorry, the page you&#39;re looking for doesn&#39;t exist or may have been moved.
                Please check the URL or return to the homepage to continue browsing.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 text-left">
            <div className="rounded-lg border border-border p-4 bg-card/50">
                <p className="text-sm font-medium">Quick actions</p>
                <p className="mt-1 text-sm text-muted-foreground">Use the navigation to find features or pages</p>
            </div>
            <Link href="/" className="rounded-lg border border-border p-4 bg-card/50 block">
                <p className="text-sm font-medium">Go to homepage</p>
                <p className="mt-1 text-sm text-muted-foreground">Start a new journey from the home page</p>
            </Link>
            </div>
        </div>
        </main>
    </>
  );
}


