'use client';

// The free tournament maker (/tools/tournament-maker): name the cup, pick a format, paste the teams and
// see the draw straight away. Publishing (signed in) creates a tournament-only club and its tournament
// (lib/public-tournaments.ts), then opens the organiser's screen at /tournaments/{slug}/manage.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shuffle, Link2, Lock, Trophy, Layers, Loader2 } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import TournamentBracketView from '@/components/tournament/TournamentBracketView';
import TournamentStandingsTable from '@/components/tournament/TournamentStandingsTable';
import { useClub, isClubSlugAvailable, validateClubSlug } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { GROUP_LETTERS, buildTiesheet, computeStandings, effectiveGroupRules, toDateTimeLocal } from '@/lib/tournament-engine';
import {
  MONTHLY_LIMIT, TEAM_SIZES, isCleanName, isEventClub, parseTeamNames, teamCode, tournamentManagePath,
} from '@/lib/public-tournaments';
import type { Tournament, TournamentFormat, TournamentParticipant } from '@/lib/supabase/types';

const DRAFT_KEY = 'itsfootball_tournament_draft_v1';
const MAX_TEAMS = 32;

const FORMATS: { key: TournamentFormat; label: string }[] = [
  { key: 'knockout', label: 'Knockout' },
  { key: 'league', label: 'League' },
  { key: 'group_knockout', label: 'Groups + knockout' },
];

interface Draft {
  name: string;
  slug: string;
  slugEdited: boolean;
  start: string; // datetime-local
  multiDay: boolean;
  end: string; // date (YYYY-MM-DD)
  venue: string;
  organiser: string;
  teamSize: string;
  about: string;
  format: TournamentFormat;
  groupCount: number;
  advancing: number;
  thirdPlace: boolean;
  teams: string;
  /** Publish once the visitor has signed in */
  pendingPublish?: boolean;
}

function nextSaturdayMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay()) + 7) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  return toDateTimeLocal(d.toISOString());
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

const EMPTY: Draft = {
  name: '', slug: '', slugEdited: false, start: '', multiDay: false, end: '', venue: '', organiser: '', teamSize: '6-a-side', about: '',
  format: 'group_knockout', groupCount: 2, advancing: 2, thirdPlace: false, teams: '',
};

function loadDraft(format?: TournamentFormat): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const saved: Draft = { ...EMPTY, ...JSON.parse(raw) };
      // A format page opens on its own format, unless a sign-in to publish is under way
      return format && !saved.pendingPublish ? { ...saved, format } : saved;
    }
  } catch {
    // no storage: start fresh
  }
  return { ...EMPTY, format: format || EMPTY.format, start: nextSaturdayMorning() };
}

interface Props {
  /** The format it opens on (the format landing pages, e.g. /tools/round-robin-fixture-generator) */
  defaultFormat?: TournamentFormat;
}

