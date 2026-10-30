'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
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
  ChevronRight,
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
  } = useClub();

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
  const pickerGames = activeMatch && kind !== 'tournament' && !kindList.some(m => m.id === activeMatch.id) ? [activeMatch, ...kindList] : kindList;

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
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No fixtures yet</h2>
        <p className="text-body" style={{ marginBottom: '1.25rem' }}>Schedule a match first, then come back here to pick the lineup.</p>
        <Link href={`/${club.slug}/admin/matches`} className="btn btn-primary">Schedule a Match</Link>
      </div>
    );
  }

  if (!club || !activeMatch) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <p>Loading coach workbench...</p>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>

        {/* Header Breadcrumbs & Action Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div className="min-w-0">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <Link href={`/${club.slug}/admin`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Admin</Link>
              <ChevronRight size={14} />
              <Link href={`/${club.slug}/admin/match-center`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Match Centre</Link>
              <ChevronRight size={14} />
              <span className="text-primary">Draft Lineup Workbench</span>
            </div>

            <h1 style={{ fontSize: 'clamp(1.3rem, 5vw, 1.75rem)', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <Layers size={26} color="var(--c-amber)" />
              <span>Draft Lineup & Tactical Workbench</span>
              <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>Coach Sandbox</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              Experiment with starting lineups and substitutions during the week without publishing changes prematurely.
            </p>
          </div>

          <div className="row row-loose row-wrap">
            <Link
              href={`/${club.slug}/admin/availability`}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Users size={14} color="var(--c-green)" />
              <span>Availability Hub</span>
            </Link>

            <button
              onClick={() => setShowPublishModal(true)}
              className="btn btn-primary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: 'var(--text-primary)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Send size={15} />
              <span>{groupGames.length > 1 ? `Publish to all ${groupGames.length} games` : 'Publish to Match Centre'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div
            role="status"
            style={{
              position: 'sticky',
              top: '0.5rem',
              zIndex: 50,
              padding: '0.75rem 1.25rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: feedback.type === 'error' ? 'rgba(60, 12, 12, 0.95)' : feedback.type === 'info' ? 'rgba(12, 24, 48, 0.95)' : 'rgba(6, 40, 28, 0.95)',
              border: `1px solid ${feedback.type === 'error' ? '#EF4444' : feedback.type === 'info' ? '#3B82F6' : '#10B981'}`,
              color: feedback.type === 'error' ? 'var(--c-red)' : feedback.type === 'info' ? 'var(--c-sky)' : 'var(--c-green)',
            }}
          >
            {feedback.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Fixture selector & status */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <MatchKindSwitch games={prepGames} active={kind} onPick={pickKind} />
            <label htmlFor="fixture-select" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {activeGroup ? 'Team:' : 'Fixture Target:'}
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
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', width: '100%', maxWidth: '420px' }}
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
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', width: '100%', maxWidth: '420px' }}
              >
                {pickerGames.map(m => (
                  <option key={m.id} value={m.id}>
                    {fixtureLabel(m, club?.name || '')}{m.competition ? ` (${m.competition})` : ''}
                  </option>
                ))}
              </select>
            )}
            {activeGroup && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                One line-up for the day, published to every game: {groupGames.map(g => {
                  const opp = teamSideIn(g, activeGroup.participant.name) === 'home' ? g.away_team_name : g.home_team_name;
                  return `${g.match_time ? `${g.match_time} ` : ''}vs ${opp}`;
                }).join(' · ')}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {isDirty && (
              <span style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '20px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid #3B82F6',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: 'var(--c-sky)',
              }}>
                Unsaved changes
              </span>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '20px',
              background: currentDraft?.is_published ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${currentDraft?.is_published ? '#10B981' : '#F59E0B'}`,
              fontSize: '0.78rem',
              fontWeight: 800,
              color: currentDraft?.is_published ? 'var(--c-green)' : 'var(--c-amber)',
            }}>
              {currentDraft?.is_published ? <CheckCircle2 size={14} /> : <Shield size={14} />}
              <span>{currentDraft?.is_published ? 'Published Live' : 'Draft Mode (Private)'}</span>
            </div>
          </div>
        </div>

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
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ClipboardList size={16} color={club.primary_color} /> Coach Instructions & Tactical Cues
              </h3>
              <textarea aria-label="Coach instructions and tactical cues"
                className="form-input"
                rows={3}
                placeholder="Add team instructions, set-piece assignments, pressing triggers..."
                value={tacticalNotes}
                onChange={e => { setTacticalNotes(e.target.value); setIsDirty(true); }}
                style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>
          }
        />

        {/* PUBLISH CONFIRMATION MODAL */}
        {showPublishModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}>
            <div className="glass-panel" style={{ margin: 'auto', maxWidth: '480px', width: '100%', padding: '2rem', animation: 'fadeIn 0.25s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ width: '42px', height: '42px', flexShrink: 0, borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={22} color="var(--c-green)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>Publish Lineup to Match Centre?</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    This saves the lineup shown on the board and immediately updates the live public match centre.
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(var(--shade-rgb), 0.4)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span className="text-muted">Match:</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', textAlign: 'right' }}>
                    {activeGroup
                      ? `${activeGroup.participant.name} · ${tournamentName(activeGroup.tournamentId)} (all ${groupGames.length} games)`
                      : `${activeMatch.home_team_name} vs ${activeMatch.away_team_name}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Format:</span>
                  <span style={{ fontWeight: 800, color: 'var(--c-green)' }}>{matchFormat}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Formation:</span>
                  <span style={{ fontWeight: 800, color: 'var(--c-amber)' }}>{formation}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Starting Players:</span>
                  <span style={{ fontWeight: 800, color: starterCount < lineupCoords.length ? 'var(--c-amber)' : 'var(--text-primary)' }}>
                    {starterCount} of {lineupCoords.length} positions filled
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.55rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="btn btn-primary btn-sm"
                  style={{
                    padding: '0.55rem 1.25rem',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 800,
                  }}
                >
                  Confirm & Publish Live
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminGuard>
  );
}
