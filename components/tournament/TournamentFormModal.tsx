'use client';

import React, { useState } from 'react';
import { useClub } from '@/lib/club-context';
import { Club, Tournament, TournamentFormat, TournamentParticipant } from '@/lib/supabase/types';
import { Trophy, X, Sparkles, Save, AlertTriangle } from 'lucide-react';
import ImageUploadZone from '@/components/ImageUploadZone';
import CoverPresetPicker from '@/components/CoverPresetPicker';
import { DEFAULT_CREST } from '@/lib/crest';
import { COVER_PRESETS } from '@/lib/cover-presets';
import { defaultSeasonLabel } from '@/lib/season';
import { STAGE_TITLES, buildTiesheet, effectiveGroupRules, knockoutStageFor, parseTournamentDate, toDateTimeLocal } from '@/lib/tournament-engine';
import { packKickoffs, shortCode } from '@/lib/hosted-tournaments';
import { useHostedTournamentsReady } from '@/lib/use-event-fixtures-ready';
import { confirmAction } from '@/components/ConfirmDialog';
import PopupPanel from '@/components/PopupPanel';

// A team that was already in the tournament keeps its id (and with it its crest, entry link and squad)
type ParticipantInput = Omit<TournamentParticipant, 'id' | 'tournament_id'> & { id?: string };

