import React from 'react';
import WikiSidebar from '@/components/wiki/WikiSidebar';
import type { LanguageCode } from '@/types/wiki';
import { headers } from 'next/headers';

async function detectPreferredLanguage(): Promise<LanguageCode> {
  const h = await headers();
  const al = h.get('accept-language') || '';
  const candidates: LanguageCode[] = ['zh-CN', 'zh-HK', 'en'];
  const lower = al.toLowerCase();
  for (const c of candidates) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  return 'zh-CN';
}

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const lang = await detectPreferredLanguage();
  return (
    <div className="mx-auto max-w-6xl grid grid-cols-12 gap-0">
      <div className="col-span-12 md:col-span-3 lg:col-span-3">
        {/* Sidebar */}
        <WikiSidebar language={lang} />
      </div>
      <main className="col-span-12 md:col-span-9 lg:col-span-9 p-4">
        {children}
      </main>
    </div>
  );
}
