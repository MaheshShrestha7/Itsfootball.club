'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Newspaper } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import ArticleBody from '@/components/ArticleBody';
import NewsVideo from '@/components/NewsVideo';
import LocalTime from '@/components/LocalTime';
import { BRAND_IMAGE, fallbackToBrandImage } from '@/lib/image-fallback';
import { decodeSlugParam, newsPath } from '@/lib/slugs';

/** A club news article on its own page (replaces the old pop-up on the club home page), so it can be shared, indexed and cited */
export default function NewsArticlePage({
  params,
}: {
  params: Promise<{ clubSlug: string; newsSlug: string }>;
}) {
  const { clubSlug, newsSlug } = use(params);
  const { selectClubBySlug, news } = useClub();
  const club = selectClubBySlug(clubSlug);
  if (!club) return null;

  const slug = decodeSlugParam(newsSlug);
  const clubNews = news.filter(n => n.club_id === club.id);
  const article = clubNews.find(n => n.slug === slug);
  const backLink = (
    <Link href={`/${club.slug}#news`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
      <ArrowLeft size={14} />
      <span>All {club.name} news</span>
    </Link>
  );

  if (!article) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <Newspaper size={48} style={{ opacity: 0.3, marginBottom: '1.25rem' }} />
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem' }}>Article not found</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          This article may have been moved or removed.
        </p>
        <Link href={`/${club.slug}#news`} className="btn btn-primary">Back to club news</Link>
      </div>
    );
  }

  const more = clubNews.filter(n => n.id !== article.id).slice(0, 3);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem 1.5rem', maxWidth: '760px' }}>
      {backLink}

      <article>
        <img
          decoding="async"
          src={article.cover_image_url || club.banner_url || BRAND_IMAGE}
          onError={fallbackToBrandImage}
          alt={article.title}
          style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-xl)', objectFit: 'cover', marginBottom: '1.5rem' }}
        />
        {!!article.tags?.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {article.tags.map(tag => (
              <span key={tag} className="badge badge-primary">{tag}</span>
            ))}
          </div>
        )}
        <h1 style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.4rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: '0.75rem' }}>
          {article.title}
        </h1>
        <p className="text-meta" style={{ marginBottom: '1.5rem' }}>
          By {article.author_name || `${club.name} Media Team`} · <LocalTime value={article.published_at} />
        </p>
        {article.summary && (
          <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: 'var(--text-primary)', fontWeight: 500, marginBottom: '1.5rem' }}>
            {article.summary}
          </p>
        )}
        <NewsVideo url={article.video_embed_url} title={article.title} />
        <ArticleBody content={article.content} style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.75 }} />
      </article>

      {more.length > 0 && (
        <aside aria-labelledby="more-news" style={{ marginTop: '3.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '2rem' }}>
          <h2 id="more-news" style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>More from {club.short_name || club.name}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {more.map(n => (
              <Link key={n.id} href={newsPath(club.slug, n.slug)} className="glass-panel glass-panel-interactive" style={{ padding: '1rem 1.25rem', display: 'block' }}>
                <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{n.title}</span>
                <span className="text-meta"><LocalTime value={n.published_at} /></span>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
