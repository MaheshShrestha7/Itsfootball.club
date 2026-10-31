'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { clubTeamsOf, isJuniorMember } from '@/lib/teams';
import { defaultSeasonLabel } from '@/lib/season';
import { inSeason } from '@/lib/member-season-stats';
import { DATE_LOCALE } from '@/lib/dates';
import {
  ageOn, inGroup, isPlayerRole, matchesSearch, membershipInfo, personChecks, personRoles,
  type MembershipInfo, type PeopleGroup, type PersonCheck,
} from '@/lib/people';
import type { ClubMember, PlayerStats } from '@/lib/supabase/types';
import type { SquadActions } from './SquadWorkspace';
import PlayerAvatar from '@/components/PlayerAvatar';
import SquadRoster from '@/components/SquadRoster';
import { canSendRenewal, sendRenewalEmail } from './renewalEmail';
import {
  Search, Plus, FileSpreadsheet, X, ChevronLeft, Phone, Mail, Edit2, Activity, Trash2,
  MessageSquare, List, LayoutGrid, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useMemberHealth } from '@/lib/use-member-health';
import MedicalNote from '@/components/admin/MedicalNote';

const CHIPS: { id: PeopleGroup; label: string }[] = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'players', label: 'Players' },
  { id: 'juniors', label: 'Juniors' },
  { id: 'supporters', label: 'Supporters' },
  { id: 'staff', label: 'Staff' },
  { id: 'attention', label: 'Needs attention' },
];

const fmtDate = (d?: string | null) =>
  d ? new Date(d.slice(0, 10)).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

/** "Player, Treasurer" with each label capitalised; a junior's Player label reads "Junior player" */
const roleLine = (m: ClubMember, junior: boolean) =>
  personRoles(m).map(r => (junior && r.toLowerCase() === 'player' ? 'Junior player' : r[0].toUpperCase() + r.slice(1))).join(', ');

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Tone = 'ok' | 'warn' | 'danger';

/** "Active to 14 Mar 2027", "Expires in 12 days", ... with a short form for phones and its tone */
function membershipLabel(info: MembershipInfo): { text: string; short: string; tone: Tone } {
  switch (info.state) {
    case 'expiring': return { text: `Expires in ${plural(info.days ?? 0, 'day')}`, short: `${plural(info.days ?? 0, 'day')} left`, tone: 'warn' };
    case 'expired': return { text: `Expired ${fmtDate(info.expires)}`, short: 'Expired', tone: 'danger' };
    case 'suspended': return { text: 'Suspended', short: 'Suspended', tone: 'danger' };
    case 'pending': return { text: 'To review', short: 'To review', tone: 'warn' };
    case 'rejected': return { text: 'Rejected', short: 'Rejected', tone: 'danger' };
    default: return { text: info.expires ? `Active to ${fmtDate(info.expires)}` : 'Active', short: 'Active', tone: 'ok' };
  }
}

const Pill = ({ m }: { m: { text: string; tone: Tone } }) => <span className={`admin-pill is-${m.tone}`}>{m.text}</span>;

/** One season's totals (a member can have more than one row for it) */
function seasonTotals(rows: PlayerStats[]) {
  const sum = (k: keyof PlayerStats) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  return {
    appearances: sum('appearances'), minutes_played: sum('minutes_played'), goals: sum('goals'), assists: sum('assists'),
    clean_sheets: sum('clean_sheets'), yellow_cards: sum('yellow_cards'), red_cards: sum('red_cards'), motm_awards: sum('motm_awards'),
  };
}
type Totals = ReturnType<typeof seasonTotals>;

/** "7 apps, 5 goals" (at most three things), or '—' */
function seasonLine(t: Totals | null): string {
  if (!t || (!t.appearances && !t.goals && !t.assists && !t.clean_sheets)) return '—';
  const parts = [plural(t.appearances, 'app')];
  if (t.goals) parts.push(plural(t.goals, 'goal'));
  if (t.clean_sheets) parts.push(plural(t.clean_sheets, 'clean sheet'));
  if (t.assists) parts.push(plural(t.assists, 'assist'));
  return parts.slice(0, 3).join(', ');
}

type PeopleSort = 'surname' | 'first' | 'number' | 'games' | 'newest';
const surnameOf = (m: ClubMember) => (m.last_name?.trim() || m.full_name.trim().split(/\s+/).pop() || '').toLowerCase();
const byName = (a: ClubMember, b: ClubMember) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' });