export default function TournamentMakerTool({ defaultFormat }: Props = {}) {
  const router = useRouter();
  const { clubs, createClub, createTournament } = useClub();
  const { user, isLoading: authLoading, assignClubRole } = useAuth();
  const [draft, setDraft] = useState<Draft>(() => (defaultFormat ? { ...EMPTY, format: defaultFormat } : EMPTY));
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<'table' | 'bracket'>('table');
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);

  // The draft lives in this browser until it's published
  useEffect(() => {
    setDraft(loadDraft(defaultFormat));
    setLoaded(true);
    // Once on mount: the default format is fixed for each page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage full or blocked: the draft just isn't kept
    }
  }, [draft, loaded]);

  const update = (patch: Partial<Draft>) => {
    setError(null);
    setDraft(d => {
      const next = { ...d, ...patch };
      if (patch.name !== undefined && !d.slugEdited) next.slug = slugify(patch.name);
      return next;
    });
  };

  const teamNames = useMemo(() => parseTeamNames(draft.teams).slice(0, MAX_TEAMS), [draft.teams]);
  const groupOptions = Math.max(1, Math.min(GROUP_LETTERS.length, Math.floor(teamNames.length / 2)));

  // The tournament as it would be published, and its draw
  const built = useMemo(() => {
    const start = draft.start ? new Date(draft.start) : null;
    const startIso = start && !isNaN(start.getTime()) ? start.toISOString() : new Date().toISOString();
    let endIso = startIso;
    if (draft.multiDay && draft.end && start) {
      const end = new Date(`${draft.end}T${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
      if (!isNaN(end.getTime()) && end >= start) endIso = end.toISOString();
    }
    const tournament: Tournament = {
      id: 'preview', club_id: 'preview', name: draft.name.trim() || 'Your tournament', slug: draft.slug,
      season: String((start && !isNaN(start.getTime()) ? start : new Date()).getFullYear()),
      format: draft.format, status: 'draft', points_win: 3, points_draw: 1, points_loss: 0,
      group_count: draft.groupCount, teams_advancing_per_group: draft.advancing,
      has_third_place_match: draft.format !== 'league' && draft.thirdPlace,
      start_date: startIso, end_date: endIso, venue: draft.venue.trim() || undefined, description: draft.about.trim() || undefined,
    };
    const participants: TournamentParticipant[] = teamNames.map((name, i) => ({
      id: `team-${i}`, tournament_id: 'preview', team_type: 'external', name, short_name: teamCode(name), logo_url: '',
    }));
    const sheet = buildTiesheet(tournament, participants);
    return { tournament: { ...tournament, ...sheet.tournamentUpdates }, participants: sheet.participants, matches: sheet.matches };
  }, [draft, teamNames]);

  const rules = effectiveGroupRules(built.tournament, teamNames.length);
  const showTable = draft.format !== 'knockout';
  const showBracket = draft.format !== 'league';
  const activePreview = !showTable ? 'bracket' : !showBracket ? 'table' : preview;

  /** Why it can't be published yet, or null */
  const problem = (): string | null => {
    if (draft.name.trim().length < 3) return 'Give the tournament a name (at least 3 characters).';
    if (teamNames.length < 2) return 'Add at least 2 teams, one per line.';
    if (draft.format === 'group_knockout' && teamNames.length < 4) return 'Groups + knockout needs at least 4 teams.';
    if (![draft.name, draft.organiser, draft.venue, draft.about, ...teamNames].every(isCleanName)) return 'Please remove offensive words from the names.';
    if (!draft.start) return 'Pick the date and kick-off time.';
    const slug = validateClubSlug(draft.slug, []);
    if (!slug.valid) return slug.error?.replace('Club slug', 'Your link') || 'Choose another link.';
    return null;
  };

  const publish = async () => {
    if (publishingRef.current) return;
    const issue = problem();
    if (issue) return setError(issue);
    if (!user) {
      setDraft(d => ({ ...d, pendingPublish: true }));
      setAuthOpen(true);
      return;
    }
    publishingRef.current = true;
    setPublishing(true);
    setError(null);
    try {
      const slug = validateClubSlug(draft.slug, clubs).cleanSlug;
      if (clubs.some(c => c.slug === slug || c.previous_slugs?.includes(slug)) || !(await isClubSlugAvailable(slug))) {
        setDraft(d => ({ ...d, pendingPublish: false }));
        return setError(`itsfootball.club/tournaments/${slug} is taken. Please choose another link.`);
      }
      const monthAgo = Date.now() - 30 * 86400000;
      const recent = clubs.filter(c => isEventClub(c) && c.owner_id === user.id && Date.parse(c.created_at || '') > monthAgo).length;
      if (recent >= MONTHLY_LIMIT) {
        setDraft(d => ({ ...d, pendingPublish: false }));
        return setError(`You can publish ${MONTHLY_LIMIT} tournaments in 30 days. Please try again later, or contact us if you need more.`);
      }

      const name = draft.name.trim().slice(0, 80);
      const club = createClub({
        name,
        slug,
        short_name: teamCode(name),
        owner_id: user.id,
        banner_url: '',
        config: { kind: 'event', organiser: draft.organiser.trim().slice(0, 80) || undefined, team_size: draft.teamSize || undefined },
      });
      assignClubRole(club.id, 'owner');
      const t = built.tournament;
      createTournament(
        {
          club_id: club.id, name, slug, season: t.season, format: t.format, status: 'draft',
          points_win: 3, points_draw: 1, points_loss: 0,
          group_count: draft.format === 'group_knockout' ? rules.groupCount : undefined,
          teams_advancing_per_group: draft.format === 'group_knockout' ? rules.advancing : undefined,
          has_third_place_match: t.has_third_place_match, start_date: t.start_date, end_date: t.end_date,
          venue: t.venue, description: t.description?.slice(0, 500),
        },
        teamNames.map(n => ({ team_type: 'external' as const, name: n, short_name: teamCode(n), logo_url: '' }))
      );
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // nothing to clear
      }
      router.push(tournamentManagePath(slug));
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  // Signed in from the publish button: carry on publishing
  useEffect(() => {
    if (loaded && user && !authLoading && draft.pendingPublish) void publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user, authLoading, draft.pendingPublish]);

  const shuffle = () => {
    const lines = parseTeamNames(draft.teams);
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    update({ teams: lines.join('\n') });
  };

  const standings = (letter?: string) =>
    computeStandings(built.matches.filter(m => !letter || m.tournament_group === `Group ${letter}`), built.participants, letter ? { group: letter } : undefined);

  return (
    <>
      <style>{'.tm-grid{grid-template-columns:minmax(0,0.85fr) minmax(0,1.15fr)}@media(max-width:900px){.tm-grid{grid-template-columns:1fr}}'}</style>
      <div className="lineup-tool tm-grid">
        <form className="lineup-tool-controls lineup-tool-glass" onSubmit={e => { e.preventDefault(); void publish(); }}>
          <h2 className="lineup-tool-section">Tournament</h2>
          <div className="form-group">
            <label className="form-label" htmlFor="tm-name">Name</label>
            <input id="tm-name" className="form-input" value={draft.name} maxLength={80} onChange={e => update({ name: e.target.value })} placeholder="e.g. Dashain Cup 2026" />
          </div>
          <div className="lineup-tool-row">
            <div className="form-group">
              <label className="form-label" htmlFor="tm-start">Date and kick-off</label>
              <input id="tm-start" type="datetime-local" className="form-input" value={draft.start} onChange={e => update({ start: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tm-days">How long</label>
              <select id="tm-days" className="form-select" value={draft.multiDay ? 'multi' : 'one'} onChange={e => update({ multiDay: e.target.value === 'multi' })}>
                <option value="one">One day</option>
                <option value="multi">Over several days or weeks</option>
              </select>
            </div>
          </div>
          {draft.multiDay && (
            <div className="form-group">
              <label className="form-label" htmlFor="tm-end">Last match day</label>
              <input id="tm-end" type="date" className="form-input" value={draft.end} min={draft.start.slice(0, 10)} onChange={e => update({ end: e.target.value })} />
            </div>
          )}
          <div className="lineup-tool-row">
            <div className="form-group">
              <label className="form-label" htmlFor="tm-venue">Venue</label>
              <input id="tm-venue" className="form-input" value={draft.venue} maxLength={120} onChange={e => update({ venue: e.target.value })} placeholder="e.g. Parramatta Park" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tm-size">Team size</label>
              <select id="tm-size" className="form-select" value={draft.teamSize} onChange={e => update({ teamSize: e.target.value })}>
                <option value="">Not shown</option>
                {TEAM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="tm-organiser">Organised by <span className="lineup-tool-optional">(optional)</span></label>
            <input id="tm-organiser" className="form-input" value={draft.organiser} maxLength={80} onChange={e => update({ organiser: e.target.value })} placeholder="e.g. Nepalese Community Sydney" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="tm-about">About <span className="lineup-tool-optional">(optional)</span></label>
            <textarea id="tm-about" className="form-input" rows={2} maxLength={500} value={draft.about} onChange={e => update({ about: e.target.value })} placeholder="Charity day raising money for..." style={{ resize: 'vertical' }} />
          </div>

          <h2 className="lineup-tool-section">Format</h2>
          <div className="lineup-tool-segment" role="radiogroup" aria-label="Format" style={{ marginBottom: '0.9rem' }}>
            {FORMATS.map(f => (
              <button key={f.key} type="button" role="radio" aria-checked={draft.format === f.key} className={draft.format === f.key ? 'is-active' : ''} onClick={() => update({ format: f.key })}>
                {f.label}
              </button>
            ))}
          </div>
          {draft.format === 'group_knockout' && (
            <div className="lineup-tool-row">
              <div className="form-group">
                <label className="form-label" htmlFor="tm-groups">Groups</label>
                <select id="tm-groups" className="form-select" value={Math.min(draft.groupCount, groupOptions)} onChange={e => update({ groupCount: Number(e.target.value) })}>
                  {Array.from({ length: groupOptions }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} group{n === 1 ? '' : 's'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="tm-adv">Through from each group</label>
                <select id="tm-adv" className="form-select" value={draft.advancing} onChange={e => update({ advancing: Number(e.target.value) })}>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>Top {n}</option>)}
                </select>
              </div>
            </div>
          )}
          {draft.format !== 'league' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              <input type="checkbox" checked={draft.thirdPlace} onChange={e => update({ thirdPlace: e.target.checked })} /> Play a 3rd place match
            </label>
          )}

          <h2 className="lineup-tool-section">Teams <span className="lineup-tool-optional">· {teamNames.length} team{teamNames.length === 1 ? '' : 's'}</span></h2>
          <div className="form-group">
            <label className="form-label" htmlFor="tm-teams">One team per line <span className="lineup-tool-optional">(up to {MAX_TEAMS})</span></label>
            <textarea id="tm-teams" className="form-input" rows={8} value={draft.teams} onChange={e => update({ teams: e.target.value })}
              placeholder={'Harris Park Gorkhas\nAuburn Himalayan FC\nRockdale Sherpas\nKogarah Yetis'} style={{ resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={shuffle} disabled={teamNames.length < 2}><Shuffle size={14} /> Shuffle the draw</button>

          <h2 className="lineup-tool-section">Publish</h2>
          <div className="form-group">
            <label className="form-label" htmlFor="tm-link">Your link</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>itsfootball.club/tournaments/</span>
              <input id="tm-link" className="form-input" value={draft.slug} maxLength={48} onChange={e => update({ slug: slugify(e.target.value), slugEdited: true })} placeholder="dashain-cup-2026" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', minWidth: 0 }} />
            </div>
          </div>
          {error && <div role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem' }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={publishing} style={{ width: '100%', minHeight: 48 }}>
            {publishing ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />} {publishing ? 'Publishing...' : user ? 'Publish & get my link' : 'Sign in & publish'}
          </button>
          <div className="lineup-tool-prompt">
            <Lock size={14} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
            Free, with no ads. You sign in once when you publish, so only you can enter scores. Your draft stays in this browser until then.
          </div>
        </form>

        <div className="lineup-tool-glass" style={{ padding: '1.25rem', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <h2 className="lineup-tool-section" style={{ margin: 0 }}>Preview of the draw</h2>
            {showTable && showBracket && (
              <div className="lineup-tool-segment" role="tablist" style={{ minWidth: '220px' }}>
                <button type="button" role="tab" aria-selected={activePreview === 'table'} className={activePreview === 'table' ? 'is-active' : ''} onClick={() => setPreview('table')}><Layers size={13} style={{ verticalAlign: '-2px' }} /> Groups</button>
                <button type="button" role="tab" aria-selected={activePreview === 'bracket'} className={activePreview === 'bracket' ? 'is-active' : ''} onClick={() => setPreview('bracket')}><Trophy size={13} style={{ verticalAlign: '-2px' }} /> Bracket</button>
              </div>
            )}
          </div>
          {teamNames.length < 2 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 1rem', lineHeight: 1.6 }}>
              Paste your teams on the left, one per line, and the groups, fixtures and bracket appear here.
            </p>
          ) : activePreview === 'table' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {draft.format === 'group_knockout'
                ? GROUP_LETTERS.slice(0, rules.groupCount).map(l => (
                  <TournamentStandingsTable key={l} standings={standings(l)} groupTitle={`Group ${l}`} advancingCount={rules.advancing} showForm={false} />
                ))
                : <TournamentStandingsTable standings={standings()} groupTitle="League table" advancingCount={0} showForm={false} />}
            </div>
          ) : (
            <TournamentBracketView matches={built.matches} isAdmin={false} />
          )}
          {teamNames.length >= 2 && (
            <p className="lineup-tool-hint">{built.matches.length} matches, worked out for you. Kick-off times can be changed after publishing.</p>
          )}
        </div>
      </div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode="signup" redirectTo="" />
    </>
  );
}
