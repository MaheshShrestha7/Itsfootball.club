'use client';

import React, { use } from 'react';
import LocalTime from '@/components/LocalTime';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Trophy, Calendar, Users, ArrowRight, Layers, Award } from 'lucide-react';
import { parseTournamentDate } from '@/lib/tournament-engine';

export default function PublicTournamentsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, tournaments, tournamentParticipants, matches } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubTournaments = tournaments.filter(t => t.club_id === club.id);

  return (
    <div style={{ minHeight: '100vh', background: '#090D16', color: '#FFFFFF' }}>

      {/* Hero Section */}
      <section
        style={{
          padding: '4rem 1.5rem 3rem 1.5rem',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.15) 0%, rgba(9, 13, 22, 1) 75%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#F59E0B',
              padding: '0.3rem 0.85rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '1rem',
            }}
          >
            <Trophy size={14} />
            <span>Championship & Cup Tiesheets</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 900,
              margin: '0 0 1rem 0',
              lineHeight: 1.15,
              background: 'linear-gradient(180deg, #FFFFFF 0%, #94A3B8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Club Tournaments & Brackets
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0, lineHeight: 1.6 }}>
            Track live tournament progression, explore interactive soccer brackets, review auto-updating league standings, and support your squad.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        {clubTournaments.length === 0 ? (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '4rem 1.5rem',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <Trophy size={48} style={{ opacity: 0.3, margin: '0 auto 1.25rem auto' }} />
            <h2 style={{ color: '#FFFFFF', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              No Active Tournaments
            </h2>
            <p style={{ margin: 0 }}>There are currently no public tournaments scheduled for this club.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
              gap: '1.75rem',
            }}
          >
            {clubTournaments.map(tourn => {
              const participants = tournamentParticipants.filter(p => p.tournament_id === tourn.id);
              const tourneyMatches = matches.filter(m => m.tournament_id === tourn.id);
              const completedCount = tourneyMatches.filter(m => m.status === 'completed').length;

              const formatLabel =
                tourn.format === 'knockout'
                  ? 'Single-Elimination Knockout'
                  : tourn.format === 'league'
                  ? 'Round-Robin League'
                  : 'Group Stage + Knockout';

              return (
                <div
                  key={tourn.id}
                  style={{
                    background: 'linear-gradient(145deg, #111827 0%, #0B1120 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  {/* Banner */}
                  <div
                    style={{
                      height: '140px',
                      background: `linear-gradient(rgba(15, 23, 42, 0.3), rgba(11, 17, 32, 0.98)), url(${tourn.banner_url || 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80'})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background:
                            tourn.status === 'ongoing'
                              ? 'rgba(16, 185, 129, 0.25)'
                              : 'rgba(59, 130, 246, 0.25)',
                          color: tourn.status === 'ongoing' ? '#10B981' : '#60A5FA',
                          border:
                            tourn.status === 'ongoing'
                              ? '1px solid #10B981'
                              : '1px solid rgba(59, 130, 246, 0.4)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {tourn.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Trophy size={18} color="#F59E0B" />
                      <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#FFFFFF' }}>
                        {tourn.name}
                      </h2>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981', fontWeight: 700, fontSize: '0.82rem' }}>
                      <Layers size={15} />
                      <span>{formatLabel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      <Calendar size={14} />
                      <span>{parseTournamentDate(tourn.start_date) ? <LocalTime value={parseTournamentDate(tourn.start_date)!} format="both" options={{ dateStyle: 'medium', timeStyle: 'short' }} /> : 'Date TBC'}</span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {tourn.description || 'Premier championship football tournament.'}
                    </p>

                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        borderRadius: '10px',
                        padding: '0.75rem 1rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        marginTop: 'auto',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Teams</div>
                        <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>
                          {participants.length}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Fixtures</div>
                        <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>
                          {tourneyMatches.length}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Played</div>
                        <div style={{ fontWeight: 800, color: '#10B981', fontSize: '0.95rem' }}>
                          {completedCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <Link
                      href={`/${club.slug}/tournaments/${tourn.id}`}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontWeight: 800,
                        padding: '0.75rem',
                        borderRadius: '10px',
                        textDecoration: 'none',
                      }}
                    >
                      <span>Explore Tournament Bracket</span>
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
