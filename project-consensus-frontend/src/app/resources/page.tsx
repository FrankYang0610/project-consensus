"use client";

import * as React from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";

// Official PolyU resources (university-operated sites)
const OFFICIAL_POLYU_RESOURCES = [
  {
    id: "polyu-main",
    title: "Official Website",
    href: "https://www.polyu.edu.hk/en/",
    description: "Official homepage of The Hong Kong Polytechnic University.",
  },
  {
    id: "polyu-library",
    title: "PolyU Library",
    href: "http://lib.polyu.edu.hk",
    description: "PolyU Library homepage.",
  },
  {
    id: "polyu-library-booking",
    title: "Library Booking",
    href: "https://booking.lib.polyu.edu.hk",
    description: "PolyU Library booking system.",
  },
];

export default function ResourcesPage() {
  const { t } = useI18n();

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyLink = async (id: string, href: string) => {
    try {
      await navigator.clipboard.writeText(href);
      setCopiedId(id);
      // Reset indicator after a short delay
      setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <>
      <SiteNavigation />
      <main className="mx-auto max-w-5xl p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("menu.resources")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("menu.resourcesDesc")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("resources.officialTitle")}</CardTitle>
            <CardDescription>{t("resources.officialDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              {OFFICIAL_POLYU_RESOURCES.map((item) => (
                <li key={item.id}>
                  <div className="flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium break-words">
                        {item.title}
                      </span>
                      {item.description && (
                        <span className="mt-1 block text-xs text-muted-foreground break-words">
                          {item.description}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(item.id, item.href)}
                        className={cn(
                          copiedId === item.id &&
                          "border-green-500 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
                        )}
                      >
                        {copiedId === item.id ? t("post.copied") : t("resources.copyLink")}
                      </Button>
                      <Button size="sm" asChild>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("resources.open")}
                        </a>
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

