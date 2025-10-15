import React from 'react';
import WikiPageList from '@/components/wiki/WikiPageList';
import type { LanguageCode } from '@/types/wiki';

export const revalidate = 0;

export default async function WikiIndexPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const language = (searchParams?.language as LanguageCode | undefined) ?? undefined;
  const search = (searchParams?.search as string | undefined) ?? undefined;
  const category = (searchParams?.category as string | undefined) ?? undefined;
  const tags = (searchParams?.tags as string | undefined) ?? undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Wiki</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Browse knowledge base pages.</p>
      </div>
      <WikiPageList language={language} search={search} category={category} tags={tags} />
    </div>
  );
}
