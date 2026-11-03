'use client';

import React, { use } from 'react';
import { BookOpen, MapPin, Award } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { isArticleEmpty } from '@/lib/article-text';
import { DEFAULT_CREST } from '@/lib/crest';
import ArticleBody from '@/components/ArticleBody';
import Link from 'next/link';
import ClubContactSection from '@/components/ClubContactSection';
import ClubSubPage from '@/components/ClubSubPage';

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
    <ClubSubPage
      club={club}
      title="About the club"
      width={900}
      icon={<img src={club.logo_url || DEFAULT_CREST} alt="" width={52} height={52} style={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0 }} />}
      intro={(club.motto || club.founded_year) ? <>
        {club.motto && <em>&ldquo;{club.motto}&rdquo;</em>}
        {club.motto && club.founded_year ? ' · ' : ''}
        {club.founded_year ? `Est. ${club.founded_year}` : ''}
      </> : undefined}
    >
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

          {/* Email, phone and the contact form (always: the form works without either) */}
          <ClubContactSection club={club} />

          {committee.length > 0 && (
            <section aria-labelledby="about-committee">
              <h2 id="about-committee" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={20} color="var(--club-primary)" /> The committee
              </h2>
              <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {committee.length === 1 ? '1 person runs' : `${committee.length} people run`} the club on the executive committee.
                </span>
                <Link href={`/${club.slug}/leadership`} className="btn btn-secondary btn-sm">Meet the committee</Link>
              </div>
            </section>
          )}
        </div>
    </ClubSubPage>
  );
}