/** The directory order: surname A–Z by default (ties by full name), or the order picked in Sort */
function comparePeople(a: ClubMember, b: ClubMember, sort: PeopleSort, games: (m: ClubMember) => number): number {
  switch (sort) {
    case 'first': return byName(a, b);
    case 'number': return (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || byName(a, b);
    case 'games': return games(b) - games(a) || byName(a, b);
    case 'newest': return (b.created_at || '').localeCompare(a.created_at || '') || byName(a, b);
    default: return surnameOf(a).localeCompare(surnameOf(b)) || byName(a, b);
  }
}

export default function PeopleDirectory({
  clubSlug,
  actions,
  onReviewApplication,
  onOpenPass,
  initialPersonId,
  onPersonChange,
  tabBar,
}: {
  clubSlug: string;
  /** The People page's tabs, shown under the heading */
  tabBar?: React.ReactNode;
  actions: SquadActions;
  /** Opens the Applications tab on this application (or the first one) */
  onReviewApplication: (memberId?: string) => void;
  /** Opens the Member Passes tab on this member's pass */
  onOpenPass: (memberId: string) => void;
  initialPersonId?: string | null;
  onPersonChange: (memberId: string | null) => void;
}) {
  const { clubs, selectClubBySlug, clubTeams, clubTeamMembers, playerStats, getActiveSeason } = useClub();
  const { can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const canMembers = can(club.id, 'members');
  const canInbox = can(club.id, 'inquiries');
  const today = useMemo(() => new Date(), []);

  const teams = clubTeamsOf(clubTeams, club.id);
  const activeSeason = getActiveSeason(club.id)?.name || defaultSeasonLabel();

  // Applications wait on their own tab; the directory is everyone else
  const all = actions.members;
  const pending = all.filter(m => m.membership_status === 'pending');
  const people = all.filter(m => m.membership_status !== 'pending' && m.membership_status !== 'rejected');

  const juniorIds = useMemo(() => new Set(people.filter(m => {
    const age = m.date_of_birth ? ageOn(m.date_of_birth, today) : null;
    return (age !== null && age < 18) || isJuniorMember(m, clubTeams, clubTeamMembers);
  }).map(m => m.id)), [people, clubTeams, clubTeamMembers, today]);
  const isJunior = (m: ClubMember) => juniorIds.has(m.id);

  const teamRows = (m: ClubMember) => clubTeamMembers.filter(r => r.member_id === m.id && r.is_active !== false);
  const teamName = (id: string) => teams.find(t => t.id === id)?.name;
  const teamLine = (m: ClubMember) => {
    const names = teamRows(m).map(r => teamName(r.team_id)).filter(Boolean) as string[];
    const shirt = m.jersey_number != null ? `#${m.jersey_number}` : '';
    if (teams.length <= 1) return shirt || '—';
    if (!names.length && !shirt) return isPlayerRole(m) ? 'No team' : '—';
    return [names.join(', ') || 'No team', shirt].filter(Boolean).join(', ');
  };
  const totalsFor = (m: ClubMember) => {
    const rows = playerStats.filter(s => s.member_id === m.id && inSeason(s.season, activeSeason, activeSeason));
    return rows.length ? seasonTotals(rows) : null;
  };

  // Sign-up payments, so an application says whether it is paid or has a receipt to check
  const [signupPayments, setSignupPayments] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!canMembers || !pending.length) return;
    getSupabaseClient()?.from('payments').select('member_id, status')
      .eq('club_id', club.id).eq('kind', 'membership_signup').in('status', ['paid', 'awaiting_review'])
      .then(({ data }) => {
        const rows = data || [];
        setSignupPayments(Object.fromEntries([...rows].sort((a, b) => (a.status === 'paid' ? 1 : 0) - (b.status === 'paid' ? 1 : 0)).map(p => [p.member_id, p.status])));
      });
  }, [club.id, canMembers, pending.length]);

  // Search, chips and filters
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<PeopleGroup>('everyone');
  const [teamFilter, setTeamFilter] = useState('all');
  const [membershipFilter, setMembershipFilter] = useState('any');
  const [checksFilter, setChecksFilter] = useState('any');
  const [sortBy, setSortBy] = useState<PeopleSort>('surname');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  useEffect(() => {
    try {
      if (localStorage.getItem('itsfootball_people_view') === 'cards') setViewMode('cards');
    } catch { /* storage unavailable: default table */ }
  }, []);
  const changeViewMode = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    try { localStorage.setItem('itsfootball_people_view', mode); } catch { /* not persisted */ }
  };

  const checksOf = (m: ClubMember) => personChecks(m, isJunior(m), today);
  const passesFilters = (m: ClubMember) => {
    if (!matchesSearch(m, query)) return false;
    if (teams.length > 1 && teamFilter !== 'all') {
      const ids = teamRows(m).map(r => r.team_id);
      if (teamFilter === 'none' ? ids.length > 0 : !ids.includes(teamFilter)) return false;
    }
    if (membershipFilter !== 'any' && membershipInfo(m, today).state !== membershipFilter) return false;
    if (checksFilter !== 'any') {
      const checks = checksOf(m);
      if (checksFilter === 'needs' ? !checks.length : !checks.some(c => c.kind === checksFilter)) return false;
    }
    return true;
  };
  const filtered = people.filter(m => inGroup(group, m, isJunior(m), today) && passesFilters(m))
    .sort((a, b) => comparePeople(a, b, sortBy, m => totalsFor(m)?.appearances ?? 0));
  const countOf = (g: PeopleGroup) => people.filter(m => inGroup(g, m, isJunior(m), today)).length;
  const filtersActive = query.trim() !== '' || teamFilter !== 'all' || membershipFilter !== 'any' || checksFilter !== 'any' || group !== 'everyone';
  const clearFilters = () => { setQuery(''); setGroup('everyone'); setTeamFilter('all'); setMembershipFilter('any'); setChecksFilter('any'); };

  // The person open in the side panel (kept in the URL as ?person=)
  const [selectedId, setSelectedId] = useState<string | null>(initialPersonId ?? null);
  const selected = selectedId ? all.find(m => m.id === selectedId) || null : null;
  const select = (id: string | null) => { setSelectedId(id); onPersonChange(id); };

  return (
    <div>
      <style>{`
        .ppl-filter { flex: 1 1 150px; min-width: 0; }
        @media (max-width: 599px) { .ppl-filter { flex-basis: 100%; } }
        .ppl-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-md); align-items: start; }
        .ppl-table tr.is-selected td { background: var(--color-accent-wash); }
        .ppl-name { display: flex; align-items: center; gap: var(--space-sm); min-height: 40px; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .ppl-name strong { display: block; color: var(--color-ink); font-weight: 600; }
        .ppl-name svg { margin-left: var(--space-2xs); vertical-align: -2px; }
        .ppl-sub { display: block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-xs); color: var(--color-muted); }
        .ppl-list { display: none; flex-direction: column; }
        .ppl-item { display: flex; align-items: center; gap: var(--space-sm); width: 100%; min-height: 60px; padding: var(--space-xs) var(--space-sm); border: 0; border-top: 1px solid var(--color-rule); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .ppl-item:first-child { border-top: 0; }
        .ppl-item .ppl-sub { max-width: none; }
        .ppl-panel { display: flex; flex-direction: column; background: var(--color-paper-2); border: 1px solid var(--color-rule); border-radius: var(--radius-card); }
        .ppl-panel h2 { margin: 0; font-size: var(--text-lg); font-weight: 600; color: var(--color-ink); outline: none; }
        .ppl-card { padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-rule); border-radius: var(--radius-control); background: var(--color-paper); }
        .ppl-card-label { font-size: var(--text-xs); color: var(--color-muted); }
        .ppl-card-value { margin-top: var(--space-3xs); font-weight: 600; color: var(--color-ink); overflow-wrap: anywhere; }
        .ppl-card-note { font-size: var(--text-sm); color: var(--color-ink-2); overflow-wrap: anywhere; }
        .ppl-card-check { display: flex; align-items: center; gap: var(--space-2xs); margin-top: var(--space-2xs); font-size: var(--text-sm); font-weight: 600; color: var(--color-warn); }
        .ppl-card-check.is-urgent { color: var(--color-danger); }
        .ppl-card-check.is-clear { color: var(--color-accent-ink); font-weight: 500; }
        .ppl-quick { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-xs); }
        .ppl-quick > * { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3xs); min-height: 52px; border: 1px solid var(--color-rule-strong); border-radius: var(--radius-control); background: var(--color-paper); color: var(--color-ink); font: inherit; font-size: var(--text-xs); font-weight: 600; text-decoration: none; cursor: pointer; }
        .ppl-quick > * svg { color: var(--color-accent-ink); }
        .ppl-quick > .is-off { color: var(--color-muted); cursor: default; }
        .ppl-quick > .is-off svg { color: var(--color-muted); }
        .ppl-panel .admin-tabs { margin-bottom: 0; }
        .ppl-backdrop { display: none; }
        .ppl-back { display: none; }
        .ppl-apps { list-style: none; margin: 0; padding: 0 var(--space-xs) var(--space-xs); }
        .ppl-apps li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-xs); border-top: 1px solid var(--color-rule); }
        .ppl-apps li:first-child { border-top: 0; }
        .ppl-apps strong { color: var(--color-ink); font-weight: 600; }
        .ppl-apps .ppl-sub { max-width: none; }
        .ppl-apps .ppl-warn { display: block; font-size: var(--text-xs); color: var(--color-warn); }
        .ppl-layout-switch { display: inline-flex; padding: var(--space-3xs); border: 1px solid var(--color-rule-strong); border-radius: var(--radius-control); }
        .ppl-layout-switch button { display: grid; place-items: center; min-width: 40px; min-height: max(32px, var(--control) - 6px); border: 0; border-radius: calc(var(--radius-control) - 2px); background: none; color: var(--color-muted); cursor: pointer; }
        .ppl-layout-switch button[aria-pressed="true"] { background: var(--color-accent-wash); color: var(--color-accent-ink); }
        @media (hover: hover) {
          .ppl-table tbody tr:hover td { background: var(--color-paper-3); }
          .ppl-item:hover { background: var(--color-paper-3); }
          .ppl-quick > a:hover, .ppl-quick > button:hover { border-color: var(--color-muted); }
        }
        @media (min-width: 1500px) {
          .ppl-layout.has-panel { grid-template-columns: minmax(0, 1fr) 380px; }
          .ppl-panel { position: sticky; top: calc(var(--admin-nav-h) + var(--space-md)); max-height: calc(100dvh - var(--admin-nav-h) - 2rem); overflow: auto; }
        }
        @media (max-width: 1499px) {
          .ppl-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100%); z-index: var(--z-modal); overflow: auto; border-radius: 0; box-shadow: var(--shadow-drawer); }
          .ppl-backdrop { display: block; position: fixed; inset: 0; z-index: calc(var(--z-modal) - 1); border: 0; background: var(--color-scrim); }
        }
        @media (max-width: 759px) {
          .ppl-table-wrap { display: none; }
          .ppl-list { display: flex; }
          .ppl-panel { width: 100%; border: 0; padding-top: env(safe-area-inset-top); }
          .ppl-back { display: inline-flex; }
          .ppl-close { display: none; }
          .ppl-desktop-only { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="admin-head">
        <div>
          <h1>People</h1>
          <p>
            Everyone at the club in one place: players, juniors, supporters and staff. Tap someone to see their membership, teams and stats.
          </p>
        </div>
        <div className="admin-head-actions">
          <button type="button" onClick={actions.openBulk} className="btn btn-secondary">
            <FileSpreadsheet size={16} aria-hidden="true" /> <span>Import or export</span>
          </button>
          <button type="button" onClick={actions.openAdd} className="btn btn-primary">
            <Plus size={17} aria-hidden="true" /> <span>Add person</span>
          </button>
        </div>
      </div>

      {tabBar}

      {/* Applications waiting */}
      {canMembers && pending.length > 0 && (
        <section aria-labelledby="ppl-apps-title" className="admin-panel" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="admin-panel-head">
            <h2 id="ppl-apps-title">{plural(pending.length, 'application')} waiting</h2>
            <button type="button" data-view-ok onClick={() => onReviewApplication()} className="btn btn-secondary btn-sm">Review all</button>
          </div>
          <ul className="ppl-apps">
            {pending.slice(0, 3).map(m => {
              const payment = signupPayments[m.id];
              const age = m.date_of_birth ? ageOn(m.date_of_birth, today) : null;
              const supporter = personRoles(m).some(r => r.toLowerCase() === 'supporter');
              return (
                <li key={m.id} data-application={m.full_name}>
                  <span style={{ minWidth: 0 }}>
                    <strong>{m.full_name}</strong>{' '}
                    {payment === 'paid' && <span className="admin-pill is-ok">Paid</span>}
                    {payment === 'awaiting_review' && <span className="admin-pill is-warn">Receipt to check</span>}
                    <span className="ppl-sub">
                      {[supporter ? 'Supporter' : 'Player', m.membership_tier, age !== null ? `age ${age}` : '', m.guardian_name ? `parent ${m.guardian_name}` : ''].filter(Boolean).join(', ')}
                    </span>
                    {age !== null && age < 18 && !supporter && <span className="ppl-warn">Under 18: check their team when you approve</span>}
                  </span>
                  <button type="button" data-view-ok onClick={() => onReviewApplication(m.id)} className="btn btn-primary btn-sm">Review</button>
                </li>
              );
            })}
          </ul>
          {pending.length > 3 && (
            <p className="admin-table-foot" style={{ padding: '0 var(--space-md) var(--space-md)', margin: 0 }}>and {pending.length - 3} more on the Applications tab.</p>
          )}
        </section>
      )}

      {/* Search and chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <div className="row row-wrap" style={{ gap: 'var(--space-sm)' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
            <Search size={15} color="var(--color-muted)" aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input data-view-ok type="search" aria-label="Search people" className="form-input" placeholder="Search name, email, parent, shirt number"
              value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: '2.1rem' }} />
          </div>
        </div>
        <div className="admin-chips" role="group" aria-label="Show">
          {CHIPS.map(c => (
            <button key={c.id} type="button" data-view-ok className="admin-chip" aria-pressed={group === c.id} onClick={() => setGroup(c.id)}>
              {c.label} <span className="num">{countOf(c.id)}</span>
            </button>
          ))}
        </div>
        <div className="row row-wrap" style={{ gap: '0.6rem', alignItems: 'center' }}>
          {teams.length > 1 && (
            <select data-view-ok aria-label="Team" className="form-select ppl-filter" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="all">All teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="none">Not in a team</option>
            </select>
          )}
          <select data-view-ok aria-label="Membership" className="form-select ppl-filter" value={membershipFilter} onChange={e => setMembershipFilter(e.target.value)}>
            <option value="any">Any membership</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring soon</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
          <select data-view-ok aria-label="Checks" className="form-select ppl-filter" value={checksFilter} onChange={e => setChecksFilter(e.target.value)}>
            <option value="any">Any checks</option>
            <option value="needs">Something to check</option>
            <option value="safeguarding">Background check due</option>
            <option value="photo">Photo consent not asked</option>
            <option value="guardian">No parent contact</option>
            <option value="emergency">No emergency contact</option>
          </select>
          <select data-view-ok aria-label="Sort" className="form-select ppl-filter" value={sortBy} onChange={e => setSortBy(e.target.value as PeopleSort)}>
            <option value="surname">Surname, A to Z</option>
            <option value="first">First name, A to Z</option>
            <option value="number">Shirt number</option>
            <option value="games">Most games this season</option>
            <option value="newest">Newest first</option>
          </select>
          {filtersActive && (
            <button type="button" data-view-ok onClick={clearFilters} className="btn btn-secondary btn-sm">
              <X size={14} aria-hidden="true" /> Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
            Showing <strong style={{ color: 'var(--color-ink)' }}>{filtered.length}</strong> of {people.length}
          </span>
          <div role="group" aria-label="Layout" className="ppl-desktop-only ppl-layout-switch">
            {([['table', List, 'Table'], ['cards', LayoutGrid, 'Cards']] as const).map(([mode, Icon, label]) => (
              <button key={mode} type="button" data-view-ok onClick={() => changeViewMode(mode)} aria-pressed={viewMode === mode} aria-label={label} title={label}>
                <Icon size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`ppl-layout${selected ? ' has-panel' : ''}`}>
        <div style={{ minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div className="admin-panel admin-empty" style={{ alignItems: 'center', textAlign: 'center' }}>
              {people.length === 0 ? 'No one here yet. Add people one by one, import a spreadsheet, or share your join link.' : 'No one matches. Try another search or clear the filters.'}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="ppl-table-wrap">
              <SquadRoster members={filtered} totalCount={people.length} viewMode="grid" getMemberRoles={actions.getMemberRoles}
                onStats={actions.openStats} onEdit={actions.openEdit} onDelete={actions.remove} />
            </div>
          ) : (
            <div className="admin-panel admin-table-wrap ppl-table-wrap">
              <table className="admin-table ppl-table">
                <thead>
                  <tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">{teams.length > 1 ? 'Team and number' : 'Number'}</th><th scope="col">Membership</th><th scope="col">{activeSeason}</th></tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const state = membershipLabel(membershipInfo(m, today));
                    const checks = checksOf(m);
                    return (
                      <tr key={m.id} data-person={m.full_name} className={m.id === selectedId ? 'is-selected' : undefined}>
                        <td>
                          <button type="button" data-view-ok className="ppl-name" onClick={() => select(m.id)} aria-label={`Open ${m.full_name}`}>
                            <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={32} />
                            <span style={{ minWidth: 0 }}>
                              <strong>
                                {m.full_name}
                                {checks.length > 0 && <AlertTriangle size={13} color={checks.some(c => c.urgent) ? 'var(--color-danger)' : 'var(--color-warn)'} aria-label={checks.map(c => c.text).join(', ')} />}
                              </strong>
                              <span className="ppl-sub">{isJunior(m) && m.guardian_email ? `Parent: ${m.guardian_email}` : m.email || m.phone || ''}</span>
                            </span>
                          </button>
                        </td>
                        <td>{roleLine(m, isJunior(m))}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{teamLine(m)}</td>
                        <td><Pill m={state} /></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{seasonLine(totalsFor(m))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Phones: one row per person */}
          {filtered.length > 0 && (
            <div className="admin-panel ppl-list">
              {filtered.map(m => {
                const state = membershipLabel(membershipInfo(m, today));
                return (
                  <button key={m.id} type="button" data-view-ok data-person-row={m.full_name} className="ppl-item" onClick={() => select(m.id)}>
                    <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={40} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ color: 'var(--color-ink)', fontWeight: 600, display: 'block' }}>{m.full_name}</strong>
                      <span className="ppl-sub">
                        {[teams.length > 1 ? teamRows(m).map(r => teamName(r.team_id)).filter(Boolean).join(', ') : '', m.jersey_number != null ? `#${m.jersey_number}` : '',
                          isJunior(m) && m.guardian_name ? `parent ${m.guardian_name}` : roleLine(m, false).split(', ').filter(r => r.toLowerCase() !== 'player').join(', ')].filter(Boolean).join(', ') || m.email}
                      </span>
                    </span>
                    <Pill m={{ text: state.short, tone: state.tone }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <>
            <button type="button" data-view-ok className="ppl-backdrop" aria-label="Close" onClick={() => select(null)} />
            <PersonPanel
              key={selected.id}
              member={selected}
              clubSlug={club.slug}
              club={club}
              junior={isJunior(selected)}
              checks={checksOf(selected)}
              teamRows={teamRows(selected).map(r => ({ ...r, name: teamName(r.team_id) || 'Team' }))}
              showTeams={teams.length > 1}
              seasonRows={playerStats.filter(s => s.member_id === selected.id)}
              activeSeason={activeSeason}
              canMembers={canMembers}
              canInbox={canInbox}
              actions={actions}
              onOpenPass={onOpenPass}
              onReview={onReviewApplication}
              onClose={() => select(null)}
            />
          </>
        )}
      </div>
    </div>
  );
}

