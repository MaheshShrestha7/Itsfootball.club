'use client';

import React, { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Tournament } from '@/lib/supabase/types';
import TournamentFormModal from '@/components/tournament/TournamentFormModal';
import InternalTeamsManager from '@/components/tournament/InternalTeamsManager';
import { ADMIN_HASH_EVENT } from '@/lib/permissions';
import { Trophy, Plus, Calendar, Layers, ArrowRight, Trash2, Pencil, CheckCircle2, ExternalLink } from 'lucide-react';
import { parseTournamentDate } from '@/lib/tournament-engine';
import { confirmAction } from '@/components/ConfirmDialog';
import { DATE_LOCALE } from '@/lib/dates';

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
    internalTeams,
    tournamentParticipants,
    deleteTournament,
    matches,
    getActiveSeason,
    repairTournaments,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const activeSeason = getActiveSeason(club.id);

  const clubTournaments = tournaments.filter(t => t.club_id === club.id);
  const clubInternalTeams = internalTeams.filter(t => t.club_id === club.id);

  // Upgrade tournaments made by older versions (missing fixtures, old 3rd place slots)
  useEffect(() => repairTournaments(club.id), [repairTournaments, club.id]);

  const [formTarget, setFormTarget] = useState<Tournament | 'new' | null>(null);
  // Tournaments, or the club's own sides picked from members (#tournament-sides, linked from the menu)
  const [tab, setTab] = useState<'list' | 'sides'>('list');
  useEffect(() => {
    const show = (hash: string) => {
      const sides = hash === '#tournament-sides';
      setTab(sides ? 'sides' : 'list');
      if (sides) setFormTarget(null); // the form's "create sides" link closes it
    };
    const read = () => show(window.location.hash);
    const fromMenu = (e: Event) => show((e as CustomEvent<string>).detail);
    read();
    window.addEventListener('hashchange', read);
    window.addEventListener(ADMIN_HASH_EVENT, fromMenu);
    return () => {
      window.removeEventListener('hashchange', read);
      window.removeEventListener(ADMIN_HASH_EVENT, fromMenu);
    };
  }, []);
  // Switching tab updates the hash, so the admin menu highlights the matching item
  const selectTab = (key: 'list' | 'sides') => {
    setTab(key);
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${search}${key === 'sides' ? '#tournament-sides' : ''}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const [feedback, setFeedback] = useState<string | null>(null);
  const handleOpenWizard = () => setFormTarget('new');

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

      <div data-view-ok role="tablist" aria-label="Tournaments" className="admin-tabs">
        {([['list', 'Tournaments'], ['sides', 'Tournament sides']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className="admin-tab"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'sides' ? <InternalTeamsManager clubSlug={club.slug} /> : (
      <>

      <div className="admin-panel admin-dash-figures-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
        <dl className="admin-dash-figures">
          <div><dt>Tournaments</dt><dd>{totalTournaments}</dd><span className="admin-note">{activeTournaments} running now</span></div>
          <div>
            <dt>Tournament sides</dt><dd>{clubInternalTeams.length}</dd>
            {/* Says what's counted: the club's own sides, not the teams entered in a cup */}
            <span className="admin-note">Picked from your members</span>
            <button type="button" onClick={() => selectTab('sides')} className="admin-dash-link" style={{ marginTop: 'auto' }}>Manage sides</button>
          </div>
          <div><dt>Tournament fixtures</dt><dd>{totalMatchesInTourneys}</dd></div>
        </dl>
      </div>

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
                Set up a knockout cup, a league or a group stage, and the fixtures are drawn for you.
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
              {clubTournaments.map(tourn => {
                const participants = tournamentParticipants.filter(p => p.tournament_id === tourn.id);
                const tourneyMatches = matches.filter(m => m.tournament_id === tourn.id);
                const completedMatches = tourneyMatches.filter(m => m.status === 'completed').length;

                const formatLabel =
                  tourn.format === 'knockout'
                    ? 'Knockout cup'
                    : tourn.format === 'league'
                    ? 'League, everyone plays everyone'
                    : 'Groups, then a knockout';

                return (
                  <div
                    key={tourn.id}
                    style={{
                      background: 'var(--color-paper-2)',
                      border: '1px solid var(--color-rule)',
                      borderRadius: 'var(--radius-card)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Banner Image or Graphic Header */}
                    <div
                      data-theme="dark" style={{
                        height: '110px',
                        background: `linear-gradient(color-mix(in oklab, var(--color-sidebar) 40%, transparent), color-mix(in oklab, var(--color-sidebar) 95%, transparent)), ${tourn.banner_url ? `url(${tourn.banner_url})` : 'var(--club-primary)'}`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={tourn.status === 'ongoing' ? 'admin-pill is-ok' : 'admin-pill'} style={{ textTransform: 'capitalize' }}>
                          {tourn.status}
                        </span>

                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => setFormTarget(tourn)}
                          data-theme="dark" style={{
                            background: 'var(--color-scrim)',
                            border: 'none',
                            color: 'var(--color-print)',
                            padding: '0.35rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          title="Edit the tournament"
                          aria-label={`Edit ${tourn.name}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button data-needs-full
                          type="button"
                          onClick={() => handleDeleteTourn(tourn.id, tourn.name)}
                          data-theme="dark" style={{
                            background: 'var(--color-scrim)',
                            border: 'none',
                            color: 'var(--c-red)',
                            padding: '0.35rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          title="Delete the tournament"
                          aria-label={`Delete ${tourn.name}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                        </div>
                      </div>

                      <div className="row">
                        <Trophy size={16} aria-hidden="true" />
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1.05rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            textShadow: '0 2px 4px var(--color-shadow)',
                          }}
                        >
                          {tourn.name}
                        </h3>
                      </div>
                    </div>

                    {/* Details Body */}
                    <div style={{ padding: '1rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        <Layers size={14} aria-hidden="true" />
                        <span>{formatLabel}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <Calendar size={13} aria-hidden="true" />
                        <span>{parseTournamentDate(tourn.start_date)?.toLocaleString(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) || 'Date TBC'}</span>
                      </div>

                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {tourn.description || 'Official club championship tournament.'}
                      </p>

                      <div
                        style={{
                          background: 'color-mix(in oklab, var(--color-sidebar) 30%, transparent)',
                          borderRadius: '8px',
                          padding: '0.65rem 0.85rem',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '0.5rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div>
                          <div className="text-muted">Teams</div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {participants.length}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted">Fixtures</div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {tourneyMatches.length}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted">Played</div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {completedMatches}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: 'color-mix(in oklab, var(--color-sidebar) 30%, transparent)',
                        borderTop: '1px solid color-mix(in oklab, var(--color-ink) 6%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Link
                        href={`/${club.slug}/tournaments/${tourn.id}`}
                        target="_blank"
                        style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        Public page <ExternalLink size={12} aria-hidden="true" />
                      </Link>

                      <Link
                        href={`/${club.slug}/admin/tournaments/${tourn.id}`}
                        className="btn btn-sm btn-primary"
                      >
                        <span>Manage the draw</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
      </>
      )}

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
