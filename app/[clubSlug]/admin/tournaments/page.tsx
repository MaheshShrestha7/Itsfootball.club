'use client';

import React, { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClub } from '@/lib/club-context';
import { Tournament } from '@/lib/supabase/types';
import TournamentFormModal from '@/components/tournament/TournamentFormModal';
import { Trophy, Plus, ArrowRight, Trash2, Pencil, CheckCircle2, ExternalLink, Calendar, ChevronRight, MoreHorizontal, Flag, Shuffle, Users, Radio, PenLine, ListOrdered, type LucideIcon } from 'lucide-react';
import { parseTournamentDate, groupGamesLeft, knockoutStarted, knockoutLockReason } from '@/lib/tournament-engine';
import { tournamentOver } from '@/lib/tournament-overview';
import { kickoff } from '@/lib/fixtures';
import { useNowTick } from '@/lib/match-clock';
import { useKnockoutStartReady } from '@/lib/use-event-fixtures-ready';
import type { Match } from '@/lib/supabase/types';
import { confirmAction } from '@/components/ConfirmDialog';
import { DATE_LOCALE } from '@/lib/dates';
import { byDate, type DateOrder } from '@/lib/club-lists';

// Same words as the tournament page itself
const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: '' },
  ongoing: { label: 'In progress', tone: 'is-warn' },
  completed: { label: 'Completed', tone: 'is-done' },
};