/** Create a tournament, or edit one when `tournament` is given */
export default function TournamentFormModal({
  club,
  tournament,
  ageGroupOf,
  onClose,
  onSaved,
}: {
  club: Club;
  tournament?: Tournament;
  /** New age group of this hosted tournament: starts from its settings, with its own teams and draw */
  ageGroupOf?: Tournament;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { internalTeams, tournamentParticipants, matches, events, createTournament, saveTournament, getActiveSeason } = useClub();
  const hosted = useHostedTournamentsReady();
  // A new age group copies the event's settings; its teams start empty
  const base = tournament ?? ageGroupOf;
  const clubInternalTeams = internalTeams.filter(t => t.club_id === club.id);
  const existing = tournament ? tournamentParticipants.filter(p => p.tournament_id === tournament.id) : [];
  const isEdit = !!tournament;

  const startDefault = new Date();
  startDefault.setHours(15, 0, 0, 0);
  const [name, setName] = useState(base?.name ?? '');
  const [season, setSeason] = useState(base?.season ?? (getActiveSeason(club.id)?.name || defaultSeasonLabel()));
  const [format, setFormat] = useState<TournamentFormat>(base?.format ?? 'group_knockout');
  const [venue, setVenue] = useState(base?.venue ?? club.stadium_name ?? '');
  const [bannerUrl, setBannerUrl] = useState(base?.banner_url ?? COVER_PRESETS[0].url);
  const [startAt, setStartAt] = useState(toDateTimeLocal(base?.start_date ?? startDefault.toISOString()));
  const [endAt, setEndAt] = useState(
    toDateTimeLocal(base ? base.end_date : new Date(startDefault.getTime() + 30 * 86400000).toISOString())
  );
  const [description, setDescription] = useState(base?.description ?? '');
  const [groupCount, setGroupCount] = useState(base?.group_count ?? 2);
  const [teamsAdvancing, setTeamsAdvancing] = useState(base?.teams_advancing_per_group ?? 2);
  const [hasThirdPlace, setHasThirdPlace] = useState(base?.has_third_place_match ?? true);
  // Hosted tournament settings (migration 20261180)
  const [ageGroup, setAgeGroup] = useState(tournament?.age_group ?? '');
  const [isJunior, setIsJunior] = useState(base?.is_junior ?? false);
  const [timed, setTimed] = useState(!!base?.match_minutes);
  const [matchMinutes, setMatchMinutes] = useState(base?.match_minutes ?? 25);
  const [pitches, setPitches] = useState(base?.pitches ?? 2);
  const [dayEnd, setDayEnd] = useState(base?.day_end_time ?? '17:00');
  const [entryFee, setEntryFee] = useState(base?.entry_fee_cents ? (base.entry_fee_cents / 100).toFixed(2) : '');
  const [deadline, setDeadline] = useState(toDateTimeLocal(base?.entry_deadline ?? undefined));
  const [maxSquad, setMaxSquad] = useState(base?.max_squad ? String(base.max_squad) : '');
  const [teamInfo, setTeamInfo] = useState(base?.team_info ?? '');
  const [eventId, setEventId] = useState(base?.event_id ?? '');
  const clubEvents = events.filter(ev => ev.club_id === club.id).sort((a, b) => b.start_time.localeCompare(a.start_time)).slice(0, 40);
  const [selectedInternalTeamIds, setSelectedInternalTeamIds] = useState<string[]>(
    isEdit
      ? existing.filter(p => p.team_type === 'internal' && p.internal_team_id).map(p => p.internal_team_id!)
      : ageGroupOf ? [] : clubInternalTeams.map(t => t.id)
  );
  const [externalTeams, setExternalTeams] = useState<ParticipantInput[]>(
    existing.filter(p => p.team_type === 'external').map(({ tournament_id: _t, ...p }) => p)
  );
  const [newExternalName, setNewExternalName] = useState('');
  const [newExternalCode, setNewExternalCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teamCount = selectedInternalTeamIds.length + externalTeams.length;
  const rules = effectiveGroupRules({ group_count: groupCount, teams_advancing_per_group: teamsAdvancing }, teamCount);
  const qualifiers = rules.groupCount * rules.advancing;

  const handleAddExternalTeam = () => {
    const teamName = newExternalName.trim();
    if (!teamName) return;
    setExternalTeams(prev => [...prev, { team_type: 'external', name: teamName, short_name: newExternalCode.trim() || shortCode(teamName), logo_url: DEFAULT_CREST, color: '#2563EB' }]);
    setNewExternalName('');
    setNewExternalCode('');
  };

  const hostedFields = (): Partial<Tournament> => {
    const fee = Math.round(parseFloat(entryFee) * 100);
    const close = deadline ? new Date(deadline) : null;
    const squad = parseInt(maxSquad, 10);
    return {
      age_group: ageGroup.trim() || null,
      is_junior: isJunior,
      match_minutes: timed ? Math.min(180, Math.max(5, matchMinutes || 25)) : null,
      pitches: timed ? Math.min(20, Math.max(1, pitches || 1)) : null,
      day_end_time: timed && /^\d{2}:\d{2}$/.test(dayEnd) ? dayEnd : null,
      entry_fee_cents: fee > 0 ? fee : null,
      entry_deadline: close && !isNaN(close.getTime()) ? close.toISOString() : null,
      max_squad: squad > 0 ? Math.min(60, squad) : null,
      team_info: teamInfo.trim().slice(0, 4000) || null,
      event_id: eventId || null,
      ...(ageGroupOf && !isEdit ? { parent_id: ageGroupOf.parent_id || ageGroupOf.id } : {}),
    };
  };

  // How the day works out with these settings: games, days and when the last one finishes
  const preview = (() => {
    if (!hosted || !timed) return null;
    const start = parseTournamentDate(startAt ? new Date(startAt).toISOString() : undefined);
    if (!start || teamCount < 2) return null;
    const draft = {
      id: 'preview', club_id: club.id, name: name || 'Cup', slug: 'preview', season, format, status: 'draft', points_win: 3, points_draw: 1, points_loss: 0,
      group_count: groupCount, teams_advancing_per_group: teamsAdvancing, has_third_place_match: format !== 'league' && hasThirdPlace,
      start_date: start.toISOString(), end_date: endAt ? new Date(endAt).toISOString() : undefined,
    } as Tournament;
    const teams = Array.from({ length: teamCount }, (_, i) => ({ id: `p${i}`, tournament_id: 'preview', team_type: 'external' as const, name: `Team ${i + 1}`, short_name: `T${i + 1}`, logo_url: '' }));
    const games = buildTiesheet(draft, teams).matches;
    const res = packKickoffs(games, { start, end: endAt ? new Date(endAt) : null, matchMinutes, pitches, dayEnd });
    return { games: games.length, ...res };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : null;
    if (isNaN(start.getTime())) return setError('Set a valid start date & time.');
    if (end && end < start) return setError('End date must be after the start date.');

    const names = [
      ...selectedInternalTeamIds.map(id => clubInternalTeams.find(t => t.id === id)?.name),
      ...externalTeams.map(t => t.name),
    ].filter(Boolean).map(n => n!.toLowerCase());
    if (new Set(names).size !== names.length) return setError('Two teams share a name. Team names must be unique.');

    const participantInputs: ParticipantInput[] = [
      ...selectedInternalTeamIds.flatMap(id => {
        const team = clubInternalTeams.find(t => t.id === id);
        const kept = existing.find(p => p.internal_team_id === id);
        return team
          ? [{ ...(kept ? { id: kept.id } : {}), team_type: 'internal' as const, internal_team_id: team.id, name: team.name, short_name: team.short_name, logo_url: team.logo_url || DEFAULT_CREST, color: team.color || 'var(--c-green)' }]
          : [];
      }),
      ...externalTeams,
    ].map((p, idx) => ({ ...p, seed: idx + 1 }));

    const fields = {
      name: name.trim(),
      season,
      format,
      group_count: format === 'group_knockout' ? groupCount : undefined,
      teams_advancing_per_group: format === 'group_knockout' ? teamsAdvancing : undefined,
      has_third_place_match: format !== 'league' && hasThirdPlace,
      start_date: start.toISOString(),
      end_date: end ? end.toISOString() : undefined,
      venue: venue.trim(),
      description: description.trim(),
      banner_url: bannerUrl.trim() || COVER_PRESETS[0].url,
      // Only once the database has these columns: sending them before would fail the whole save
      ...(hosted ? hostedFields() : {}),
    };

    if (!isEdit) {
      const slug = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      createTournament(
        { ...fields, club_id: club.id, slug: `${slug}-${Date.now().toString().slice(-4)}`, status: 'draft', points_win: 3, points_draw: 1, points_loss: 0 },
        participantInputs
      );
      if (ageGroupOf) {
        onSaved(`✓ Added the ${ageGroup.trim() || fields.name} age group. Add its teams on the Teams tab.`);
        return;
      }
      onSaved(
        participantInputs.length >= 2
          ? `✓ Created "${fields.name}" with ${participantInputs.length} teams and a generated tiesheet.`
          : `✓ Created "${fields.name}" as a draft. Add at least 2 teams to generate fixtures.`
      );
      return;
    }

    // Structure or team list changed -> the tiesheet has to be rebuilt
    const teamKey = (list: { name: string }[]) => list.map(p => p.name).sort().join('|');
    const structural =
      format !== tournament.format ||
      fields.has_third_place_match !== !!tournament.has_third_place_match ||
      (format === 'group_knockout' && (groupCount !== tournament.group_count || teamsAdvancing !== tournament.teams_advancing_per_group)) ||
      teamKey(participantInputs) !== teamKey(existing);
    const played = matches.some(m => m.tournament_id === tournament.id && (m.status === 'completed' || m.status === 'live'));
    if (structural && played && !(await confirmAction({ title: 'Regenerate all fixtures?', message: 'Changing the format or teams regenerates all fixtures and clears recorded results.', confirmLabel: 'Save and regenerate', danger: true }))) {
      return;
    }
    saveTournament(tournament.id, fields, structural ? participantInputs : undefined);
    onSaved(structural ? `✓ Saved "${fields.name}" and regenerated the tiesheet.` : `✓ Saved "${fields.name}".`);
  };

  const formatSummary =
    qualifiers < 2
      ? 'Needs more teams for a knockout stage.'
      : qualifiers === 3 && rules.groupCount === 1
      ? 'Single group (round-robin) → 1st gets a bye to the Grand Final, 2nd vs 3rd in the Semi-Final, winner faces 1st for the title'
      : `${rules.groupCount === 1 ? 'Single group (round-robin)' : `${rules.groupCount} groups (round-robin)`} → top ${rules.advancing} per group (${qualifiers} teams) → ${STAGE_TITLES[knockoutStageFor(qualifiers)]}${qualifiers & (qualifiers - 1) ? ' (top seeds get byes)' : ''}`;
  const clamped = teamCount >= 2 && (rules.groupCount !== groupCount || rules.advancing !== teamsAdvancing);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(var(--dk-4-6-9), 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <PopupPanel onClose={onClose} label="Tournament details"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--dk-17-24-39)) 0%, rgb(var(--dk-15-23-42)) 100%)',
          border: '1px solid rgba(var(--tint-rgb), 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(16, 185, 129, 0.15)',
          color: 'var(--text-primary)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="row">
            <Trophy size={20} color="var(--c-green)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              {isEdit ? 'Edit Tournament' : ageGroupOf ? 'Add an age group' : 'Tournament Setup Wizard'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div className="form-row-2-1" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="tournamentformmodal-tournament-title" className="form-label">Tournament Title *</label>
              <input id="tournamentformmodal-tournament-title" className="form-input" type="text" required placeholder="e.g. Summer Intra-Club Cup" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="tournamentformmodal-season" className="form-label">Season</label>
              <input id="tournamentformmodal-season" className="form-input" type="text" value={season} onChange={e => setSeason(e.target.value)} />
            </div>
          </div>

          {/* Schedule */}
          <div className="form-grid" style={{ marginBottom: '0.4rem' }}>
            <div className="form-group">
              <label htmlFor="tournamentformmodal-starts-date-kick-off" className="form-label">Starts (date & kick-off) *</label>
              <input id="tournamentformmodal-starts-date-kick-off" className="form-input" type="datetime-local" required value={startAt} onChange={e => setStartAt(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="tournamentformmodal-ends" className="form-label">Ends</label>
              <input id="tournamentformmodal-ends" className="form-input" type="datetime-local" value={endAt} min={startAt} onChange={e => setEndAt(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="tournamentformmodal-venue" className="form-label">Venue</label>
              <input id="tournamentformmodal-venue" className="form-input" type="text" placeholder="e.g. Club Ground" value={venue} onChange={e => setVenue(e.target.value)} />
            </div>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Rounds are spread evenly from the start to the end date at the start kick-off time. Set the same day for a one-day cup.
            Each fixture&apos;s date & time can be changed afterwards from its match card.
          </p>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="tournamentformmodal-description" className="form-label">Description</label>
            <textarea id="tournamentformmodal-description" className="form-textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {hosted && (
            <div className="ht-form-block">
              <div className="ht-two">
                <div className="form-group">
                  <label htmlFor="tfm-age" className="form-label">Age group {ageGroupOf ? '*' : '(optional)'}</label>
                  <input id="tfm-age" className="form-input" type="text" maxLength={32} required={!!ageGroupOf} placeholder="e.g. Under 11s" value={ageGroup} onChange={e => setAgeGroup(e.target.value)} />
                </div>
                <label className="form-check" style={{ alignSelf: 'end', marginBottom: '0.6rem' }}>
                  <input type="checkbox" checked={isJunior} onChange={e => setIsJunior(e.target.checked)} />
                  Junior players: show first name and last initial on public pages
                </label>
              </div>

              <label className="form-check">
                <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />
                Give every game its own kick-off time and pitch
              </label>
              {timed && (
                <>
                  <div className="ht-three">
                    <div className="form-group">
                      <label htmlFor="tfm-slot" className="form-label">Minutes per game</label>
                      <input id="tfm-slot" className="form-input" type="number" inputMode="numeric" min={5} max={180} value={matchMinutes} onChange={e => setMatchMinutes(parseInt(e.target.value, 10) || 0)} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tfm-pitches" className="form-label">Pitches</label>
                      <input id="tfm-pitches" className="form-input" type="number" inputMode="numeric" min={1} max={20} value={pitches} onChange={e => setPitches(parseInt(e.target.value, 10) || 0)} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tfm-dayend" className="form-label">Last game ends by</label>
                      <input id="tfm-dayend" className="form-input" type="time" value={dayEnd} onChange={e => setDayEnd(e.target.value)} />
                    </div>
                  </div>
                  <p className="ht-hint">Count the game and the changeover, e.g. 2 x 10 minutes plus 5 = 25. Games that don&rsquo;t fit before the finish time carry on the next day from the start time.</p>
                  {preview && (
                    <p className={preview.overflow ? 'ht-error' : 'ht-ok'} role="status">
                      {preview.games} games over {preview.days} day{preview.days === 1 ? '' : 's'}, last game ends {preview.finish}.
                      {preview.overflow && ' That runs past the end date: add a pitch, shorten the games or move the end date.'}
                    </p>
                  )}
                </>
              )}

              <div className="ht-three">
                <div className="form-group">
                  <label htmlFor="tfm-fee" className="form-label">Entry fee per team ($)</label>
                  <input id="tfm-fee" className="form-input" type="number" inputMode="decimal" min={0} step="0.01" placeholder="None" value={entryFee} onChange={e => setEntryFee(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="tfm-deadline" className="form-label">Entries close</label>
                  <input id="tfm-deadline" className="form-input" type="datetime-local" max={startAt} value={deadline} onChange={e => setDeadline(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="tfm-squad" className="form-label">Most players per team</label>
                  <input id="tfm-squad" className="form-input" type="number" inputMode="numeric" min={1} max={60} placeholder="No limit" value={maxSquad} onChange={e => setMaxSquad(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="tfm-info" className="form-label">Info for teams</label>
                <textarea id="tfm-info" className="form-textarea" rows={3} maxLength={4000} placeholder="Parking, canteen, first aid, rules, what to bring" value={teamInfo} onChange={e => setTeamInfo(e.target.value)} style={{ resize: 'vertical' }} />
                <p className="ht-hint">Shown on every team&rsquo;s entry page and in the info pack email.</p>
              </div>
              {clubEvents.length > 0 && (
                <div className="form-group">
                  <label htmlFor="tfm-event" className="form-label">Part of a club event</label>
                  <select id="tfm-event" className="form-select" value={eventId} onChange={e => setEventId(e.target.value)}>
                    <option value="">Not linked</option>
                    {clubEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                  <p className="ht-hint">The event page links to the draw, and the event&rsquo;s sponsors show on the tournament page.</p>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <ImageUploadZone
              clubId={club.id}
              label="Tournament Cover Banner (16:9)"
              recommendedText="Wide 16:9 banner for bracket, spectator tiesheet, and matchday programs"
              currentImageUrl={bannerUrl}
              onUploadComplete={url => setBannerUrl(url)}
              folder="tournaments"
              aspectRatio="16:9"
            />
            <CoverPresetPicker value={bannerUrl} onPick={setBannerUrl} />
          </div>

          {/* Format */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="form-label" style={{ marginBottom: '0.5rem' }}>Tournament Format</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '0.65rem' }}>
              {[
                { id: 'knockout', label: 'Knockout Bracket', desc: 'Single elimination with optional 3rd place' },
                { id: 'group_knockout', label: 'Group Stage + KO', desc: 'World Cup / UCL: round-robin groups into knockout' },
                { id: 'league', label: 'Round-Robin League', desc: 'All-play-all points table & standings' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id as TournamentFormat)}
                  aria-pressed={format === f.id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '10px',
                    textAlign: 'left',
                    border: format === f.id ? '2px solid #10B981' : '1px solid rgba(var(--tint-rgb), 0.08)',
                    background: format === f.id ? 'rgba(16, 185, 129, 0.12)' : 'rgba(var(--shade-rgb), 0.35)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: format === f.id ? 'var(--c-green)' : 'var(--text-primary)' }}>{f.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '3px' }}>{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {format !== 'league' && (
            <div
              style={{
                background: 'rgba(var(--tint-rgb), 0.03)',
                border: '1px solid rgba(var(--tint-rgb), 0.08)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
                gap: '1rem',
              }}
            >
              {format === 'group_knockout' && (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="tournamentformmodal-groups" className="form-label">Groups</label>
                    <select id="tournamentformmodal-groups" className="form-select" value={groupCount} onChange={e => setGroupCount(parseInt(e.target.value, 10))}>
                      {[1, 2, 3, 4, 6, 8].map(n => (
                        <option key={n} value={n}>{n === 1 ? '1 Group (single pool)' : `${n} Groups (A–${'ABCDEFGH'[n - 1]})`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="tournamentformmodal-groupcount-1-teams-advancing-to-knockout" className="form-label">
                      {groupCount === 1 ? 'Teams advancing to knockout' : 'Teams advancing per group'}
                    </label>
                    <select id="tournamentformmodal-groupcount-1-teams-advancing-to-knockout" className="form-select" value={teamsAdvancing} onChange={e => setTeamsAdvancing(parseInt(e.target.value, 10))}>
                      {(groupCount === 1 ? [2, 3, 4, 8, 16] : [1, 2, 3, 4]).map(n => (
                        <option key={n} value={n}>{groupCount === 1 ? (n === 3 ? 'Top 3 (1st gets bye to Final)' : `Top ${n}`) : `Top ${n} per group`}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <label className="form-check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={hasThirdPlace} onChange={e => setHasThirdPlace(e.target.checked)} />
                Include 3rd Place Match
              </label>
              {format === 'group_knockout' && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    fontSize: '0.72rem',
                    color: 'var(--c-green)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                  }}
                >
                  {teamCount < 2 ? 'Select at least 2 teams.' : formatSummary}
                  {clamped && ` — adjusted to fit ${teamCount} teams.`}
                </div>
              )}
            </div>
          )}

          {/* Internal Teams */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div className="form-label">Internal Teams ({selectedInternalTeamIds.length} selected)</div>
              <span style={{ fontSize: '0.72rem', color: 'var(--c-green)' }}>From your club squads</span>
            </div>
            {clubInternalTeams.length === 0 ? (
              <div style={{ padding: '0.75rem', background: 'rgba(var(--tint-rgb), 0.03)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                No internal teams yet. Create them in{' '}
                {/* A plain link: on the Tournaments screen it switches tab (hashchange) and closes this form */}
                <a href={`/${club.slug}/admin/tournaments#tournament-sides`} style={{ color: 'var(--club-ink)', fontWeight: 700 }}>Tournaments &amp; Cups → Tournament Sides</a>, or add guest teams below.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: '0.5rem' }}>
                {clubInternalTeams.map(t => {
                  const isSelected = selectedInternalTeamIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(var(--tint-rgb), 0.03)',
                        border: isSelected ? '1px solid #10B981' : '1px solid rgba(var(--tint-rgb), 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelectedInternalTeamIds(prev => (prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]))}
                      />
                      <img loading="lazy" decoding="async" width={20} height={20} src={t.logo_url || DEFAULT_CREST} alt="" style={{ width: '20px', height: '20px' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guest Teams (optional) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="form-label" style={{ marginBottom: '0.4rem' }}>Guest Teams ({externalTeams.length}) — optional</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input aria-label="Guest club name"
                className="form-input"
                type="text"
                placeholder="Guest club name"
                value={newExternalName}
                onChange={e => setNewExternalName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddExternalTeam();
                  }
                }}
                style={{ flex: 2, minWidth: 0 }}
              />
              <input
                className="form-input"
                type="text"
                maxLength={4}
                placeholder="Code"
                aria-label="Short code"
                value={newExternalCode}
                onChange={e => setNewExternalCode(e.target.value.toUpperCase())}
                style={{ width: '80px', flexShrink: 0, padding: '0.5rem', textAlign: 'center' }}
              />
              <button type="button" onClick={handleAddExternalTeam} className="btn btn-secondary" style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}>
                Add
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {externalTeams.map((ext, idx) => (
                <span
                  key={`${ext.name}-${idx}`}
                  style={{
                    padding: '3px 8px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'var(--c-sky)',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  {ext.name} ({ext.short_name})
                  <button
                    type="button"
                    aria-label={`Remove ${ext.name}`}
                    onClick={() => setExternalTeams(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" style={{ display: 'flex', gap: '0.4rem', color: 'var(--c-red)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '0.65rem 1.25rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.5rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {isEdit ? <Save size={16} /> : <Sparkles size={16} />}
              <span>{isEdit ? 'Save Changes' : 'Generate Tiesheet & Launch'}</span>
            </button>
          </div>
        </form>
      </PopupPanel>
    </div>
  );
}
