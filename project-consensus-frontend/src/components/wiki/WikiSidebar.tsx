import React from 'react';
import Link from 'next/link';
import { fetchWikiCategories } from '@/lib/api/wiki';
import type { LanguageCode } from '@/types/wiki';
import { ArrowLeft } from 'lucide-react';

interface WikiSidebarProps {
  language?: LanguageCode;
}

// Server component: left sidebar with categories
export default async function WikiSidebar({ language }: WikiSidebarProps) {
  const categories = await fetchWikiCategories({ language });
  return (
    <aside className="sticky top-20 p-4 border-r border-neutral-200 dark:border-neutral-800">
      <div className="mb-3">
        <Link
          href="/"
          aria-label="Back to home"
          className="inline-flex items-center gap-2 text-sm md:text-base px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回主页</span>
        </Link>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Wiki</h2>
        <Link href={`/wiki${language ? `?language=${language}` : ''}`} className="text-xs text-blue-600 hover:underline">All pages</Link>
      </div>
      <ul className="space-y-1">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/wiki?category=${encodeURIComponent(c.slug)}${language ? `&language=${language}` : ''}`}
              className="flex items-center justify-between text-sm text-neutral-700 dark:text-neutral-300 hover:text-blue-600"
            >
              <span>{c.name}</span>
              <span className="text-xs text-neutral-400">{c.page_count}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Link href={`/wiki/categories${language ? `?language=${language}` : ''}`} className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">Browse categories →</Link>
      </div>
    </aside>
  );
}