export default function AdminTournamentsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    tournaments,
    tournamentParticipants,
    deleteTournament,
    matches,
    getActiveSeason,
    repairTournaments,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const activeSeason = getActiveSeason(club.id);

  // An age group is listed under its tournament (it opens from there), not as a tournament of its own
  const clubTournaments = tournaments.filter(t => t.club_id === club.id && !t.parent_id);
  const familyIds = (t: { id: string }) => [t.id, ...tournaments.filter(x => x.parent_id === t.id).map(x => x.id)];

  const [seasonFilter, setSeasonFilter] = useState('ALL');
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [order, setOrder] = useState<DateOrder>('newest');
  const seasonNames = [...new Set(clubTournaments.map(t => t.season).filter(Boolean))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const shownTournaments = byDate(
    clubTournaments.filter(t => (seasonFilter === 'ALL' || t.season === seasonFilter)
      && (formatFilter === 'ALL' || t.format === formatFilter)
      && (statusFilter === 'ALL' || t.status === statusFilter)),
    t => t.start_date, order);

  // Upgrade tournaments made by older versions (missing fixtures, old 3rd place slots)
  useEffect(() => repairTournaments(club.id), [repairTournaments, club.id]);

  const [formTarget, setFormTarget] = useState<Tournament | 'new' | null>(null);
  // The sides tab moved to its own page (Players and teams > In-house sides): old links go there
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === '#tournament-sides') router.replace(`/${club.slug}/admin/sides`);
  }, [club.slug, router]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const handleOpenWizard = () => setFormTarget('new');

  // The card's "..." menu (edit, delete): one open at a time, closed by a tap elsewhere or Escape
  const [menuFor, setMenuFor] = useState<string | null>(null);
  useEffect(() => {
    if (!menuFor) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest?.('[data-tcard-menu]')) setMenuFor(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuFor]);

  const koStartReady = useKnockoutStartReady();
  const now = useNowTick(60000);
  // The one thing to do next, shown on the card and linking to the right tab of the tournament page
  const nextStep = (tourn: Tournament, ids: string[], games: Match[], teams: number):
    { label: string; sub: string; tab?: string; warn?: boolean; Icon: LucideIcon } | null => {
    if (teams === 0) return { label: 'Add the teams', sub: 'Then make the draw', tab: 'teams', Icon: Users };
    if (games.length === 0) return { label: 'Make the draw', sub: `${teams} ${teams === 1 ? 'team' : 'teams'} in. Add any late teams first`, tab: 'teams', Icon: Shuffle };
    const live = games.find(m => m.status === 'live' || m.status === 'halftime');
    if (live) return { label: `Live now: ${live.home_team_name} v ${live.away_team_name}`, sub: 'Enter goals as they go in', tab: 'fixtures', warn: true, Icon: Radio };
    const own = games.filter(m => m.tournament_id === tourn.id);
    if (koStartReady && tourn.format === 'group_knockout' && groupGamesLeft(tourn.id, own) === 0
      && own.some(m => m.tournament_stage && m.tournament_stage !== 'group') && !knockoutStarted(tourn, own))
      return { label: 'Start the knockout stage', sub: 'All group games are in', warn: true, Icon: Flag };
    // Past kick-off with no result, leaving out knockout games still locked behind earlier ones
    const overdue = games.filter(m => m.status === 'upcoming' && kickoff(m) > 0 && kickoff(m) < now
      && !knockoutLockReason(m, tournaments.find(t => t.id === m.tournament_id), games, koStartReady)).length;
    if (overdue) return { label: `${overdue} ${overdue === 1 ? 'score' : 'scores'} to enter`, sub: 'Games past kick-off with no result', tab: 'fixtures', warn: true, Icon: PenLine };
    if (ids.length === 1 && tournamentOver(tourn, own)) {
      const final = own.find(m => m.tournament_stage === 'final' && m.status === 'completed');
      if (final) {
        const homeWon = final.winner_side ? final.winner_side === 'home'
          : final.home_score !== final.away_score ? final.home_score > final.away_score
          : (final.home_penalty_score ?? 0) > (final.away_penalty_score ?? 0);
        return { label: `Winners: ${homeWon ? final.home_team_name : final.away_team_name}`, sub: 'See the knockout bracket', tab: 'bracket', Icon: Trophy };
      }
      return { label: 'All games played', sub: 'See the final table', tab: tourn.format === 'knockout' ? 'bracket' : 'standings', Icon: ListOrdered };
    }
    const next = games.filter(m => m.status === 'upcoming' && kickoff(m) >= now).sort((a, b) => kickoff(a) - kickoff(b))[0];
    if (next) return {
      label: `Next: ${next.home_team_name} v ${next.away_team_name}`,
      sub: new Date(kickoff(next)).toLocaleString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
      tab: 'fixtures', Icon: Calendar,
    };
    return null;
  };

  const handleDeleteTourn = async (tournId: string, tournName: string) => {
    if (await confirmAction({ title: `Delete "${tournName}"?`, message: 'The tournament and all its fixtures will be removed.', confirmLabel: 'Delete tournament', danger: true })) {
      deleteTournament(tournId);
      setFeedback(`Deleted ${tournName}`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // KPIs
  const totalTournaments = clubTournaments.length;
  const activeTournaments = clubTournaments.filter(t => t.status === 'ongoing').length;
  const totalMatchesInTourneys = matches.filter(m => !!m.tournament_id).length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="admin-head">
        <div>
          <h1>Tournaments</h1>
          <p>Run knockout cups, round-robin leagues and group-stage tournaments, with points tables that update as results come in.{activeSeason && ` Season ${activeSeason.name}.`}</p>
        </div>

        <div className="admin-head-actions">
          <button type="button" onClick={handleOpenWizard} className="btn btn-primary">
            <Trophy size={18} aria-hidden="true" />
            <span>Set up a tournament</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div role="status" className="admin-flash">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="admin-panel admin-dash-figures-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
        <dl className="admin-dash-figures">
          <div><dt>Tournaments</dt><dd>{totalTournaments}</dd><span className="admin-note">{activeTournaments} running now</span></div>
          <div><dt>Tournament fixtures</dt><dd>{totalMatchesInTourneys}</dd></div>
        </dl>
      </div>

      {clubTournaments.length > 0 && (
        <div className="admin-toolbar">
          <div className="admin-chips" role="group" aria-label="Show">
            {([['ALL', 'All'], ['draft', 'Draft'], ['ongoing', 'In progress'], ['completed', 'Completed']] as const).map(([key, label]) => (
              <button data-view-ok type="button" className="admin-chip" key={key} aria-pressed={statusFilter === key} onClick={() => setStatusFilter(key)}>
                {label} <span className="num">{key === 'ALL' ? clubTournaments.length : clubTournaments.filter(t => t.status === key).length}</span>
              </button>
            ))}
          </div>
          <div className="admin-toolbar-end">
            <select data-view-ok aria-label="Format" className="form-input" value={formatFilter} onChange={e => setFormatFilter(e.target.value)}>
              <option value="ALL">All formats</option>
              <option value="knockout">Knockout cup</option>
              <option value="league">League</option>
              <option value="group_knockout">Groups, then a knockout</option>
            </select>
            <select data-view-ok aria-label="Season" className="form-input" value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}>
              <option value="ALL">All seasons</option>
              {seasonNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <select data-view-ok aria-label="Order" className="form-input" value={order} onChange={e => setOrder(e.target.value as DateOrder)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      )}

      {/* Tournaments List */}
      <div>
          {clubTournaments.length === 0 ? (
            <div
              style={{
                background: 'var(--color-paper-2)',
                border: '1px solid var(--color-rule)',
                borderRadius: 'var(--radius-card)',
                padding: '3.5rem 1.5rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: 600 }}>
                No tournaments yet
              </h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.88rem' }}>
                Set up a knockout cup, a league or a group stage, add your teams, then make the draw when they&apos;re all in.
              </p>
              <button
                type="button"
                onClick={handleOpenWizard}
                className="btn btn-primary"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Set up the first tournament</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
                gap: '1.25rem',
              }}
            >
              {shownTournaments.length === 0 && (
                <div className="admin-panel admin-empty" style={{ gridColumn: '1 / -1' }}><p style={{ margin: 0 }}>No tournaments match these filters.</p></div>
              )}
              {shownTournaments.map(tourn => {
                const ids = familyIds(tourn);
                const participants = tournamentParticipants.filter(p => ids.includes(p.tournament_id));
                const tourneyMatches = matches.filter(m => !!m.tournament_id && ids.includes(m.tournament_id));
                const completedMatches = tourneyMatches.filter(m => m.status === 'completed').length;

                const formatLabel =
                  tourn.format === 'knockout'
                    ? 'Knockout cup'
                    : tourn.format === 'league'
                    ? 'League, everyone plays everyone'
                    : 'Groups, then a knockout';

                const step = nextStep(tourn, ids, tourneyMatches, participants.length);
                const status = STATUS[tourn.status] || { label: tourn.status, tone: '' };
                const menuOpen = menuFor === tourn.id;

                return (
                  <article key={tourn.id} className="admin-tcard">
                    <div className={tourn.banner_url ? 'admin-tcard-hero' : 'admin-tcard-hero is-plain'}
                      style={tourn.banner_url ? { backgroundImage: `url(${tourn.banner_url})` } : undefined}>
                      <h3><Trophy size={18} aria-hidden="true" />{tourn.name}</h3>
                    </div>

                    <div className="admin-tcard-body">
                      <div className="admin-tcard-meta">
                        <span className={`admin-pill ${status.tone}`}>{status.label}</span>
                        <span>{ids.length > 1 ? `${formatLabel}, ${ids.length} age groups` : formatLabel}</span>
                      </div>
                      <div className="admin-tcard-date">
                        <Calendar size={13} aria-hidden="true" />
                        <span>{parseTournamentDate(tourn.start_date)?.toLocaleString(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) || 'Date TBC'}</span>
                      </div>

                      {tourn.description && <p className="admin-tcard-desc">{tourn.description}</p>}

                      <div className="admin-tcard-prog">
                        <div>
                          <span>{tourneyMatches.length ? <><b>{completedMatches} of {tourneyMatches.length}</b> games played</> : 'No games yet'}</span>
                          <span>{participants.length} {participants.length === 1 ? 'team' : 'teams'}</span>
                        </div>
                        {tourneyMatches.length > 0 && (
                          <div className={completedMatches === tourneyMatches.length ? 'admin-tcard-bar is-done' : 'admin-tcard-bar'}
                            role="img" aria-label={`${completedMatches} of ${tourneyMatches.length} games played`}>
                            <i style={{ width: `${Math.round((completedMatches / tourneyMatches.length) * 100)}%` }} />
                          </div>
                        )}
                      </div>

                      {step && (
                        <Link href={`/${club.slug}/admin/tournaments/${tourn.id}${step.tab ? `?tab=${step.tab}` : ''}`}
                          className={step.warn ? 'admin-tcard-next is-warn' : 'admin-tcard-next'}>
                          <step.Icon size={16} aria-hidden="true" />
                          <span>{step.label}<small>{step.sub}</small></span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      )}
                    </div>

                    <div className="admin-tcard-foot">
                      <Link href={`/${club.slug}/tournaments/${tourn.id}`} target="_blank" className="admin-tcard-pub">
                        Public page <ExternalLink size={12} aria-hidden="true" />
                      </Link>
                      <div className="admin-tcard-more" data-tcard-menu>
                        <button type="button" className="admin-tcard-more-btn" aria-label={`More for ${tourn.name}`}
                          aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuFor(menuOpen ? null : tourn.id)}>
                          <MoreHorizontal size={16} aria-hidden="true" />
                        </button>
                        {menuOpen && (
                          <div role="menu" className="admin-tcard-menu">
                            <button type="button" role="menuitem" onClick={() => { setMenuFor(null); setFormTarget(tourn); }}>
                              <Pencil size={14} aria-hidden="true" />Edit name, date and photo
                            </button>
                            <button data-needs-full type="button" role="menuitem" className="is-danger"
                              onClick={() => { setMenuFor(null); handleDeleteTourn(tourn.id, tourn.name); }}>
                              <Trash2 size={14} aria-hidden="true" />Delete tournament
                            </button>
                          </div>
                        )}
                      </div>
                      <Link href={`/${club.slug}/admin/tournaments/${tourn.id}`} className="btn btn-sm btn-primary">
                        <span>Manage tournament</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </div>

      {formTarget && (
        <TournamentFormModal
          club={club}
          tournament={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={msg => {
            setFormTarget(null);
            setFeedback(msg);
            setTimeout(() => setFeedback(null), 4000);
          }}
        />
      )}
    </div>
  );
}
