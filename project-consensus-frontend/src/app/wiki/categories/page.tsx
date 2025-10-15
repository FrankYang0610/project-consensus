import React from 'react';
import WikiCategoryList from '@/components/wiki/WikiCategoryList';
import type { LanguageCode } from '@/types/wiki';

export default async function WikiCategoriesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const language = (searchParams?.language as LanguageCode | undefined) ?? undefined;
  return (
    <div>
      <div className="mb-6 flex items-center">
        <h1 className="text-xl font-bold">Categories</h1>
      </div>
      <WikiCategoryList language={language} />
    </div>
  );
}
