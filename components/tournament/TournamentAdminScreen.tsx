'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Match } from '@/lib/supabase/types';
import TournamentBracketView from '@/components/tournament/TournamentBracketView';
import TournamentStandingsTable from '@/components/tournament/TournamentStandingsTable';
import TournamentMatchesList from '@/components/tournament/TournamentMatchesList';
import TournamentScoreModal from '@/components/tournament/TournamentScoreModal';
import TournamentFormModal from '@/components/tournament/TournamentFormModal';
import PlayerOfTournament from '@/components/tournament/PlayerOfTournament';
import { Trophy, ArrowLeft, Calendar, Layers, Shuffle, RefreshCw, Plus, Users, ExternalLink, Clock, Sparkles, Pencil, AlertCircle, CheckCircle2, NotebookPen } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import { GROUP_LETTERS, parseTournamentDate } from '@/lib/tournament-engine';
import { confirmAction } from '@/components/ConfirmDialog';
import { DATE_LOCALE } from '@/lib/dates';
import { isEventClub, tournamentPagePath } from '@/lib/public-tournaments';
import { useMatchReviewsReady } from '@/lib/use-match-reviews';

// Inline and on the app's own tokens, not the admin's classes: this screen also shows on
// /tournaments/{slug}/manage, outside the admin shell (inside it, the shell re-points these tokens)
const panel: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px' };
const actionBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem' };
const pill = (tone: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '0 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, lineHeight: '20px',
  whiteSpace: 'nowrap', background: `color-mix(in oklab, ${tone} 15%, transparent)`, color: tone,
});

