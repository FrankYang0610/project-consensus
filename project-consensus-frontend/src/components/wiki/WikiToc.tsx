import React from 'react';
import { extractHeadings, TocItem } from '@/lib/markdown';

interface WikiTocProps {
  content?: string; // markdown string (optional)
  headings?: TocItem[]; // precomputed headings
  className?: string;
}

export default function WikiToc({ content, headings, className }: WikiTocProps) {
  const items = headings ?? (content ? extractHeadings(content) : []);
  if (!items.length) return null;
  return (
    <nav className={className} aria-label="Table of contents">
      <div className="text-sm font-semibold mb-2">On this page</div>
      <ul className="space-y-1 text-sm">
        {items.map((h) => (
          <li key={h.id} style={{ paddingLeft: (h.depth - 1) * 8 }}>
            <a href={`#${h.id}`} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
