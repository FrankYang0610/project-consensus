import React from 'react';
import { fetchWikiPageDetail } from '@/lib/api/wiki';
import type { LanguageCode } from '@/types/wiki';
import WikiPageHeader from '@/components/wiki/WikiPageHeader';
import WikiLanguageSwitcher from '@/components/wiki/WikiLanguageSwitcher';
import MarkdownRenderer from '@/components/wiki/MarkdownRenderer';
import WikiToc from '@/components/wiki/WikiToc';

export const revalidate = 0;

export default async function WikiDetailPage({ params, searchParams }: { params: { slug: string }, searchParams?: Record<string, string | string[] | undefined> }) {
  const slug = params.slug;
  const language = (searchParams?.language as LanguageCode | undefined) ?? undefined;
  const page = await fetchWikiPageDetail(slug, language);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9">
        <div className="flex items-center mb-2">
          {/* Language switcher */}
          <WikiLanguageSwitcher currentSlug={slug} currentLanguage={page.language} translations={page.translations} />
        </div>
        <WikiPageHeader page={page} />
        <MarkdownRenderer
          content={page.content}
          className="prose dark:prose-invert max-w-none prose-base sm:prose-lg md:prose-xl lg:prose-2xl"
        />
      </div>
      <aside className="col-span-12 lg:col-span-3">
        <div className="sticky top-20">
          <WikiToc content={page.content} />
        </div>
      </aside>
    </div>
  );
}
