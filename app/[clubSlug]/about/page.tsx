'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, MapPin, Mail, Phone, Award } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { isArticleEmpty } from '@/lib/article-text';
import { DEFAULT_CREST } from '@/lib/crest';
import ArticleBody from '@/components/ArticleBody';
import PlayerAvatar from '@/components/PlayerAvatar';

/** The club's About page: its story (written on the Branding page), home ground, contacts and committee */
export default function AboutPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const story = club.about_story && !isArticleEmpty(club.about_story) ? club.about_story : '';
  const committee = members
    .filter(m => m.club_id === club.id && m.is_executive)
    .sort((a, b) => (a.executive_order || 99) - (b.executive_order || 99));
  const ground = [club.stadium_address, club.stadium_pitch_type].filter(Boolean);

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>

        <header style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
          <img src={club.logo_url || DEFAULT_CREST} alt={`${club.name} crest`} width={84} height={84}
            style={{ width: 84, height: 84, objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>ABOUT THE CLUB</span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
              {club.name}
            </h1>
            {(club.motto || club.founded_year) && (
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {club.motto && <em>&ldquo;{club.motto}&rdquo;</em>}
                {club.motto && club.founded_year ? ' · ' : ''}
                {club.founded_year ? `Est. ${club.founded_year}` : ''}
              </p>
            )}
          </div>
        </header>

        <div className="stack" style={{ gap: '2.5rem' }}>
          <section aria-labelledby="about-story">
            <h2 id="about-story" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={20} color="var(--club-primary)" /> Our story
            </h2>
            {story ? (
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <ArticleBody content={story} style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }} />
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
                {isHydrated
                  ? `${club.name} hasn't shared its story yet.${club.founded_year ? ` The club was founded in ${club.founded_year}.` : ''}`
                  : 'Loading…'}
              </div>
            )}
          </section>

          {(club.stadium_name || ground.length > 0) && (
            <section aria-labelledby="about-ground">
              <h2 id="about-ground" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={20} color="var(--club-primary)" /> Home ground
              </h2>
              <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
                {club.stadium_name && <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{club.stadium_name}</div>}
                {ground.map(line => (
                  <div key={line} style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{line}</div>
                ))}
                {club.stadium_parking_info && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Parking: {club.stadium_parking_info}</div>
                )}
              </div>
            </section>
          )}

          {(club.contact_email || club.contact_phone) && (
            <section aria-labelledby="about-contact">
              <h2 id="about-contact" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Get in touch</h2>
              <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem 2rem' }}>
                {club.contact_email && (
                  <a href={`mailto:${club.contact_email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600, overflowWrap: 'anywhere' }}>
                    <Mail size={18} color="var(--club-primary)" className="shrink-0" /> {club.contact_email}
                  </a>
                )}
                {club.contact_phone && (
                  <a href={`tel:${club.contact_phone.replace(/[^\d+]/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <Phone size={18} color="var(--club-primary)" className="shrink-0" /> {club.contact_phone}
                  </a>
                )}
              </div>
            </section>
          )}

          {committee.length > 0 && (
            <section aria-labelledby="about-committee">
              <h2 id="about-committee" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={20} color="var(--club-primary)" /> The committee
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
                {committee.map(m => (
                  <div key={m.id} className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={72} style={{ marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{m.full_name}</div>
                    {m.executive_title && <div style={{ color: 'var(--club-primary)', fontWeight: 700, fontSize: '0.8rem', marginTop: '0.2rem' }}>{m.executive_title}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
