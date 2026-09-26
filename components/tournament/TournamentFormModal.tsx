'use client';

import React, { useState } from 'react';
import { useClub } from '@/lib/club-context';
import { Club, Tournament, TournamentFormat, TournamentParticipant } from '@/lib/supabase/types';
import { Trophy, X, Sparkles, Save } from 'lucide-react';
import ImageUploadZone from '@/components/ImageUploadZone';
import CoverPresetPicker from '@/components/CoverPresetPicker';
import { DEFAULT_CREST } from '@/lib/crest';
import { COVER_PRESETS } from '@/lib/cover-presets';
import { defaultSeasonLabel } from '@/lib/season';
import { STAGE_TITLES, effectiveGroupRules, knockoutStageFor, toDateTimeLocal } from '@/lib/tournament-engine';

type ParticipantInput = Omit<TournamentParticipant, 'id' | 'tournament_id'>;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '0.88rem',
  colorScheme: 'dark',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' };

/** Create a tournament, or edit one when `tournament` is given */
export default function TournamentFormModal({
  club,
  tournament,
  onClose,
  onSaved,
}: {
  club: Club;
  tournament?: Tournament;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { internalTeams, tournamentParticipants, matches, createTournament, saveTournament, getActiveSeason } = useClub();
  const clubInternalTeams = internalTeams.filter(t => t.club_id === club.id);
  const existing = tournament ? tournamentParticipants.filter(p => p.tournament_id === tournament.id) : [];
  const isEdit = !!tournament;

  const startDefault = new Date();
  startDefault.setHours(15, 0, 0, 0);
  const [name, setName] = useState(tournament?.name ?? '');
  const [season, setSeason] = useState(tournament?.season ?? (getActiveSeason(club.id)?.name || defaultSeasonLabel()));
  const [format, setFormat] = useState<TournamentFormat>(tournament?.format ?? 'group_knockout');
  const [venue, setVenue] = useState(tournament?.venue ?? club.stadium_name ?? '');
  const [bannerUrl, setBannerUrl] = useState(tournament?.banner_url ?? COVER_PRESETS[0].url);
  const [startAt, setStartAt] = useState(toDateTimeLocal(tournament?.start_date ?? startDefault.toISOString()));
  const [endAt, setEndAt] = useState(
    toDateTimeLocal(tournament ? tournament.end_date : new Date(startDefault.getTime() + 30 * 86400000).toISOString())
  );
  const [description, setDescription] = useState(tournament?.description ?? '');
  const [groupCount, setGroupCount] = useState(tournament?.group_count ?? 2);
  const [teamsAdvancing, setTeamsAdvancing] = useState(tournament?.teams_advancing_per_group ?? 2);
  const [hasThirdPlace, setHasThirdPlace] = useState(tournament?.has_third_place_match ?? true);
  const [selectedInternalTeamIds, setSelectedInternalTeamIds] = useState<string[]>(
    isEdit
      ? existing.filter(p => p.team_type === 'internal' && p.internal_team_id).map(p => p.internal_team_id!)
      : clubInternalTeams.map(t => t.id)
  );
  const [externalTeams, setExternalTeams] = useState<{ name: string; short_name: string }[]>(
    existing.filter(p => p.team_type === 'external').map(p => ({ name: p.name, short_name: p.short_name }))
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
    setExternalTeams(prev => [...prev, { name: teamName, short_name: newExternalCode.trim() || teamName.slice(0, 3).toUpperCase() }]);
    setNewExternalName('');
    setNewExternalCode('');
  };

  const handleSubmit = (e: React.FormEvent) => {
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
        return team
          ? [{ team_type: 'internal' as const, internal_team_id: team.id, name: team.name, short_name: team.short_name, logo_url: team.logo_url || DEFAULT_CREST, color: team.color || '#10B981' }]
          : [];
      }),
      ...externalTeams.map(ext => ({ team_type: 'external' as const, name: ext.name, short_name: ext.short_name, logo_url: DEFAULT_CREST, color: '#2563EB' })),
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
    };

    if (!isEdit) {
      const slug = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      createTournament(
        { ...fields, club_id: club.id, slug: `${slug}-${Date.now().toString().slice(-4)}`, status: 'draft', points_win: 3, points_draw: 1, points_loss: 0 },
        participantInputs
      );
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
    if (structural && played && !confirm('Changing the format or teams regenerates all fixtures and clears recorded results. Continue?')) {
      return;
    }
    saveTournament(tournament.id, fields, structural ? participantInputs : undefined);
    onSaved(structural ? `✓ Saved "${fields.name}" and regenerated the tiesheet.` : `✓ Saved "${fields.name}".`);
  };

  const formatSummary =
    qualifiers < 2
      ? 'Needs more teams for a knockout stage.'
      : `${rules.groupCount === 1 ? 'Single group (round-robin)' : `${rules.groupCount} groups (round-robin)`} → top ${rules.advancing} per group (${qualifiers} teams) → ${STAGE_TITLES[knockoutStageFor(qualifiers)]}${qualifiers & (qualifiers - 1) ? ' (top seeds get byes)' : ''}`;
  const clamped = teamCount >= 2 && (rules.groupCount !== groupCount || rules.advancing !== teamsAdvancing);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 20, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #0F172A 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(16, 185, 129, 0.15)',
          color: '#FFFFFF',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={20} color="#10B981" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              {isEdit ? 'Edit Tournament' : 'Tournament Setup Wizard'}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: '2 1 260px' }}>
              <label htmlFor="tournamentformmodal-tournament-title" style={labelStyle}>Tournament Title *</label>
              <input id="tournamentformmodal-tournament-title" type="text" required placeholder="e.g. Summer Intra-Club Cup" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="tournamentformmodal-season" style={labelStyle}>Season</label>
              <input id="tournamentformmodal-season" type="text" value={season} onChange={e => setSeason(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Schedule */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem', marginBottom: '0.4rem' }}>
            <div>
              <label htmlFor="tournamentformmodal-starts-date-kick-off" style={labelStyle}>Starts (date & kick-off) *</label>
              <input id="tournamentformmodal-starts-date-kick-off" type="datetime-local" required value={startAt} onChange={e => setStartAt(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="tournamentformmodal-ends" style={labelStyle}>Ends</label>
              <input id="tournamentformmodal-ends" type="datetime-local" value={endAt} min={startAt} onChange={e => setEndAt(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="tournamentformmodal-venue" style={labelStyle}>Venue</label>
              <input id="tournamentformmodal-venue" type="text" placeholder="e.g. Club Ground" value={venue} onChange={e => setVenue(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Rounds are spread evenly from the start to the end date at the start kick-off time. Set the same day for a one-day cup.
            Each fixture&apos;s date & time can be changed afterwards from its match card.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="tournamentformmodal-description" style={labelStyle}>Description</label>
            <textarea id="tournamentformmodal-description" rows={2} value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <ImageUploadZone
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
            <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Tournament Format</label>
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
                    border: format === f.id ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: format === f.id ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 0, 0, 0.35)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: format === f.id ? '#10B981' : '#FFFFFF' }}>{f.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '3px' }}>{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {format !== 'league' && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
                  <div>
                    <label htmlFor="tournamentformmodal-groups" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Groups</label>
                    <select id="tournamentformmodal-groups" value={groupCount} onChange={e => setGroupCount(parseInt(e.target.value, 10))} style={{ ...inputStyle, padding: '0.5rem', marginTop: '3px' }}>
                      {[1, 2, 3, 4, 6, 8].map(n => (
                        <option key={n} value={n}>{n === 1 ? '1 Group (single pool)' : `${n} Groups (A–${'ABCDEFGH'[n - 1]})`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="tournamentformmodal-groupcount-1-teams-advancing-to-knockout" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {groupCount === 1 ? 'Teams advancing to knockout' : 'Teams advancing per group'}
                    </label>
                    <select id="tournamentformmodal-groupcount-1-teams-advancing-to-knockout" value={teamsAdvancing} onChange={e => setTeamsAdvancing(parseInt(e.target.value, 10))} style={{ ...inputStyle, padding: '0.5rem', marginTop: '3px' }}>
                      {(groupCount === 1 ? [2, 4, 8, 16] : [1, 2, 3, 4]).map(n => (
                        <option key={n} value={n}>{groupCount === 1 ? `Top ${n}` : `Top ${n} per group`}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', alignSelf: 'end', paddingBottom: '0.5rem' }}>
                <input type="checkbox" checked={hasThirdPlace} onChange={e => setHasThirdPlace(e.target.checked)} />
                Include 3rd Place Match
              </label>
              {format === 'group_knockout' && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    fontSize: '0.72rem',
                    color: '#10B981',
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
              <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Internal Teams ({selectedInternalTeamIds.length} selected)</label>
              <span style={{ fontSize: '0.72rem', color: '#10B981' }}>From your club squads</span>
            </div>
            {clubInternalTeams.length === 0 ? (
              <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                No internal teams yet. Create squads in the &quot;Internal Teams&quot; tab, or add guest teams below.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                {clubInternalTeams.map(t => {
                  const isSelected = selectedInternalTeamIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.08)',
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
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guest Teams (optional) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Guest Teams ({externalTeams.length}) — optional</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
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
                style={{ ...inputStyle, flex: 2, padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}
              />
              <input
                type="text"
                maxLength={4}
                placeholder="Code"
                aria-label="Short code"
                value={newExternalCode}
                onChange={e => setNewExternalCode(e.target.value.toUpperCase())}
                style={{ ...inputStyle, width: '70px', padding: '0.5rem', textAlign: 'center', fontSize: '0.82rem' }}
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
                    color: '#93C5FD',
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
                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              ⚠ {error}
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
      </div>
    </div>
  );
}
