import type { NewsArticle } from './supabase/types';

/** Articles beside the featured one on the club home page; the rest are on /{club}/news */
export const HOME_NEWS_COUNT = 3;

export const newestFirst = <T extends Pick<NewsArticle, 'published_at'>>(articles: T[]): T[] =>
  [...articles].sort((a, b) => (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0));

/** Drafts and posts scheduled for later are only for the club's staff (and the preview link) */
export const isNewsLive = (a: Pick<NewsArticle, 'published_at' | 'is_draft'>, now = Date.now()): boolean =>
  !a.is_draft && (Date.parse(a.published_at) || 0) <= now;

/** Only the articles the public can see, for screens staff also open while signed in */
export const liveNews = <T extends Pick<NewsArticle, 'published_at' | 'is_draft'>>(articles: T[], now = Date.now()): T[] =>
  articles.filter(a => isNewsLive(a, now));

export type NewsState = 'draft' | 'scheduled' | 'published';

export function newsState(a: Pick<NewsArticle, 'published_at' | 'is_draft'>, now = Date.now()): NewsState {
  if (a.is_draft) return 'draft';
  return (Date.parse(a.published_at) || 0) > now ? 'scheduled' : 'published';
}

/** The private link that shows a draft or scheduled post to whoever has it */
export const newsPreviewPath = (clubSlug: string, a: Pick<NewsArticle, 'slug' | 'preview_token'>) =>
  `/${clubSlug}/news/${a.slug}${a.preview_token ? `?preview=${a.preview_token}` : ''}`;

/** The slug of a fixture's report, so each match gets one */
export const matchReportSlug = (m: { id: string; slug?: string | null }) => `report-${m.slug || m.id.slice(0, 8)}`;
