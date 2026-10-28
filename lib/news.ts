import type { NewsArticle } from './supabase/types';

/** Articles beside the featured one on the club home page; the rest are on /{club}/news */
export const HOME_NEWS_COUNT = 3;

export const newestFirst = <T extends Pick<NewsArticle, 'published_at'>>(articles: T[]): T[] =>
  [...articles].sort((a, b) => (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0));
