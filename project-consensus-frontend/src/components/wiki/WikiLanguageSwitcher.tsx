'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { LanguageCode, WikiPageTranslation } from '@/types/wiki';

interface Props {
  currentSlug: string;
  currentLanguage: LanguageCode;
  translations: WikiPageTranslation[]; // includes other languages
}

export default function WikiLanguageSwitcher({ currentSlug, currentLanguage, translations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options: LanguageCode[] = ['zh-CN', 'zh-HK', 'en'];
  const available = new Set<LanguageCode>([currentLanguage, ...translations.map(t => t.language as LanguageCode)]);

  return (
    <div className="ml-auto">
      <label className="text-sm text-neutral-500 mr-2">Language</label>
      <select
        className="text-sm border rounded px-2 py-1 bg-transparent"
        value={currentLanguage}
        onChange={(e) => {
          const lang = e.target.value as LanguageCode;
          startTransition(() => {
            router.push(`/wiki/${encodeURIComponent(currentSlug)}?language=${lang}`);
          });
        }}
        disabled={pending}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} disabled={!available.has(opt)}>
            {opt}{available.has(opt) ? '' : ' (N/A)'}
          </option>
        ))}
      </select>
    </div>
  );
}
