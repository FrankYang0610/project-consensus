import React from 'react';
import Link from 'next/link';
import { fetchWikiPages } from '@/lib/api/wiki';
import type { WikiPageQuery } from '@/types/wiki';

type Props = WikiPageQuery;

export default async function WikiPageList(props: Props) {
  const pages = await fetchWikiPages(props);
  const lang = props.language;
  if (!pages.length) {
    return <div className="text-sm text-neutral-500">No pages found.</div>;
  }
  return (
    <ul className="space-y-3">
      {pages.map((p) => (
        <li key={p.id} className="border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <Link href={`/wiki/${encodeURIComponent(p.slug)}${lang ? `?language=${lang}` : ''}`} className="text-base font-medium hover:underline">
                {p.title}
              </Link>
              {p.summary && <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1 line-clamp-2">{p.summary}</p>}
              <div className="text-xs text-neutral-500 mt-1">
                {p.category_name && <span className="mr-2">{p.category_name}</span>}
                <span>{new Date(p.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            <span className="text-xs text-neutral-400">{p.view_count} views</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
