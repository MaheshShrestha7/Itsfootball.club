'use client';

import React, { use, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
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

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, matches, events, sponsors, news, tournaments, activityLogs, getActiveSeason, getClubAnalytics, loadClubAnalytics } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  useEffect(() => {
    loadClubAnalytics(club.id);
  }, [club.id, loadClubAnalytics]);

  const clubMembers = members.filter(m => m.club_id === club.id);
  const squadPlayers = clubMembers.filter(m => m.role === 'player');
  const clubMatches = matches.filter(m => m.club_id === club.id);
  const liveMatch = clubMatches.find(m => m.status === 'live');
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
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF' }}>
            {club.name} Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Real-time club control room, match operations, squad accreditation, and public portal configurations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/${club.slug}/admin/matches`} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={16} />
            <span>Schedule Matches</span>
          </Link>
          <Link href={`/${club.slug}/admin/scanner`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <QrCode size={16} />
            <span>Launch QR Scanner</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem',
      }}>
        {/* KPI 0: Active Season */}
        <Link href={`/${club.slug}/admin/seasons`} className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>
              Active Season
            </span>
            <div style={{ color: '#10B981' }}><CalendarDays size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.85rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
            {activeSeason?.name || defaultSeasonLabel()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>Manage campaign timeline</span>
            <ArrowRight size={12} />
          </div>
        </Link>

        {/* KPI 1: Squad Members */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              First Team Squad
            </span>
            <div style={{ color: 'var(--club-primary)' }}><Users size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
            {squadPlayers.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {clubMembers.length} total club personnel
          </div>
        </div>

        {/* KPI 2: Live Match or Fixtures */}
        <Link
          href={`/${club.slug}/admin/matches`}
          className="glass-panel glass-panel-interactive"
          style={{ padding: '1.5rem', textDecoration: 'none', border: liveMatch ? '1px solid #EF4444' : '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: liveMatch ? '#EF4444' : 'var(--text-muted)', textTransform: 'uppercase' }}>
              {liveMatch ? 'LIVE MATCH STATUS' : 'SCHEDULED FIXTURES'}
            </span>
            <div style={{ color: liveMatch ? '#EF4444' : 'var(--text-muted)' }}><Radio size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
            {liveMatch ? `${liveMatch.home_score} - ${liveMatch.away_score}` : `${clubMatches.length} Fixtures`}
          </div>
          <div style={{ fontSize: '0.75rem', color: liveMatch ? '#EF4444' : 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>{liveMatch ? `${getLiveMinute(liveMatch)}' in progress` : 'Manage fixtures & schedules'}</span>
            <ArrowRight size={12} />
          </div>
        </Link>

        {/* KPI 3: Member Passes Issued & Turnstile Scans */}
        <Link href={`/${club.slug}/admin/scanner`} className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Member Passes & Turnstile
            </span>
            <div style={{ color: '#F59E0B' }}><CreditCard size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
            {clubMembers.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>{analytics.gateScansCount.toLocaleString()} turnstile scans recorded</span>
            <ArrowRight size={12} />
          </div>
        </Link>

        {/* KPI 4: Live Public Page Visits */}
        <Link href={`/${club.slug}/admin/analytics`} className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="pulse-dot" style={{ background: '#10B981' }} />
              <span>Public Page Visits</span>
            </span>
            <div style={{ color: '#3B82F6' }}><TrendingUp size={20} /></div>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
            {analytics.totalVisits.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>Live analytics stream active</span>
            <ArrowRight size={12} />
          </div>
        </Link>
      </div>

      {/* Quick Actions Panel */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem' }}>
          Quick Management Actions
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '1rem' }}>
          <Link
            href={`/${club.slug}/admin/match-center`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
              <Radio size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>Match Controller</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Score & live events</div>
            </div>
          </Link>

          <Link
            href={`/${club.slug}/admin/branding`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
              <Settings size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>Club Branding</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Colors, logo & domain</div>
            </div>
          </Link>

          <Link
            href={`/${club.slug}/admin/squad`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>Squad & Players</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roster & stats</div>
            </div>
          </Link>

          <Link
            href={`/${club.slug}/admin/events`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>Club Events</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trainings & social</div>
            </div>
          </Link>

          <Link
            href={`/${club.slug}/admin/hero-slider`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>Hero Slider Pins</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Curate pinned slides</div>
            </div>
          </Link>

          <Link
            href={`/${club.slug}/admin/tournaments`}
            className="glass-panel glass-panel-interactive"
            style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}
          >
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B' }}>
              <Trophy size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>Tournaments & Cups</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Brackets & Tiesheets</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Two Column Section: Live Match Ops + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '2rem' }}>
        {/* Live Match Operation Overview */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
              Matchday Command
            </h3>
            {liveMatch ? (
              <span className="badge badge-live">LIVE • <LiveMinute match={liveMatch} />&apos;</span>
            ) : (
              <span className="badge" style={{ background: 'rgba(255,255,255,0.06)' }}>STANDBY</span>
            )}
          </div>

          {liveMatch ? (
            <div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '1.25rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{liveMatch.home_team_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Home</div>
                </div>

                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
                  {liveMatch.home_score} : {liveMatch.away_score}
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{liveMatch.away_team_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Away</div>
                </div>
              </div>

              <Link href={`/${club.slug}/admin/match-center`} className="btn btn-primary" style={{ width: '100%' }}>
                Open Live Match Controller &rarr;
              </Link>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
              <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>No fixture currently marked as LIVE.</p>
              <Link href={`/${club.slug}/admin/match-center`} className="btn btn-secondary btn-sm">
                Initialize Match Center
              </Link>
            </div>
          )}
        </div>

        {/* Recent Platform Activities */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem' }}>
            Recent Club Activity Feed
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
                  background: 'rgba(255, 255, 255, 0.02)',
                  fontSize: '0.825rem',
                }}
              >
                <div style={{ color: '#FFFFFF' }}>{act.description}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(act.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
