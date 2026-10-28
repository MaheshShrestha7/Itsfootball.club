'use client';

// The public tournament page (/tournaments/{slug}) and its embeddable version (/tournaments/{slug}/embed).
// Same bracket, tables and fixtures as a club's tournament page, for a tournament-only club.

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Trophy, Calendar, Layers, Users, MapPin, Clock, Sparkles, Share2, Code2, UserRound, ArrowRight, Copy, X, Check, Settings, Flag,
} from 'lucide-react';
import LocalTime from '@/components/LocalTime';
import TournamentBracketView from '@/components/tournament/TournamentBracketView';
import TournamentStandingsTable from '@/components/tournament/TournamentStandingsTable';
import TournamentMatchesList from '@/components/tournament/TournamentMatchesList';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import { DEFAULT_CREST } from '@/lib/crest';
import { CONTACT_EMAIL } from '@/lib/faq';
import { SITE_URL } from '@/lib/seo';
import { GROUP_LETTERS, parseTournamentDate } from '@/lib/tournament-engine';
import { MAKER_PATH, isEventClub, tournamentManagePath, tournamentPagePath, tournamentProgress, tournamentSummary } from '@/lib/public-tournaments';
import type { Club, Match, Tournament } from '@/lib/supabase/types';
import ShareLinkButton from '@/components/ShareLinkButton';

export type TournamentTab = 'bracket' | 'standings' | 'fixtures' | 'teams';

const FORMAT_LABELS: Record<string, string> = {
  knockout: 'Knockout',
  league: 'League',
  group_knockout: 'Group Stage + Knockout',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.85rem 1.1rem',
  background: 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--club-primary, #10B981)' : '2px solid transparent',
  color: active ? 'var(--c-green)' : 'var(--text-secondary)',
  fontWeight: 800,
  fontSize: '0.92rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.45rem',
  whiteSpace: 'nowrap',
});

/** The tournament-only club at this slug and its tournament, from the loaded club data */
function usePublicTournament(slug: string) {
  const { clubs, selectClubBySlug, tournaments, tournamentParticipants, matches, getTournamentStandings, isHydrated, syncStatus } = useClub();
  const found = selectClubBySlug(slug);
  const club = found && isEventClub(found) ? found : null;
  const tournament = club ? tournaments.find(t => t.club_id === club.id) || null : null;
  return {
    club,
    tournament,
    participants: tournament ? tournamentParticipants.filter(p => p.tournament_id === tournament.id) : [],
    matches: tournament ? matches.filter(m => m.tournament_id === tournament.id) : [],
    getTournamentStandings,
    // Still waiting for data: the club list hasn't arrived, or this club's tournament hasn't yet
    loading: !isHydrated || syncStatus.phase === 'loading' || clubs.length === 0 || (!!club && !tournament),
  };
}

function defaultTab(tournament: Tournament, matches: Match[]): TournamentTab {
  const hasKnockout = matches.some(m => m.tournament_stage && m.tournament_stage !== 'group');
  return tournament.format === 'league' || (tournament.format === 'group_knockout' && !hasKnockout) ? 'standings' : 'bracket';
}