/** A tournament's admin screen: on a club's admin pages, and on /tournaments/{slug}/manage for public tournaments */
export default function TournamentAdminScreen({ clubSlug, tournamentId }: { clubSlug: string; tournamentId: string }) {
  const {
    clubs,
    selectClubBySlug,
    tournaments,
    tournamentParticipants,
    matches,
    updateMatch,
    generateTournamentTiesheet,
    updateTournamentMatchScore,
    progressKnockoutStage,
    getTournamentStandings,
    addTournamentParticipant,
    repairTournaments,
    members,
    updateTournament,
  } = useClub();
  const reviewsReady = useMatchReviewsReady();

  const club = selectClubBySlug(clubSlug) || clubs[0];
  const tournament = tournaments.find(t => t.id === tournamentId);

  // A league has no bracket tab, so it opens on its standings
  const [activeTab, setActiveTab] = useState<'bracket' | 'standings' | 'fixtures' | 'teams'>(() => (tournament?.format === 'league' ? 'standings' : 'bracket'));
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');
  const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => repairTournaments(club.id), [repairTournaments, club.id]);

  if (!tournament) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-primary)' }}>
        <h2>Tournament not found</h2>
        <p className="text-secondary">The requested tournament does not exist or has been deleted.</p>
        <Link href={`/${club.slug}/admin/tournaments`} className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Back to tournaments
        </Link>
      </div>
    );
  }

  // A public tournament (/tournaments/{slug}/manage) has no club site: its links go to the tournament page
  const isEvent = isEventClub(club);
  const publicHref = isEvent ? tournamentPagePath(club.slug) : `/${club.slug}/tournaments/${tournament.id}`;

  const participants = tournamentParticipants.filter(p => p.tournament_id === tournament.id);
  const tourneyMatches = matches.filter(m => m.tournament_id === tournament.id);

  const handleGenerateTiesheet = async (shuffle = false) => {
    if (participants.length < 2) {
      setFeedbackTone('error');
      setFeedback('Add at least 2 teams before generating a tiesheet.');
      setTimeout(() => setFeedback(null), 3500);
      return;
    }
    if (tourneyMatches.length > 0) {
      if (!(await confirmAction({ title: 'Regenerate the tiesheet?', message: 'Current tournament fixtures and scores will be reset.', confirmLabel: 'Regenerate', danger: true }))) {
        return;
      }
    }
    const generated = generateTournamentTiesheet(tournament.id, { shuffle });
    setFeedbackTone('success');
    setFeedback(`Tiesheet generated: ${generated.length} tournament fixtures.`);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleProgressStage = () => {
    progressKnockoutStage(tournament.id);
    setFeedbackTone('success');
    setFeedback('Winners of finished matches moved on in the knockout bracket.');
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleAddGuestTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    if (participants.some(p => p.name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      setFeedbackTone('error');
      setFeedback(`"${newTeamName.trim()}" is already in this tournament. Team names must be unique.`);
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    addTournamentParticipant({
      tournament_id: tournament.id,
      team_type: 'external',
      name: newTeamName.trim(),
      short_name: newTeamCode.trim() || newTeamName.slice(0, 3).toUpperCase(),
      logo_url: DEFAULT_CREST,
      color: 'var(--c-blue)',
      seed: participants.length + 1,
    });

    setNewTeamName('');
    setNewTeamCode('');
    setAddTeamModalOpen(false);
    setFeedbackTone('success');
    setFeedback(`Added "${newTeamName.trim()}". Generate the tiesheet again to include them.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const formatLabel =
    tournament.format === 'knockout'
      ? 'Single-elimination knockout'
      : tournament.format === 'league'
      ? 'Round-robin league'
      : 'Group stage and knockout';

  const STATUS: Record<string, { label: string; tone: string }> = {
    draft: { label: 'Draft', tone: 'var(--text-secondary)' },
    ongoing: { label: 'In progress', tone: 'var(--c-amber)' },
    completed: { label: 'Completed', tone: 'var(--c-green)' },
  };
  const status = STATUS[tournament.status] || { label: tournament.status, tone: 'var(--text-secondary)' };
  const liveCount = tourneyMatches.filter(m => m.status === 'live').length;
  const tabs = ([
    { id: 'bracket', label: 'Knockout bracket', Icon: Trophy, show: tournament.format !== 'league' },
    { id: 'standings', label: 'Standings', Icon: Layers, show: tournament.format !== 'knockout' },
    { id: 'fixtures', label: `Fixtures and results (${tourneyMatches.length})`, Icon: Calendar, show: true },
    { id: 'teams', label: `Teams (${participants.length})`, Icon: Users, show: true },
  ] as const).filter(t => t.show);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      <Link
        href={isEvent ? publicHref : `/${club.slug}/admin/tournaments`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 36, marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{isEvent ? 'Back to the tournament page' : 'Back to tournaments'}</span>
      </Link>

      {/* Heading and the screen's own actions, as on every admin screen */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          {/* The status wraps under a long cup name instead of squeezing it into a narrow column */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem 0.65rem' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.44rem, 4.5vw, 1.728rem)', lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', margin: 0, overflowWrap: 'anywhere' }}>
              {tournament.name}
            </h1>
            <span style={pill(status.tone)}>{status.label}</span>
          </div>
          {/* Spacing, not "•" separators: when the details wrap, a dot would be left dangling at a line end */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem 1.1rem', marginTop: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
            <span className="row row-tight"><Layers size={14} aria-hidden="true" /><span>{formatLabel}</span></span>
            <span className="row row-tight"><Calendar size={14} aria-hidden="true" /><span>Season {tournament.season}</span></span>
            <span className="row row-tight">
              <Clock size={14} aria-hidden="true" />
              <span>{parseTournamentDate(tournament.start_date)?.toLocaleString(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) || 'Date to be confirmed'}</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href={publicHref} target="_blank" className="btn btn-sm btn-secondary" style={actionBtn}>
            <span>{isEvent ? 'Public page' : 'Spectator hub'}</span>
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
          {reviewsReady && !isEvent && tourneyMatches.some(m => m.status === 'completed') && (
            <Link href={`/${club.slug}/admin/match-center/cup-review?tournament=${tournament.id}`} className="btn btn-sm btn-secondary" style={actionBtn} title="Every game's match review together (coaches and admins only)">
              <NotebookPen size={14} aria-hidden="true" />
              <span>Review</span>
            </Link>
          )}
          <button type="button" onClick={() => setEditOpen(true)} className="btn btn-sm btn-secondary" style={actionBtn} title="Edit name, dates, venue, cover, format and teams">
            <Pencil size={14} aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button type="button" onClick={handleProgressStage} className="btn btn-sm btn-secondary" style={actionBtn} title="Advance knockout round winners">
            <Sparkles size={14} aria-hidden="true" />
            <span>Progress bracket</span>
          </button>
          <button type="button" onClick={() => handleGenerateTiesheet(true)} className="btn btn-sm btn-secondary" style={actionBtn} title="Randomise the draw and make the fixtures again">
            <Shuffle size={14} aria-hidden="true" />
            <span>Shuffle draw</span>
          </button>
          <button type="button" onClick={() => handleGenerateTiesheet(false)} className="btn btn-sm btn-primary" style={actionBtn}>
            <RefreshCw size={14} aria-hidden="true" />
            <span>Generate tiesheet</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: `color-mix(in oklab, ${feedbackTone === 'error' ? 'var(--c-red)' : 'var(--c-green)'} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${feedbackTone === 'error' ? 'var(--c-red)' : 'var(--c-green)'} 45%, transparent)`,
            color: 'var(--text-primary)',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}
        >
          {feedbackTone === 'error'
            ? <AlertCircle size={16} aria-hidden="true" style={{ flex: 'none', color: 'var(--c-red)' }} />
            : <CheckCircle2 size={16} aria-hidden="true" style={{ flex: 'none', color: 'var(--c-green)' }} />}
          {feedback}
        </div>
      )}

      {/* The figures: one ruled strip */}
      <dl style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', margin: '0 0 1.5rem', overflow: 'hidden' }}>
        {([
          ['Teams', participants.length, undefined],
          ['Fixtures', tourneyMatches.length, undefined],
          ['Completed', tourneyMatches.filter(m => m.status === 'completed').length, undefined],
          ['Live now', liveCount, liveCount > 0 ? 'var(--c-red)' : undefined],
        ] as const).map(([label, value, tone], i) => (
          <div key={label} style={{ minWidth: 0, padding: '0.75rem 1rem', borderLeft: i ? '1px solid var(--border-subtle)' : undefined }}>
            <dt style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</dt>
            <dd style={{ margin: '0.15rem 0 0', fontFamily: 'var(--font-heading)', fontSize: '1.44rem', fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: tone || 'var(--text-primary)' }}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* Public tournaments show teams only, no player names */}
      {!isEvent && (
        <PlayerOfTournament
          tournament={tournament}
          members={members.filter(m => m.club_id === club.id)}
          isAdmin
          onSaved={updates => updateTournament(tournament.id, updates)}
        />
      )}

      {/* Tabs: an underlined row that scrolls sideways on a phone */}
      <div role="tablist" aria-label="Tournament" style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map(({ id, label, Icon }) => {
          const on = activeTab === id;
          return (
            <button key={id} type="button" role="tab" aria-selected={on} data-view-ok onClick={() => setActiveTab(id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minHeight: 40, padding: '0 0.75rem', marginBottom: -1,
                background: 'none', border: 0, borderBottom: `2px solid ${on ? 'var(--club-primary)' : 'transparent'}`,
                color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: on ? 600 : 500,
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}>
              <Icon size={14} aria-hidden="true" style={{ color: on ? 'var(--club-ink)' : 'var(--text-muted)' }} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Bracket / Tiesheet */}
      {activeTab === 'bracket' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Tap a match to enter the full-time score or penalties, or open it in Match Centre.
            </span>
          </div>
          <TournamentBracketView
            matches={tourneyMatches}
            onSelectMatch={m => setSelectedMatch(m)}
            isAdmin={true}
          />
        </div>
      )}

      {/* Tab 2: Standings / Points Table */}
      {activeTab === 'standings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {tournament.format === 'group_knockout' ? (
            // Render each group
            GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(groupLetter => {
              const groupStandings = getTournamentStandings(tournament.id, groupLetter);
              return (
                <div key={groupLetter}>
                  <TournamentStandingsTable
                    standings={groupStandings}
                    groupTitle={tournament.group_count === 1 ? 'Group stage standings' : `Group ${groupLetter} standings`}
                    advancingCount={tournament.teams_advancing_per_group ?? 2}
                  />
                </div>
              );
            })
          ) : (
            // League standings
            <TournamentStandingsTable
              standings={getTournamentStandings(tournament.id)}
              groupTitle="Standings"
              advancingCount={0}
            />
          )}
        </div>
      )}

      {/* Tab 3: Fixtures & Results List */}
      {activeTab === 'fixtures' && (
        <TournamentMatchesList
          matches={tourneyMatches}
          clubSlug={club.slug}
          linkToMatch={!isEvent}
          onSelectMatch={m => setSelectedMatch(m)}
          isAdmin={true}
        />
      )}

      {/* Tab 4: Teams & Roster */}
      {activeTab === 'teams' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ flex: '1 1 260px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Teams in this tournament. Club teams link to club members.
            </span>
            <button type="button" onClick={() => setAddTeamModalOpen(true)} className="btn btn-sm btn-primary" style={actionBtn}>
              <Plus size={14} aria-hidden="true" />
              <span>Add a guest team</span>
            </button>
          </div>

          <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '0.75rem', margin: 0, padding: 0, listStyle: 'none' }}>
            {participants.map(part => (
              <li key={part.id} style={{ ...panel, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    flex: 'none',
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'color-mix(in oklab, var(--text-primary) 6%, transparent)',
                    boxShadow: `inset 0 0 0 2px ${part.color || 'var(--border-medium)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '4px',
                  }}
                >
                  <img loading="lazy" decoding="async" src={part.logo_url || DEFAULT_CREST} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {part.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem 0.5rem', marginTop: '0.25rem' }}>
                    <span style={pill(part.team_type === 'internal' ? 'var(--c-green)' : 'var(--text-secondary)')}>
                      {part.team_type === 'internal' ? 'Club team' : 'Guest team'}
                    </span>
                    {part.seed && <span className="text-meta">Seed {part.seed}</span>}
                    {part.group && <span className="text-meta">Group {part.group}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Score Modal */}
      {selectedMatch && (
        <TournamentScoreModal
          match={selectedMatch}
          clubSlug={club.slug}
          linkToMatch={!isEvent}
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onSaveSchedule={(matchId, schedule) => updateMatch(matchId, schedule)}
          onSaveScore={(matchId, homeScore, awayScore, homePens, awayPens, status) => {
            updateTournamentMatchScore(matchId, homeScore, awayScore, homePens, awayPens, status);
            setFeedbackTone('success');
            setFeedback('Score saved. The standings and bracket are up to date.');
            setTimeout(() => setFeedback(null), 3500);
          }}
        />
      )}

      {/* Add a guest team */}
      {addTeamModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            background: 'rgba(var(--dk-4-6-9), 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setAddTeamModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tournament-guest-title"
            style={{
              margin: 'auto',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              color: 'var(--text-primary)',
            }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') setAddTeamModalOpen(false); }}
          >
            <h2 id="tournament-guest-title" style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 600 }}>Add a guest team</h2>
            <form onSubmit={handleAddGuestTeam}>
              <div className="form-group">
                <label htmlFor="tournamentid-team-name" className="form-label">Team name *</label>
                <input id="tournamentid-team-name"
                  type="text"
                  className="form-input"
                  required
                  autoFocus
                  placeholder="e.g. Northern United"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="tournamentid-short-code" className="form-label">Short code</label>
                <input id="tournamentid-short-code"
                  type="text"
                  className="form-input"
                  maxLength={4}
                  placeholder="e.g. NUFC"
                  value={newTeamCode}
                  onChange={e => setNewTeamCode(e.target.value.toUpperCase())}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setAddTeamModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && (
        <TournamentFormModal
          club={club}
          tournament={tournament}
          onClose={() => setEditOpen(false)}
          onSaved={msg => {
            setEditOpen(false);
            setFeedbackTone('success');
            setFeedback(msg);
            setTimeout(() => setFeedback(null), 4000);
          }}
        />
      )}
    </div>
  );
}
