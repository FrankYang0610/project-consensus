import React from 'react';
import type { WikiPageDetail } from '@/types/wiki';

export default function WikiPageHeader({ page }: { page: WikiPageDetail }) {
  const updated = new Date(page.updated_at);
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold mb-2">{page.title}</h1>
      <div className="text-sm text-neutral-500 space-x-2">
        {page.category_name && <span>Category: {page.category_name}</span>}
        <span>Author: {page.author_name}</span>
        <span>Updated: {updated.toLocaleDateString()}</span>
        <span>Views: {page.view_count}</span>
      </div>
    </header>
  );
}