/** Tabs plus their content; shared by the page and the embed */
function TournamentTabs({
  tournament, matches, participants, getTournamentStandings, tab, setTab, slug,
}: {
  tournament: Tournament;
  matches: Match[];
  participants: ReturnType<typeof usePublicTournament>['participants'];
  getTournamentStandings: ReturnType<typeof usePublicTournament>['getTournamentStandings'];
  tab: TournamentTab;
  setTab?: (tab: TournamentTab) => void;
  slug: string;
}) {
  return (
    <>
      {setTab && (
        <div role="tablist" style={{ display: 'flex', overflowX: 'auto', gap: '0.25rem', borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)', marginBottom: '1.75rem' }}>
          {tournament.format !== 'league' && (
            <button role="tab" aria-selected={tab === 'bracket'} style={tabStyle(tab === 'bracket')} onClick={() => setTab('bracket')}><Trophy size={16} /> Bracket</button>
          )}
          {tournament.format !== 'knockout' && (
            <button role="tab" aria-selected={tab === 'standings'} style={tabStyle(tab === 'standings')} onClick={() => setTab('standings')}><Layers size={16} /> Tables</button>
          )}
          <button role="tab" aria-selected={tab === 'fixtures'} style={tabStyle(tab === 'fixtures')} onClick={() => setTab('fixtures')}><Calendar size={16} /> Fixtures &amp; results ({matches.length})</button>
          <button role="tab" aria-selected={tab === 'teams'} style={tabStyle(tab === 'teams')} onClick={() => setTab('teams')}><Users size={16} /> Teams ({participants.length})</button>
        </div>
      )}

      {tab === 'bracket' && <TournamentBracketView matches={matches} isAdmin={false} />}

      {tab === 'standings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {tournament.format === 'group_knockout' ? (
            GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(letter => (
              <TournamentStandingsTable
                key={letter}
                standings={getTournamentStandings(tournament.id, letter)}
                groupTitle={tournament.group_count === 1 ? 'Group Stage' : `Group ${letter}`}
                advancingCount={tournament.teams_advancing_per_group ?? 2}
              />
            ))
          ) : (
            <TournamentStandingsTable standings={getTournamentStandings(tournament.id)} groupTitle={`${tournament.name} Table`} advancingCount={0} />
          )}
        </div>
      )}

      {tab === 'fixtures' && <TournamentMatchesList matches={matches} clubSlug={slug} isAdmin={false} linkToMatch={false} />}

      {tab === 'teams' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1rem' }}>
          {participants.map(p => (
            <div key={p.id} style={{ background: 'rgba(var(--dk-15-23-42), 0.75)', border: '1px solid rgba(var(--tint-rgb), 0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <img loading="lazy" decoding="async" width={40} height={40} src={p.logo_url || DEFAULT_CREST} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <div className="min-w-0">
                <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                {p.group && <span style={{ fontSize: '0.72rem', color: 'var(--c-amber)', fontWeight: 700 }}>Group {p.group}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LiveDot({ size = 6 }: { size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />;
}

const STAGE_NAMES: Record<string, string> = {
  group: 'Group stage', round_of_32: 'Round of 32', round_of_16: 'Round of 16', quarter_final: 'Quarter-final',
  semi_final: 'Semi-final', final: 'Final', third_place: '3rd place play-off',
};

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function EmbedDialog({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  useEscapeToClose(true, onClose);
  const [view, setView] = useState<'bracket' | 'tables' | 'fixtures'>('bracket');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const pageUrl = `${SITE_URL}${tournamentPagePath(slug)}`;
  // The link under the frame is for readers whose browser blocks frames, and lets search engines find the page
  const code = `<iframe src="${pageUrl}/embed?view=${view}" title="${escapeHtml(name)} live bracket" width="100%" height="600" style="border:0;border-radius:12px" loading="lazy"></iframe>\n<p><a href="${pageUrl}">${escapeHtml(name)} fixtures, table and bracket</a> on itsfootball.club</p>`;
  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : pageUrl);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard blocked: the text is on screen to copy by hand
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="embed-title" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ width: 'min(540px, 100%)', padding: '1.5rem', background: 'rgb(var(--dk-15-23-42))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 id="embed-title" style={{ fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>Put the live bracket on your site</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>
          Paste this into your club website or news article. It updates by itself as scores come in.
        </p>
        <div className="lineup-tool-segment" role="radiogroup" aria-label="What to show" style={{ marginBottom: '0.9rem' }}>
          {(['bracket', 'tables', 'fixtures'] as const).map(v => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? 'is-active' : ''} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'rgba(var(--tint-rgb), 0.05)', border: '1px solid rgba(var(--tint-rgb), 0.1)', borderRadius: '10px', padding: '0.85rem', margin: 0, color: 'var(--text-primary)' }}>
          {code}
        </pre>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => copy('code')}>{copied === 'code' ? <Check size={14} /> : <Copy size={14} />} {copied === 'code' ? 'Copied' : 'Copy code'}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy('link')}>{copied === 'link' ? <Check size={14} /> : <Copy size={14} />} {copied === 'link' ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>
    </div>
  );
}

function ShareButton({ title, slug }: { title: string; slug: string }) {
  return <ShareLinkButton className="btn btn-primary btn-sm" url={`${SITE_URL}${tournamentPagePath(slug)}`} title={title} text={`${title}: live fixtures, tables and bracket`} />;
}

/** Machine-readable date for crawlers, shown in the visitor's own time zone */
function When({ value, withTime }: { value: Date; withTime?: boolean }) {
  return (
    <time dateTime={value.toISOString()}>
      <LocalTime value={value} format={withTime ? 'both' : 'date'} options={withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }} />
    </time>
  );
}

/**
 * Plain-text facts about the tournament, whichever tab is open: the teams, dates, progress and winner
 * are in the page's HTML for search engines and AI answers, not only behind the tabs.
 */
function TournamentFacts({ tournament, teams, formatLabel, organiser, progress }: {
  tournament: Tournament;
  teams: string[];
  formatLabel: string;
  organiser?: string;
  progress: ReturnType<typeof tournamentProgress>;
}) {
  const start = parseTournamentDate(tournament.start_date);
  const end = parseTournamentDate(tournament.end_date);
  const multiDay = start && end && end.toDateString() !== start.toDateString();
  const next = progress.next;
  const nextDate = next?.match_date ? new Date(next.match_date) : null;
  const rows: [string, React.ReactNode][] = [
    ['Format', formatLabel],
    [`Teams (${teams.length})`, teams.join(', ') || 'To be announced'],
    [multiDay ? 'Dates' : 'Date', start ? <>{<When value={start} />}{multiDay && <> to <When value={end!} /></>}</> : 'To be confirmed'],
    ...(tournament.venue ? [['Venue', tournament.venue] as [string, React.ReactNode]] : []),
    ...(organiser ? [['Organiser', organiser] as [string, React.ReactNode]] : []),
    ...(progress.total ? [['Matches played', `${progress.played} of ${progress.total}`] as [string, React.ReactNode]] : []),
    ...(progress.champion ? [
      ['Winner', progress.champion] as [string, React.ReactNode],
      ['Final', `${progress.champion} ${progress.finalScore} ${progress.runnerUp}${progress.finalPenalties ? ` (${progress.finalPenalties} on penalties)` : ''}`] as [string, React.ReactNode],
    ] : []),
    ...(next && !progress.champion ? [['Next match', <>{next.home_team_name} vs {next.away_team_name}{nextDate && !isNaN(nextDate.getTime()) && <>, <When value={nextDate} withTime /></>}</>] as [string, React.ReactNode]] : []),
  ];
  return (
    <section className="glass-panel" style={{ marginTop: '2.5rem', padding: '1.25rem 1.5rem' }} aria-labelledby="facts-title">
      <h2 id="facts-title" className="lineup-tool-section" style={{ marginTop: 0 }}>{tournament.name} at a glance</h2>
      <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, max-content) 1fr', gap: '0.5rem 1.25rem', margin: 0, fontSize: '0.9rem', lineHeight: 1.55 }}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{label}</dt>
            <dd style={{ margin: 0, color: 'var(--text-secondary)', minWidth: 0, overflowWrap: 'anywhere' }}>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}

function NotFound() {
  return (
    <div style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900 }}>Tournament not found</h1>
      <p className="text-secondary" style={{ margin: '0.5rem 0 1.25rem' }}>This tournament doesn&apos;t exist, or its link has changed.</p>
      <Link href={MAKER_PATH} className="btn btn-primary">Make your own tournament</Link>
    </div>
  );
}

function Loading({ name }: { name?: string }) {
  return (
    <div style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
      {name ? <h1 style={{ fontSize: '1.8rem', fontWeight: 900 }}>{name}</h1> : null}
      <p className="text-secondary">Loading fixtures and results...</p>
    </div>
  );
}

export default function PublicTournamentView({ slug, fallbackName }: { slug: string; fallbackName?: string }) {
  const { club, tournament, participants, matches, getTournamentStandings, loading } = usePublicTournament(slug);
  const { hasClubAdminAccess } = useAuth();
  const [tab, setTab] = useState<TournamentTab | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);

  // Until the visitor picks a tab: the bracket, or the tables while there's no knockout to show yet
  const activeTab = tab ?? (tournament ? defaultTab(tournament, matches) : 'bracket');

  if (!club || !tournament) return loading ? <Loading name={fallbackName} /> : <NotFound />;

  const config = (club.config || {}) as NonNullable<Club['config']>;
  const live = matches.filter(m => m.status === 'live' || m.status === 'halftime');
  const start = parseTournamentDate(tournament.start_date);
  const canManage = hasClubAdminAccess(club.id);
  const formatLabel = [FORMAT_LABELS[tournament.format] || 'Tournament', config.team_size].filter(Boolean).join(' · ');
  const sponsors = (config.sponsors || []).filter(s => s?.name);
  const progress = tournamentProgress(matches);
  const teamNames = participants.map(p => p.name);
  const summary = tournamentSummary({
    name: tournament.name, format: tournament.format, teamSize: config.team_size, teamCount: participants.length,
    venue: tournament.venue, organiser: config.organiser, progress,
  });

  return (
    <>
      <section style={{
        background: tournament.banner_url
          ? `linear-gradient(180deg, rgba(var(--dk-9-13-22), 0.75) 0%, rgba(var(--dk-9-13-22), 0.96) 100%), url(${tournament.banner_url}) center/cover no-repeat`
          : 'linear-gradient(180deg, rgba(var(--club-primary-rgb, 16, 185, 129), 0.12) 0%, rgba(var(--dk-9-13-22), 0.95) 100%)',
        borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)',
        padding: '2.5rem 1.5rem 1.5rem',
      }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: 0 }}>
            <div style={{
              width: 64, height: 64, flexShrink: 0, borderRadius: 16, background: 'rgba(245, 158, 11, 0.15)', border: '2px solid rgba(245, 158, 11, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-amber)', boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)',
            }}>
              <Trophy size={32} />
            </div>
            <div className="min-w-0">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 900, margin: 0 }}>{tournament.name}</h1>
                {live.length > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.2)', color: 'var(--c-red)', border: '1px solid #EF4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <LiveDot /> {live.length} LIVE
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', columnGap: '1.25rem', rowGap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--c-green)', fontWeight: 700 }}><Layers size={14} /><span>{formatLabel}</span></span>
                <span className="row row-tight"><Clock size={14} /><span>{start ? <LocalTime value={start} format="both" options={{ dateStyle: 'medium', timeStyle: 'short' }} /> : 'Date to be confirmed'}</span></span>
                {tournament.venue && <span className="row row-tight"><MapPin size={14} /><span>{tournament.venue}</span></span>}
                {config.organiser && <span className="row row-tight"><UserRound size={14} /><span>Organised by {config.organiser}</span></span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <ShareButton title={tournament.name} slug={club.slug} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEmbedOpen(true)}><Code2 size={14} /> Embed</button>
            {canManage ? (
              <Link href={tournamentManagePath(club.slug)} className="btn btn-secondary btn-sm"><Settings size={14} /> Manage</Link>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.4rem 0.85rem', borderRadius: 20, color: 'var(--c-green)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.04em' }}>
                <Sparkles size={13} /><span>LIVE BRACKET</span>
              </span>
            )}
          </div>
        </div>
      </section>

      <main style={{ maxWidth: '1300px', width: '100%', margin: '0 auto', padding: '1.5rem 1.5rem 3rem', flex: 1 }}>
        {/* Answer first: the sentence search and AI engines lift as the summary */}
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '820px', marginBottom: '1.5rem' }}>
          {summary}{tournament.description ? <> {tournament.description}</> : null}
        </p>

        {live.map(m => (
          <div key={m.id} className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem 1rem', flexWrap: 'wrap', padding: '0.9rem 1.25rem', marginBottom: '1rem', borderColor: 'rgba(239, 68, 68, 0.45)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--c-red)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <LiveDot size={8} /> Live now · {m.tournament_group || STAGE_NAMES[m.tournament_stage || 'group']}{m.status === 'halftime' ? ' · Half-time' : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 800, fontSize: '1rem', minWidth: 0 }}>
              <span>{m.home_team_name}</span>
              <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font-mono)', padding: '0.15rem 0.6rem', borderRadius: 8, background: 'rgba(var(--tint-rgb), 0.08)' }}>
                {m.home_score} - {m.away_score}
              </span>
              <span>{m.away_team_name}</span>
            </span>
          </div>
        ))}

        <div style={{ marginTop: live.length ? '1.5rem' : 0 }}>
          <TournamentTabs tournament={tournament} matches={matches} participants={participants} getTournamentStandings={getTournamentStandings} tab={activeTab} setTab={setTab} slug={club.slug} />
        </div>

        <TournamentFacts tournament={tournament} teams={teamNames} formatLabel={formatLabel} organiser={config.organiser} progress={progress} />

        {sponsors.length > 0 && (
          <section style={{ marginTop: '2.5rem' }} aria-labelledby="sponsors-title">
            <h2 id="sponsors-title" className="lineup-tool-section">Thanks to our sponsors</h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {sponsors.map(s => s.url ? (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer sponsored" className="glass-panel" style={{ padding: '0.75rem 1.1rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', textDecoration: 'none' }}>{s.name}</a>
              ) : (
                <span key={s.name} className="glass-panel" style={{ padding: '0.75rem 1.1rem', fontWeight: 700, fontSize: '0.9rem' }}>{s.name}</span>
              ))}
            </div>
          </section>
        )}

        <section className="glass-panel" style={{ marginTop: '2rem', padding: '1.4rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: '1.1rem' }}>Running a club?</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.3rem 0 0.8rem', lineHeight: 1.6 }}>Get a free club site with live scores, availability, payments and your own tournaments.</p>
            <Link href="/create-club" className="btn btn-primary btn-sm">Launch your free club site <ArrowRight size={14} /></Link>
          </div>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: '1.1rem' }}>Organising a cup?</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.3rem 0 0.8rem', lineHeight: 1.6 }}>Make a live bracket like this one for free. Paste your teams and share the link.</p>
            <Link href={MAKER_PATH} className="btn btn-secondary btn-sm">Make a tournament <ArrowRight size={14} /></Link>
          </div>
        </section>

        <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem' }}>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Report: ${SITE_URL}${tournamentPagePath(club.slug)}`)}`} style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Flag size={12} /> Report this page
          </a>
        </p>
      </main>

      {embedOpen && <EmbedDialog slug={club.slug} name={tournament.name} onClose={() => setEmbedOpen(false)} />}
    </>
  );
}

/** The embeddable view: one tab's content and a link back to the full page */
export function TournamentEmbedView({ slug, view }: { slug: string; view: string }) {
  const { club, tournament, participants, matches, getTournamentStandings, loading } = usePublicTournament(slug);

  if (!club || !tournament) return loading ? <Loading /> : <NotFound />;
  const tab: TournamentTab = view === 'tables' ? 'standings' : view === 'fixtures' ? 'fixtures' : view === 'teams' ? 'teams' : defaultTab(tournament, matches);

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={18} color="var(--c-amber)" /> {tournament.name}
        </div>
        <a href={`${SITE_URL}${tournamentPagePath(club.slug)}`} target="_blank" rel="noopener" style={{ color: 'var(--c-green)', fontWeight: 700, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          Live on itsfootball.club <ArrowRight size={12} />
        </a>
      </div>
      <TournamentTabs tournament={tournament} matches={matches} participants={participants} getTournamentStandings={getTournamentStandings} tab={tab} slug={club.slug} />
    </div>
  );
}
