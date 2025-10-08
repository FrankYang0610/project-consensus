import React from 'react';
import Link from 'next/link';
import { fetchWikiCategories } from '@/lib/api/wiki';
import type { LanguageCode } from '@/types/wiki';

export default async function WikiCategoryList({ language }: { language?: LanguageCode }) {
  const categories = await fetchWikiCategories({ language });
  if (!categories.length) return <div className="text-sm text-neutral-500">No categories.</div>;
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {categories.map((c) => (
        <li key={c.id} className="border rounded p-3 hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{c.name}</div>
              {c.description && <div className="text-sm text-neutral-500 mt-1 line-clamp-2">{c.description}</div>}
            </div>
            <div className="text-xs text-neutral-400">{c.page_count}</div>
          </div>
          <div className="mt-2">
            <Link href={`/wiki?category=${encodeURIComponent(c.slug)}${language ? `&language=${language}` : ''}`} className="text-sm text-blue-600 hover:underline">
              View pages →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