type PanelTab = 'overview' | 'membership' | 'teams' | 'stats';

function PersonPanel({
  member: m, club, junior, checks, teamRows, showTeams, seasonRows, activeSeason, canMembers, canInbox, actions, onOpenPass, onReview, onClose, clubSlug,
}: {
  member: ClubMember;
  club: { id: string; name: string };
  clubSlug: string;
  junior: boolean;
  checks: PersonCheck[];
  teamRows: { team_id: string; name: string; team_role: string; jersey_number?: number }[];
  showTeams: boolean;
  seasonRows: PlayerStats[];
  activeSeason: string;
  canMembers: boolean;
  canInbox: boolean;
  actions: SquadActions;
  onOpenPass: (id: string) => void;
  onReview: (id?: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PanelTab>('overview');
  // Medical notes come only to those allowed to read them (Club Admins, the member's coaches)
  const health = useMemberHealth(club.id);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => {
    // Escape closes the panel, unless it is closing a dialog or the edit screens on top of it
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const info = membershipInfo(m);
  const state = membershipLabel(info);
  const seasons = [...new Set(seasonRows.map(r => r.season || activeSeason))].sort((a, b) => b.localeCompare(a));
  const thisSeason = seasonRows.filter(r => inSeason(r.season, activeSeason, activeSeason));
  const totals = thisSeason.length ? seasonTotals(thisSeason) : null;
  const subline = [roleLine(m, junior), teamRows.map(r => r.name).join(', '), m.jersey_number != null ? `#${m.jersey_number}` : ''].filter(Boolean).join(', ');
  const isApplication = m.membership_status === 'pending' || m.membership_status === 'rejected';

  const renewal = async () => {
    if (await sendRenewalEmail(club, m, setSending)) setSent(true);
  };
  const remove = async () => {
    if (await actions.remove(m.id, m.full_name)) onClose();
  };

  return (
    <aside className="ppl-panel" aria-label={m.full_name} data-person-panel={m.full_name}>
      <div style={{ padding: 'var(--space-md) var(--space-md) var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <button type="button" data-view-ok className="ppl-back admin-quiet-btn" onClick={onClose} style={{ alignSelf: 'flex-start', minHeight: 44 }}>
          <ChevronLeft size={18} aria-hidden="true" /> People
        </button>
        <div className="row" style={{ gap: '0.8rem', alignItems: 'center' }}>
          <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 ref={headingRef} tabIndex={-1}>{m.full_name}</h2>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', marginBottom: 'var(--space-2xs)' }}>{subline || '—'}</div>
            <Pill m={state} />
          </div>
          <button type="button" data-view-ok className="ppl-close admin-icon-btn" onClick={onClose} aria-label="Close" style={{ alignSelf: 'flex-start' }}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="ppl-quick">
          {m.phone ? <a href={`tel:${m.phone.replace(/\s+/g, '')}`}><Phone size={17} aria-hidden="true" /> Call</a>
            : junior && m.guardian_phone ? <a href={`tel:${m.guardian_phone.replace(/\s+/g, '')}`}><Phone size={17} aria-hidden="true" /> Call parent</a>
              : <span className="is-off"><Phone size={17} aria-hidden="true" /> No phone</span>}
          {canInbox && m.user_id ? (
            <Link href={`/${clubSlug}/admin/inquiries?member=${m.id}`}><MessageSquare size={17} aria-hidden="true" /> Message</Link>
          ) : (m.email || m.guardian_email) ? (
            <a href={`mailto:${junior && m.guardian_email ? m.guardian_email : m.email}`}><Mail size={17} aria-hidden="true" /> Email</a>
          ) : <span className="is-off"><Mail size={17} aria-hidden="true" /> No email</span>}
          <button type="button" onClick={() => actions.openEdit(m)}><Edit2 size={17} aria-hidden="true" /> Edit</button>
        </div>

        <div className="admin-tabs" role="tablist" aria-label="Details">
          {(['overview', 'membership', 'teams', 'stats'] as const).map(t => (
            <button key={t} type="button" role="tab" className="admin-tab" data-view-ok aria-selected={tab === t} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" style={{ padding: '0 var(--space-md) var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', fontSize: 'var(--text-sm)' }}>
        {tab === 'overview' && (
          <>
            <div className="ppl-card">
              <div className="ppl-card-label">Membership</div>
              <div className="ppl-card-value"><Pill m={state} /></div>
              <div className="ppl-card-note">{m.membership_tier || 'No plan'}{m.fee_waived_at ? ', fee waived' : ''}</div>
            </div>
            {(teamRows.length > 0 || m.player_position) && (
              <div className="ppl-card">
                <div className="ppl-card-label">Team</div>
                <div className="ppl-card-value">{[teamRows.map(r => r.name).join(', '), m.jersey_number != null ? `#${m.jersey_number}` : ''].filter(Boolean).join(', ') || '—'}</div>
                {m.player_position && <div className="ppl-card-note">{[m.player_position, ...(m.secondary_positions || [])].join(', ')}</div>}
              </div>
            )}
            <div className="ppl-card">
              <div className="ppl-card-label">{activeSeason} season</div>
              <div className="ppl-card-value">{seasonLine(totals)}</div>
              {totals && <div className="ppl-card-note">{totals.minutes_played} minutes{totals.motm_awards ? `, ${plural(totals.motm_awards, 'Player of the Match')}` : ''}</div>}
            </div>
            <div className="ppl-card">
              <div className="ppl-card-label">Contact &amp; checks</div>
              <div className="ppl-card-value">{[m.email, m.phone].filter(Boolean).join(', ') || 'No contact details'}</div>
              {junior && <div className="ppl-card-note">Parent: {[m.guardian_name, m.guardian_email, m.guardian_phone].filter(Boolean).join(', ') || 'not set'}</div>}
              {m.emergency_contact && <div className="ppl-card-note">Emergency contact: {m.emergency_contact}</div>}
              {junior && m.photo_consent != null && <div className="ppl-card-note">Photo consent: {m.photo_consent ? 'yes' : 'no'}</div>}
              <MedicalNote text={health.notes[m.id]} />
              {m.safeguarding_check_type && <div className="ppl-card-note">{m.safeguarding_check_type}{m.safeguarding_check_expiry_date ? ` to ${fmtDate(m.safeguarding_check_expiry_date)}` : ''}</div>}
              {checks.length > 0 ? checks.map(c => (
                <div key={c.kind} className={c.urgent ? 'ppl-card-check is-urgent' : 'ppl-card-check'}>
                  <AlertTriangle size={13} aria-hidden="true" /> {c.text}
                </div>
              )) : (
                <div className="ppl-card-check is-clear"><CheckCircle2 size={13} aria-hidden="true" /> Nothing to check</div>
              )}
            </div>
          </>
        )}

        {tab === 'membership' && (
          <>
            <div className="ppl-card">
              <div className="ppl-card-label">Status</div>
              <div className="ppl-card-value"><Pill m={state} /></div>
              <div className="ppl-card-note">{m.membership_tier || 'No plan'}</div>
            </div>
            <div className="ppl-card">
              <div className="ppl-card-label">Dates</div>
              <div className="ppl-card-note">Member since {fmtDate(m.membership_starts_at || m.reviewed_at || m.applied_at || m.created_at)}</div>
              <div className="ppl-card-note">{info.expires ? `Renews ${fmtDate(info.expires)}` : 'No end date'}</div>
              {m.reviewed_by && <div className="ppl-card-note">Approved by {m.reviewed_by}</div>}
            </div>
            {m.fee_waived_at && (
              <div className="ppl-card">
                <div className="ppl-card-label">Fee waived</div>
                <div className="ppl-card-note">{fmtDate(m.fee_waived_at)}{m.fee_waived_by ? ` by ${m.fee_waived_by}` : ''}{m.fee_waiver_reason ? `: ${m.fee_waiver_reason}` : ''}</div>
              </div>
            )}
            {canMembers && (
              <div className="row row-wrap" style={{ gap: '0.5rem', marginTop: '0.25rem' }}>
                {isApplication ? (
                  <button type="button" data-view-ok className="btn btn-primary btn-sm" onClick={() => onReview(m.id)}>Open application</button>
                ) : (
                  <>
                    {canSendRenewal(m) && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={renewal} disabled={sending || sent}>
                        {sent ? 'Renewal email sent' : sending ? 'Sending…' : 'Send renewal email'}
                      </button>
                    )}
                    <button type="button" data-view-ok className="btn btn-secondary btn-sm" onClick={() => onOpenPass(m.id)}>
                      Open member pass
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'teams' && (
          <>
            {teamRows.length === 0 ? (
              <div className="ppl-card ppl-card-note">{showTeams ? 'Not in a team yet.' : 'Your club has one team, so everyone plays for it.'}</div>
            ) : teamRows.map(r => (
              <div key={r.team_id} className="ppl-card">
                <div className="ppl-card-value">{r.name}</div>
                <div className="ppl-card-note">{[r.team_role[0].toUpperCase() + r.team_role.slice(1), r.jersey_number != null ? `#${r.jersey_number}` : ''].filter(Boolean).join(', ')}</div>
              </div>
            ))}
            <Link href={`/${clubSlug}/admin/teams`} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>Manage teams</Link>
          </>
        )}

        {tab === 'stats' && (
          <>
            {seasons.length === 0 ? (
              <div className="ppl-card ppl-card-note">No stats yet. They fill in when match stats are saved.</div>
            ) : (
              <div className="ppl-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="admin-table" style={{ fontSize: 'var(--text-xs)' }}>
                  <thead><tr><th scope="col">Season</th><th scope="col" className="is-num">Apps</th><th scope="col" className="is-num">Mins</th><th scope="col" className="is-num">Goals</th><th scope="col" className="is-num" title="Assists">Ast</th><th scope="col" className="is-num" title="Clean sheets">CS</th><th scope="col" className="is-num" title="Player of the Match">POTM</th></tr></thead>
                  <tbody>
                    {seasons.map(s => {
                      const t = seasonTotals(seasonRows.filter(r => (r.season || activeSeason) === s));
                      return (
                        <tr key={s}><td className="is-strong">{s}</td><td className="is-num">{t.appearances}</td><td className="is-num">{t.minutes_played}</td><td className="is-num">{t.goals}</td><td className="is-num">{t.assists}</td><td className="is-num">{t.clean_sheets}</td><td className="is-num">{t.motm_awards}</td></tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => actions.openStats(m)}>
              <Activity size={14} aria-hidden="true" /> Edit stats
            </button>
          </>
        )}

        <button type="button" data-needs-full onClick={remove} className="btn btn-danger btn-sm" style={{ marginTop: 'var(--space-sm)', alignSelf: 'flex-start' }}>
          <Trash2 size={14} aria-hidden="true" /> Remove from club
        </button>
      </div>
    </aside>
  );
}
