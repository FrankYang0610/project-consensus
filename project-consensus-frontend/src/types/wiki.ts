// Wiki types aligned with backend serializers

export type LanguageCode = 'zh-CN' | 'zh-HK' | 'en';

export interface WikiCategoryTranslation {
  id: number;
  language: LanguageCode;
  slug: string;
}

export interface WikiCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  order: number;
  page_count: number;
  language: LanguageCode;
  translation_group: string;
  translations: WikiCategoryTranslation[];
  created_at: string; // ISO timestamp
}

export type WikiStatus = 'draft' | 'published';

export interface WikiPageTranslation {
  id: number;
  title: string;
  slug: string;
  language: LanguageCode;
  status: WikiStatus;
}

export interface WikiPageListItem {
  id: number;
  title: string;
  slug: string;
  summary?: string;
  category: number | null;
  category_name: string | null;
  tags: string;
  tags_list: string[];
  status: WikiStatus;
  author: number;
  author_name: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  order: number;
  language: LanguageCode;
  translation_group: string;
}

export interface WikiPageDetail extends WikiPageListItem {
  content: string;
  translations: WikiPageTranslation[];
}

export interface WikiPageQuery {
  search?: string;
  category?: string; // slug
  status?: WikiStatus; // staff only; frontend generally won't set
  tags?: string; // comma-separated
  language?: LanguageCode;
  translation_group?: string;
}

export interface WikiCategoryQuery {
  search?: string;
  language?: LanguageCode;
}
