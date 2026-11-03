'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { offerLineupAppearances } from '@/components/offerLineupAppearances';
import { MatchFormat, PitchPosition, isPlayerMember } from '@/lib/supabase/types';
import { FORMAT_PRESETS, buildLineupForPreset, defaultPresetFor, normalizeLineup } from '@/components/TacticalPitch';
import LineupWorkbench from '@/components/LineupWorkbench';
import { clubLineupSide, clubSidePlayers } from '@/lib/tournament-engine';
import { matchKind, prepFixtures, teamSideIn, tournamentTeamGroups, type MatchKind } from '@/lib/fixtures';
import MatchKindSwitch from '@/components/admin/MatchKindSwitch';
import { fixtureLabel } from '@/lib/fixture-label';
import AdminGuard from '@/components/AdminGuard';
import {
  Layers,
  Send,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Users,
  ClipboardList,
} from 'lucide-react';
import { squadForMatch } from '@/lib/teams';
import { confirmAction } from '@/components/ConfirmDialog';

export default function DraftLineupPage() {
  const params = useParams();
  const slug = params?.clubSlug as string;

  const {
    selectClubBySlug,
    members,
    matches,
    availabilities,
    draftLineups,
    saveDraftLineup,
    publishDraftLineup,
    clubTeams,
    clubTeamMembers,
    tournamentParticipants,
    tournaments,
    internalTeams,
    syncStatus,
    loadMatchStatLines,
    fixMatchStats,
  } = useClub();
  const { user } = useAuth();

  const club = selectClubBySlug(slug);

  // Every player in the club (used as a fallback when attendance was never tracked for a match)
  const allSquadPlayers = useMemo(() => {
    if (!club) return [];
    return members.filter(m => m.club_id === club.id && isPlayerMember(m));
  }, [club, members]);

  const clubMatches = useMemo(() => {
    if (!club) return [];
    return matches.filter(m => m.club_id === club.id);
  }, [club, matches]);

  // ?match=<id> (from the dashboard's "Needs you" card) opens on that fixture
  const requestedMatchId = useSearchParams().get('match') || '';
  const [pickedMatchId, setSelectedMatchId] = useState<string>('');
  const selectedMatchId = pickedMatchId || requestedMatchId;
  // The games a line-up gets picked for: still to play, and only ones the club's own players are in
  const prepGames = useMemo(
    () => (club ? prepFixtures(clubMatches, tournamentParticipants, club.name) : []),
    [club, clubMatches, tournamentParticipants]
  );
  const activeMatch =
    clubMatches.find(m => m.id === selectedMatchId) ||
    // A game against another club (or a cup) before a training game
    prepGames.find(m => matchKind(m) !== 'inhouse') ||
    prepGames[0] ||
    clubMatches.find(m => m.status === 'upcoming') ||
    clubMatches[0];

  // Club games, tournaments and in-house games each have their own list. A tournament gets one
  // line-up per team for the whole day, published to every game that team plays there.
  const kind: MatchKind = activeMatch ? matchKind(activeMatch) : 'club';
  const kindGames = (k: MatchKind) => prepGames.filter(m => matchKind(m) === k);
  const teamGroups = useMemo(
    () => tournamentTeamGroups(prepGames.filter(m => m.tournament_id), tournamentParticipants),
    [prepGames, tournamentParticipants]
  );
  const [groupPick, setGroupPick] = useState<string | null>(null);
  const activeGroup = useMemo(
    () => (kind === 'tournament' && activeMatch
      ? teamGroups.find(g => g.key === groupPick && g.games.some(x => x.id === activeMatch.id))
        || teamGroups.find(g => g.games.some(x => x.id === activeMatch.id))
      : undefined),
    [kind, activeMatch, teamGroups, groupPick]
  );
  const groupGames = useMemo(() => (activeGroup ? activeGroup.games : activeMatch ? [activeMatch] : []), [activeGroup, activeMatch]);
  const tournamentName = (id?: string | null) => tournaments.find(t => t.id === id)?.name || 'Tournament';
  // The columns the line-up lives in: the team's own side in a tournament game
  const sideIn = (m: NonNullable<typeof activeMatch>) => (activeGroup ? teamSideIn(m, activeGroup.participant.name) : clubLineupSide(m));
  const kindList = kindGames(kind);
  // The game on the board is always in the list, unless its tournament team's picker shows it instead
  // (a past cup game, when nothing is coming up, has no team group and would leave the list empty)
  const pickerGames = activeMatch && !activeGroup && !kindList.some(m => m.id === activeMatch.id) ? [activeMatch, ...kindList] : kindList;

  const matchAvailabilities = useMemo(() => {
    const ids = new Set(groupGames.map(g => g.id));
    return availabilities.filter(a => a.match_id && ids.has(a.match_id));
  }, [availabilities, groupGames]);

  // The fixture's team squad once the club has several teams (everyone otherwise); a tournament team its own roster
  const teamSquad = useMemo(() => {
    const squad = squadForMatch(allSquadPlayers, activeMatch, clubTeams, clubTeamMembers);
    if (!activeGroup || !activeMatch) return squad;
    return clubSidePlayers(activeMatch, teamSideIn(activeMatch, activeGroup.participant.name), squad, tournamentParticipants, internalTeams) ?? squad;
  }, [allSquadPlayers, activeMatch, clubTeams, clubTeamMembers, activeGroup, tournamentParticipants, internalTeams]);

  // The whole squad can be picked: players who said In first, then Maybe, no reply yet, and Out last (the bench
  // shows each one's answer). Only the In players go into the default XI; with no answers at all, everyone does.
  const { squadPlayers, starterPool, answerOf } = useMemo(() => {
    const best = new Map<string, 'available' | 'maybe' | 'unavailable'>();
    for (const st of ['unavailable', 'maybe', 'available'] as const) {
      matchAvailabilities.filter(a => a.status === st).forEach(a => best.set(a.member_id, st));
    }
    const answer = (id: string) => best.get(id) || 'pending';
    if (matchAvailabilities.length === 0) return { squadPlayers: teamSquad, starterPool: teamSquad, answerOf: answer };
    const rank = { available: 0, maybe: 1, pending: 2, unavailable: 3 } as const;
    const ordered = [...teamSquad].sort((a, b) => rank[answer(a.id)] - rank[answer(b.id)]);
    return { squadPlayers: ordered, starterPool: ordered.filter(p => answer(p.id) === 'available'), answerOf: answer };
  }, [teamSquad, matchAvailabilities]);

  const currentDraft = draftLineups.find(d => d.match_id === activeMatch?.id);

  // The lineup a fixture opens with: its saved draft, else its published lineup, else a default XI
  const source = useMemo(() => {
    if (!activeMatch) return null;
    if (currentDraft?.lineup_coords?.length) {
      return { format: currentDraft.format, formation: currentDraft.formation, coords: currentDraft.lineup_coords, notes: currentDraft.tactical_notes || '' };
    }
    const side = activeGroup ? teamSideIn(activeMatch, activeGroup.participant.name) : clubLineupSide(activeMatch);
    const publishedFormation = activeMatch[`${side}_formation`];
    const publishedCoords = activeMatch[`${side}_lineup_coords`];
    if (publishedCoords?.length) {
      return { format: activeMatch.match_format || '11v11', formation: publishedFormation || '4-3-3', coords: publishedCoords, notes: '' };
    }
    const fmt: MatchFormat = activeMatch.match_format || '11v11';
    const presetKey = publishedFormation && FORMAT_PRESETS[fmt]?.[publishedFormation]
      ? publishedFormation
      : defaultPresetFor(fmt);
    return { format: fmt, formation: presetKey, coords: buildLineupForPreset(starterPool, presetKey), notes: '' };
  }, [activeMatch, currentDraft, starterPool, activeGroup]);
  const sourceKey = source ? `${activeMatch?.id}|${JSON.stringify(source)}` : '';

  const [matchFormat, setMatchFormat] = useState<MatchFormat>('11v11');
  const [formation, setFormation] = useState<string>('4-3-3');
  const [lineupCoords, setLineupCoords] = useState<PitchPosition[]>([]);
  const [tacticalNotes, setTacticalNotes] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const loadedMatchIdRef = useRef<string | null>(null);

  // Load a fixture's lineup when switching fixture, or when its saved data arrives/changes before the coach
  // has touched anything. Never on incidental re-renders, and never over unsaved edits.
  useEffect(() => {
    if (!source || !activeMatch) return;
    const switched = loadedMatchIdRef.current !== activeMatch.id;
    if (!switched && isDirty) return;
    loadedMatchIdRef.current = activeMatch.id;
    setMatchFormat(source.format);
    setFormation(source.formation);
    setLineupCoords(normalizeLineup(source.coords));
    setTacticalNotes(source.notes);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const updateLineup: React.Dispatch<React.SetStateAction<PitchPosition[]>> = useCallback(update => {
    setLineupCoords(update);
    setIsDirty(true);
  }, [setIsDirty]);

  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ text, type });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3500);
  }, []);

  // Warn before leaving the page with unsaved lineup changes
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Loaded, but there's no fixture to pick a lineup for yet
  if (club && !activeMatch && syncStatus.phase !== 'loading') {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', maxWidth: '560px', margin: '2rem auto' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No fixtures yet</h2>
        <p className="text-body" style={{ marginBottom: '1.25rem' }}>Schedule a match first, then come back here to pick the lineup.</p>
        <Link href={`/${club.slug}/admin/matches`} className="btn btn-primary">Schedule a match</Link>
      </div>
    );
  }

  if (!club || !activeMatch) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <p>Loading the lineup workbench…</p>
      </div>
    );
  }

  // Across a tournament team's games: the best answer the player gave
  const getPlayerAvailability = answerOf;

  const starterCount = lineupCoords.filter(p => p.member_id).length;
  const benchIdsFor = (coords: PitchPosition[]) =>
    // Published substitutes: players not starting who didn't say they're out (anyone, when nobody answered)
    squadPlayers.filter(p => !coords.some(pos => pos.member_id === p.id))
      .filter(p => matchAvailabilities.length === 0 || ['available', 'maybe'].includes(answerOf(p.id)))
      .map(p => p.id);

  const persistDraft = (formationName: string, coords: PitchPosition[]) => {
    saveDraftLineup({
      club_id: club.id,
      match_id: activeMatch.id,
      format: matchFormat,
      formation: formationName,
      lineup_coords: coords,
      bench_member_ids: benchIdsFor(coords),
      tactical_notes: tacticalNotes,
    });
    setIsDirty(false);
  };

  const handleSaveDraft = (formationName: string, coords: PitchPosition[]) => {
    setFormation(formationName);
    setLineupCoords(coords);
    persistDraft(formationName, coords);
    showFeedback('Draft lineup saved (private to coaches).');
  };

  const handlePublish = () => {
    persistDraft(formation, lineupCoords);
    // Pass the lineup on screen: the save above hasn't reached `draftLineups` yet within this event
    const latest = { format: matchFormat, formation, lineup_coords: lineupCoords };
    // A tournament team's line-up goes on every game it plays that day, on its own side of each
    const results = groupGames.map(g => publishDraftLineup(g.id, latest, sideIn(g)));
    const res = results.find(r => !r.success) || results[0];
    setShowPublishModal(false);
    showFeedback(res && res.success && groupGames.length > 1 ? `Published to all ${groupGames.length} of ${activeGroup?.participant.name}'s games.` : res?.message || '', res?.success ? 'success' : 'error');
    // Games whose stats are already saved: offer the line-up players with no appearance one
    if (res?.success) {
      void offerLineupAppearances(groupGames, lineupCoords.map(p => p.member_id), {
        loadMatchStatLines, fixMatchStats, adminName: user?.full_name || 'Club Committee',
      }).then(r => { if (r) showFeedback(r.message, r.ok ? 'success' : 'error'); });
    }
  };

  const handleSelectMatch = async (matchId: string, groupKey?: string) => {
    if (isDirty && !(await confirmAction({ title: 'Discard unsaved lineup changes?', message: "Your changes to this fixture's lineup haven't been saved.", confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true }))) return;
    setIsDirty(false);
    if (groupKey) setGroupPick(groupKey);
    setSelectedMatchId(matchId);
  };
  const pickKind = (k: MatchKind) => {
    if (k === 'tournament' && teamGroups[0]) return void handleSelectMatch(teamGroups[0].games[0].id, teamGroups[0].key);
    const first = kindGames(k)[0];
    if (first) void handleSelectMatch(first.id);
  };

  return (
    <AdminGuard club={club}>
      <div className="admin-stack" style={{ paddingBottom: '3rem' }}>

        {/* Heading and the screen's own actions, as on every admin screen */}
        <div className="admin-head" style={{ marginBottom: 0 }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
              <Layers aria-hidden="true" />
              <span>Lineup workbench</span>
              <span className="admin-pill is-warn">Draft, coaches only</span>
            </h1>
            <p>Try starting line-ups and substitutions during the week. Nothing shows in Match Centre until you publish.</p>
          </div>

          <div className="admin-head-actions">
            <Link href={`/${club.slug}/admin/availability`} className="btn btn-secondary row">
              <Users size={16} aria-hidden="true" />
              <span>Player availability</span>
            </Link>
            <button type="button" onClick={() => setShowPublishModal(true)} className="btn btn-primary row">
              <Send size={16} aria-hidden="true" />
              <span>{groupGames.length > 1 ? `Publish to all ${groupGames.length} games` : 'Publish to Match Centre'}</span>
            </button>
          </div>
        </div>

        {/* The result of a save or publish: sticky, so it shows while the board is scrolled */}
        {feedback && (
          <div role="status" className={feedback.type === 'error' ? 'admin-flash is-error' : 'admin-flash'}
            style={{ position: 'sticky', top: 'var(--space-xs)', zIndex: 50, margin: 0, background: 'var(--color-paper-2)', boxShadow: 'var(--shadow-pop)' }}>
            {feedback.type === 'error' ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Fixture selector & status */}
        <section className="admin-panel" aria-label="Fixture" style={{ padding: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <MatchKindSwitch games={prepGames} active={kind} onPick={pickKind} />
            <label htmlFor="fixture-select" className="form-label" style={{ display: 'block' }}>
              {activeGroup ? 'Team' : 'Fixture'}
            </label>
            {activeGroup ? (
              <select data-view-ok
                id="fixture-select"
                className="form-select"
                value={activeGroup.key}
                onChange={e => {
                  const g = teamGroups.find(x => x.key === e.target.value);
                  if (g) void handleSelectMatch(g.games[0].id, g.key);
                }}
                style={{ width: '100%', maxWidth: '420px' }}
              >
                {teamGroups.map(g => (
                  <option key={g.key} value={g.key}>
                    {g.participant.name} · {tournamentName(g.tournamentId)} ({g.games.length} game{g.games.length === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            ) : (
              <select data-view-ok
                id="fixture-select"
                className="form-select"
                value={activeMatch.id}
                onChange={e => handleSelectMatch(e.target.value)}
                style={{ width: '100%', maxWidth: '420px' }}
              >
                {pickerGames.map(m => (
                  <option key={m.id} value={m.id}>
                    {fixtureLabel(m, club?.name || '')}{m.competition ? ` (${m.competition})` : ''}
                  </option>
                ))}
              </select>
            )}
            {activeGroup && (
              <p className="text-meta" style={{ marginTop: 'var(--space-xs)' }}>
                One line-up for the day, published to every game: {groupGames.map(g => {
                  const opp = teamSideIn(g, activeGroup.participant.name) === 'home' ? g.away_team_name : g.home_team_name;
                  return `${g.match_time ? `${g.match_time} ` : ''}vs ${opp}`;
                }).join(' · ')}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
            {isDirty && <span className="admin-pill is-warn">Unsaved changes</span>}
            <span className={currentDraft?.is_published ? 'admin-pill is-ok' : 'admin-pill'}>
              {currentDraft?.is_published ? <CheckCircle2 size={12} aria-hidden="true" /> : <Shield size={12} aria-hidden="true" />}
              {currentDraft?.is_published ? 'Published' : 'Draft, not published'}
            </span>
          </div>
        </section>

        <LineupWorkbench
          players={squadPlayers}
          positions={lineupCoords}
          onPositionsChange={updateLineup}
          formation={formation}
          onFormationChange={key => { setFormation(key); setIsDirty(true); }}
          matchFormat={matchFormat}
          onFormatChange={fmt => { setMatchFormat(fmt); setIsDirty(true); }}
          primaryColor={club.primary_color}
          teamName={activeGroup?.participant.name || activeMatch.home_team_name}
          getAvailability={getPlayerAvailability}
          onSave={handleSaveDraft}
          onNotify={showFeedback}
          footer={
            <section className="admin-panel" aria-labelledby="lineup-notes-title">
              <div className="admin-panel-head">
                <h2 id="lineup-notes-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                  <ClipboardList size={16} aria-hidden="true" style={{ color: 'var(--color-muted)' }} /> Coach instructions
                </h2>
              </div>
              <div className="admin-section">
                <textarea aria-label="Coach instructions"
                  className="form-textarea"
                  rows={3}
                  placeholder="Team instructions, set-piece jobs, pressing triggers…"
                  value={tacticalNotes}
                  onChange={e => { setTacticalNotes(e.target.value); setIsDirty(true); }}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </section>
          }
        />

        {/* Publish confirmation */}
        {showPublishModal && (
          <div
            onClick={() => setShowPublishModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              background: 'var(--color-scrim)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-md)',
            }}>
            <div role="dialog" aria-modal="true" aria-labelledby="publish-lineup-title" className="admin-panel"
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Escape') setShowPublishModal(false); }}
              style={{ margin: 'auto', maxWidth: '480px', width: '100%', padding: 'var(--space-lg)', boxShadow: 'var(--shadow-pop)' }}>
              <h2 id="publish-lineup-title" style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-ink)' }}>Publish this line-up?</h2>
              <p style={{ margin: 'var(--space-2xs) 0 var(--space-md)', color: 'var(--color-ink-2)', fontSize: 'var(--text-sm)' }}>
                It saves the line-up on the board and shows it in the public Match Centre straight away.
              </p>

              <dl style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: 'var(--space-xs) var(--space-md)', margin: '0 0 var(--space-lg)', padding: 'var(--space-sm) var(--space-md)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-card)', background: 'var(--color-paper)', fontSize: 'var(--text-sm)' }}>
                <dt style={{ color: 'var(--color-muted)' }}>Match</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: 'var(--color-ink)', overflowWrap: 'anywhere' }}>
                  {activeGroup
                    ? `${activeGroup.participant.name} · ${tournamentName(activeGroup.tournamentId)} (all ${groupGames.length} games)`
                    : `${activeMatch.home_team_name} vs ${activeMatch.away_team_name}`}
                </dd>
                <dt style={{ color: 'var(--color-muted)' }}>Format</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: 'var(--color-ink)' }}>{matchFormat}</dd>
                <dt style={{ color: 'var(--color-muted)' }}>Formation</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: 'var(--color-ink)' }}>{formation}</dd>
                <dt style={{ color: 'var(--color-muted)' }}>Starters</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: starterCount < lineupCoords.length ? 'var(--color-warn)' : 'var(--color-ink)' }}>
                  {starterCount} of {lineupCoords.length} positions filled
                </dd>
              </dl>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-xs)' }}>
                <button type="button" onClick={() => setShowPublishModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="button" onClick={handlePublish} className="btn btn-primary row">
                  <Send size={16} aria-hidden="true" /> Publish
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminGuard>
  );
}
