import { apiGet } from './api-utils';
import type { LanguageCode, WikiCategory, WikiCategoryQuery, WikiPageDetail, WikiPageListItem, WikiPageQuery } from '@/types/wiki';

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const sv = Array.isArray(v) ? v.join(',') : String(v);
    if (sv.length === 0) continue;
    sp.append(k, sv);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchWikiCategories(params: WikiCategoryQuery = {}): Promise<WikiCategory[]> {
  const q = qs(params as Record<string, unknown>);
  return apiGet(`/api/wiki/categories/${q}`, { cache: 'no-store' });
}

export async function fetchWikiPages(params: WikiPageQuery = {}): Promise<WikiPageListItem[]> {
  const q = qs(params as Record<string, unknown>);
  return apiGet(`/api/wiki/pages/${q}`, { cache: 'no-store' });
}

export async function fetchWikiPageDetail(slug: string, language?: LanguageCode): Promise<WikiPageDetail> {
  const q = qs({ language });
  const suffix = q;
  return apiGet(`/api/wiki/pages/${encodeURIComponent(slug)}/${suffix}`, { cache: 'no-store' });
}
