'use client';

import React, { use, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import GettingStartedChecklist from '@/components/admin/GettingStartedChecklist';
import { isPlayerMember } from '@/lib/supabase/types';
import {
  Users,
  Radio,
  Calendar,
  CreditCard,
  TrendingUp,
  Award,
  Settings,
  ArrowRight,
  Shield,
  QrCode,
  Activity,
  Plus,
  Sparkles,
  CalendarDays,
  Trophy
} from 'lucide-react';
import { getLiveMinute } from '@/lib/match-clock';
import LiveMinute from '@/components/LiveMinute';
import { defaultSeasonLabel } from '@/lib/season';
import { DATE_LOCALE } from '@/lib/dates';

/** A dashboard card that links to its admin page, or a plain card when this person can't open that page */
function KpiCard({ href, allowed, style, children }: { href: string; allowed: boolean; style: React.CSSProperties; children: React.ReactNode }) {
  return allowed
    ? <Link href={href} className="glass-panel glass-panel-interactive" style={{ ...style, textDecoration: 'none' }}>{children}</Link>
    : <div className="glass-panel" style={style}>{children}</div>;
}

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, matches, events, sponsors, news, tournaments, activityLogs, getActiveSeason, getClubAnalytics, loadClubAnalytics } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const { can, isClubSuperUser } = useAuth();
  // Shortcuts only for the areas this person's roles cover (a Treasurer has no fixtures or scanner)
  const canEditFixtures = can(club.id, 'matches', 'edit');
  const canScan = can(club.id, 'scanner');
  const canSeasons = can(club.id, 'seasons');
  const canFixtures = can(club.id, 'matches');
  const canAnalytics = can(club.id, 'analytics');
  const canMatchCentre = can(club.id, 'match-center');

  useEffect(() => {
    loadClubAnalytics(club.id);
  }, [club.id, loadClubAnalytics]);

  const clubMembers = members.filter(m => m.club_id === club.id);
  const squadPlayers = clubMembers.filter(m => isPlayerMember(m));
  const clubMatches = matches.filter(m => m.club_id === club.id);
  const liveMatch = clubMatches.find(m => m.status === 'live' || m.status === 'halftime');
  const analytics = getClubAnalytics(club.id);
  const clubEvents = events.filter(e => e.club_id === club.id);
  const recentActivity = activityLogs
    .filter(l => l.club_id === club.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;

  return (
    <div>
      {/* Top Banner / Greeting */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>ADMIN CONSOLE</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {club.name} Dashboard
          </h1>
          <p className="text-body">
            Everything for running your club: matches, members, and your public website.
          </p>
        </div>

        {(canEditFixtures || canScan) && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {canEditFixtures && (
              <Link href={`/${club.slug}/admin/matches`} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={16} />
                <span>Schedule Matches</span>
              </Link>
            )}
            {canScan && (
              <Link href={`/${club.slug}/admin/scanner`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <QrCode size={16} />
                <span>Scan Passes</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {isClubSuperUser(club.id) && <GettingStartedChecklist clubId={club.id} clubSlug={club.slug} />}

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem',
      }}>
        {/* KPI 0: Active Season */}
        <KpiCard href={`/${club.slug}/admin/seasons`} allowed={canSeasons} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--c-green)', textTransform: 'uppercase' }}>
              Active Season
            </span>
            <div style={{ color: 'var(--c-green)' }}><CalendarDays size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
            {activeSeason?.name || defaultSeasonLabel()}
          </div>
          {canSeasons && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>Manage seasons</span>
              <ArrowRight size={12} />
            </div>
          )}
        </KpiCard>

        {/* KPI 1: Squad Members */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Players
            </span>
            <div style={{ color: 'var(--club-ink)' }}><Users size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
            {squadPlayers.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {clubMembers.length} members in total
          </div>
        </div>

        {/* KPI 2: Live Match or Fixtures */}
        <KpiCard
          href={`/${club.slug}/admin/matches`}
          allowed={canFixtures}
          style={{ padding: '1.5rem', border: liveMatch ? '1px solid #EF4444' : '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: liveMatch ? 'var(--c-red)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
              {liveMatch ? 'LIVE MATCH' : 'FIXTURES'}
            </span>
            <div style={{ color: liveMatch ? 'var(--c-red)' : 'var(--text-muted)' }}><Radio size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
            {liveMatch ? `${liveMatch.home_score} - ${liveMatch.away_score}` : `${clubMatches.length} ${clubMatches.length === 1 ? 'Fixture' : 'Fixtures'}`}
          </div>
          <div style={{ fontSize: '0.75rem', color: liveMatch ? 'var(--c-red)' : 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>{liveMatch ? (liveMatch.status === 'halftime' ? 'Half time' : `${getLiveMinute(liveMatch)}' in progress`) : canFixtures ? 'Manage fixtures' : 'This season'}</span>
            {canFixtures && <ArrowRight size={12} />}
          </div>
        </KpiCard>

        {/* KPI 3: Member Passes Issued & Gate Scans */}
        <KpiCard href={`/${club.slug}/admin/scanner`} allowed={canScan} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Member Passes
            </span>
            <div style={{ color: 'var(--c-amber)' }}><CreditCard size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
            {clubMembers.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--c-amber)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>{analytics.gateScansCount.toLocaleString()} {analytics.gateScansCount === 1 ? 'pass scanned' : 'passes scanned'} at the gate</span>
            {canScan && <ArrowRight size={12} />}
          </div>
        </KpiCard>

        {/* KPI 4: Live Public Page Visits */}
        <KpiCard href={`/${club.slug}/admin/analytics`} allowed={canAnalytics} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="pulse-dot" style={{ background: '#10B981' }} />
              <span>Public Page Visits</span>
            </span>
            <div style={{ color: 'var(--c-blue)' }}><TrendingUp size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
            {analytics.totalVisits.toLocaleString()}
          </div>
          {canAnalytics && (
            <div style={{ fontSize: '0.75rem', color: 'var(--c-green)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>See visitor stats</span>
              <ArrowRight size={12} />
            </div>
          )}
        </KpiCard>
      </div>

      {/* Quick Actions Panel */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Quick Links
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '1rem' }}>
          {can(club.id, 'match-center') && (
          <Link
            href={`/${club.slug}/admin/match-center`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--c-red)' }}>
              <Radio size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Match Centre</div>
              <div className="text-meta">Score & live events</div>
            </div>
          </Link>
          )}

          {can(club.id, 'branding') && (
          <Link
            href={`/${club.slug}/admin/branding`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)' }}>
              <Settings size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Club Branding</div>
              <div className="text-meta">Colours, crest & domain</div>
            </div>
          </Link>
          )}

          {can(club.id, 'squad') && (
          <Link
            href={`/${club.slug}/admin/squad`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--c-blue)' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Squad & Players</div>
              <div className="text-meta">Roster & stats</div>
            </div>
          </Link>
          )}

          {can(club.id, 'events') && (
          <Link
            href={`/${club.slug}/admin/events`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Club Events</div>
              <div className="text-meta">Trainings & social</div>
            </div>
          </Link>
          )}

          {can(club.id, 'hero-slider') && (
          <Link
            href={`/${club.slug}/admin/hero-slider`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--c-amber)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Homepage Slider</div>
              <div className="text-meta">Pick the slides</div>
            </div>
          </Link>
          )}

          {can(club.id, 'tournaments') && (
          <Link
            href={`/${club.slug}/admin/tournaments`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--c-amber)' }}>
              <Trophy size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Tournaments & Cups</div>
              <div className="text-meta">Brackets & draws</div>
            </div>
          </Link>
          )}
        </div>
      </div>

      {/* Two Column Section: Live Match Ops + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '2rem' }}>
        {/* Live Match Operation Overview */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Matchday
            </h3>
            {liveMatch ? (
              <span className="badge badge-live">{liveMatch.status === 'halftime' ? 'LIVE • HT' : <>LIVE • <LiveMinute match={liveMatch} />&apos;</>}</span>
            ) : (
              <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)' }}>NO LIVE MATCH</span>
            )}
          </div>

          {liveMatch ? (
            <div>
              <div style={{
                background: 'rgba(var(--shade-rgb), 0.3)',
                padding: '1.25rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}>
                <div className="text-center" style={{ flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{liveMatch.home_team_name}</div>
                  <div className="text-meta">Home</div>
                </div>

                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {liveMatch.home_score} : {liveMatch.away_score}
                </div>

                <div className="text-center" style={{ flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{liveMatch.away_team_name}</div>
                  <div className="text-meta">Away</div>
                </div>
              </div>

              {canMatchCentre && (
                <Link href={`/${club.slug}/admin/match-center`} className="btn btn-primary" style={{ width: '100%' }}>
                  Open Match Centre &rarr;
                </Link>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
              <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>No match is live right now.</p>
              {canMatchCentre && (
                <Link href={`/${club.slug}/admin/match-center`} className="btn btn-secondary btn-sm">
                  Open Match Centre
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Recent Platform Activities */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Recent Activity
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {recentActivity.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.825rem', textAlign: 'center', padding: '1rem' }}>
                No activity yet.
              </div>
            )}
            {recentActivity.map(act => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(var(--tint-rgb), 0.02)',
                  fontSize: '0.825rem',
                }}
              >
                <div className="text-primary">{act.description}</div>
                <div className="text-meta">{new Date(act.created_at).toLocaleString(DATE_LOCALE)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
