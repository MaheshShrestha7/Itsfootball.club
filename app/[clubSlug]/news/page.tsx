'use client';

import React, { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { newsPath } from '@/lib/slugs';
import { newestFirst } from '@/lib/news';
import LocalTime from '@/components/LocalTime';
import CoverImage from '@/components/CoverImage';

const PAGE = 12;

/** /club/news: every article the club has posted, newest first (the home page shows the latest few) */
export default function ClubNewsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, news, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [tag, setTag] = useState('all');
  const [shown, setShown] = useState(PAGE);

  const clubNews = useMemo(() => newestFirst(news.filter(n => n.club_id === club.id)), [news, club.id]);
  // Tags used on at least two articles: one-off tags would just add noise
  const tags = useMemo(() => {
    const count = new Map<string, number>();
    clubNews.forEach(n => (n.tags || []).forEach(t => count.set(t, (count.get(t) || 0) + 1)));
    return [...count].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [clubNews]);
  const filtered = tag === 'all' ? clubNews : clubNews.filter(n => n.tags?.includes(tag));

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: 900, marginBottom: '0.4rem' }}>News</h1>
        <p className="text-body" style={{ marginBottom: '1.5rem' }}>Match reports, announcements and updates from {club.name}.</p>

        {tags.length > 0 && (
          <div role="group" aria-label="Topic" className="fixtures-team-chips">
            {['all', ...tags].map(t => (
              <button key={t} type="button" aria-pressed={tag === t} onClick={() => { setTag(t); setShown(PAGE); }}
                className={`btn btn-sm ${tag === t ? 'btn-primary' : 'btn-secondary'}`}>
                {t === 'all' ? 'All news' : t}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="glass-panel text-note" style={{ padding: '1.25rem' }}>{isHydrated ? 'No news posted yet. Check back soon.' : 'Loading news…'}</p>
        ) : (
          <div className="stack stack-sm">
            {filtered.slice(0, shown).map(article => (
              <Link key={article.id} href={newsPath(club.slug, article.slug)} className="glass-panel glass-panel-interactive news-list-item">
                <CoverImage
                  width={96} height={96}
                  src={article.cover_image_url || club.banner_url || undefined}
                  alt=""
                  crestUrl={club.logo_url || undefined}
                  style={{ width: '96px', height: '96px', borderRadius: '10px', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  {!!article.tags?.length && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      {article.tags.slice(0, 2).map(t => (
                        <span key={t} className="badge" style={{ fontSize: '0.68rem', background: 'rgba(var(--tint-rgb), 0.07)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, margin: '0 0 0.25rem' }}>{article.title}</h2>
                  {article.summary && <p className="text-note news-list-summary" style={{ margin: '0 0 0.25rem' }}>{article.summary}</p>}
                  <span className="text-meta"><LocalTime value={article.published_at} /></span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {filtered.length > shown && (
          <button type="button" className="btn btn-secondary" style={{ marginTop: '1.25rem' }} onClick={() => setShown(n => n + PAGE)}>
            Show older news
          </button>
        )}
      </div>
    </div>
  );
}
