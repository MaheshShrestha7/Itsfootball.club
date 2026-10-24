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
  Search, Plus, FileSpreadsheet, X, ChevronLeft, ChevronRight, Phone, Mail, Edit2, Activity, Trash2,
  MessageSquare, List, LayoutGrid, Clock, AlertTriangle, CheckCircle2,
} from 'lucide-react';

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

/** "ACTIVE to 14 Mar 2027", "EXPIRES IN 12 DAYS", ... with its colour */
function membershipLabel(info: MembershipInfo): [string, string] {
  switch (info.state) {
    case 'expiring': return [`EXPIRES IN ${plural(info.days ?? 0, 'DAY')}`, 'var(--c-amber)'];
    case 'expired': return [`EXPIRED ${fmtDate(info.expires).toUpperCase()}`, 'var(--c-red)'];
    case 'suspended': return ['SUSPENDED', 'var(--c-red)'];
    case 'pending': return ['TO REVIEW', 'var(--c-amber)'];
    case 'rejected': return ['REJECTED', 'var(--c-red)'];
    default: return [info.expires ? `ACTIVE to ${fmtDate(info.expires)}` : 'ACTIVE', 'var(--c-green)'];
  }
}

/** One season's totals (a member can have more than one row for it) */
function seasonTotals(rows: PlayerStats[]) {
  const sum = (k: keyof PlayerStats) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  return {
    appearances: sum('appearances'), minutes_played: sum('minutes_played'), goals: sum('goals'), assists: sum('assists'),
    clean_sheets: sum('clean_sheets'), yellow_cards: sum('yellow_cards'), red_cards: sum('red_cards'), motm_awards: sum('motm_awards'),
  };
}
type Totals = ReturnType<typeof seasonTotals>;

/** "7 apps · 5 goals" (at most three things), or '—' */
function seasonLine(t: Totals | null): string {
  if (!t || (!t.appearances && !t.goals && !t.assists && !t.clean_sheets)) return '—';
  const parts = [plural(t.appearances, 'app')];
  if (t.goals) parts.push(plural(t.goals, 'goal'));
  if (t.clean_sheets) parts.push(plural(t.clean_sheets, 'clean sheet'));
  if (t.assists) parts.push(plural(t.assists, 'assist'));
  return parts.slice(0, 3).join(' · ');
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
    return [names.join(', ') || 'No team', shirt].filter(Boolean).join(' · ');
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
  const filtered = people.filter(m => inGroup(group, m, isJunior(m), today) && passesFilters(m));
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
        .ppl-chips { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
        .ppl-chip { display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap; min-height: 40px; padding: 0 0.9rem; border-radius: 999px; border: 1px solid var(--border-medium); background: var(--bg-surface); color: var(--text-secondary); font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
        .ppl-chip[aria-pressed="true"] { background: var(--club-primary); border-color: var(--club-primary); color: var(--club-primary-contrast, #090D16); }
        .ppl-chip span { font-weight: 800; opacity: 0.75; }
        .ppl-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; align-items: start; }
        .ppl-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .ppl-table th { text-align: left; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); font-weight: 800; padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--border-subtle); }
        .ppl-table td { padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; color: var(--text-secondary); }
        .ppl-table tr.is-selected td { background: rgba(16, 185, 129, 0.10); }
        .ppl-table tbody tr:hover td { background: rgba(var(--tint-rgb), 0.04); }
        .ppl-name { display: flex; align-items: center; gap: 0.65rem; background: none; border: none; padding: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; min-height: 40px; }
        .ppl-name strong { color: var(--text-primary); font-weight: 800; display: block; }
        .ppl-sub { font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; display: block; }
        .ppl-pill { display: inline-block; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.03em; padding: 0.15rem 0.45rem; border-radius: 6px; border: 1px solid currentColor; white-space: nowrap; }
        .ppl-list { display: none; flex-direction: column; gap: 0.5rem; }
        .ppl-item { display: flex; align-items: center; gap: 0.75rem; width: 100%; min-height: 60px; padding: 0.6rem 0.8rem; border-radius: 14px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .ppl-item .ppl-sub { max-width: none; }
        .ppl-panel { background: var(--bg-surface); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); display: flex; flex-direction: column; }
        .ppl-tabs { display: flex; gap: 4px; background: rgba(0, 0, 0, 0.25); padding: 4px; border-radius: 12px; }
        .ppl-tabs button { flex: 1; min-height: 40px; border: none; border-radius: 9px; background: transparent; color: var(--text-secondary); font: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
        .ppl-tabs button[aria-selected="true"] { background: var(--club-primary); color: var(--club-primary-contrast, #090D16); font-weight: 800; }
        .ppl-card { background: rgba(var(--tint-rgb), 0.04); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.7rem 0.85rem; }
        .ppl-card-label { font-size: 0.72rem; color: var(--text-muted); font-weight: 700; }
        .ppl-card-value { font-weight: 800; color: var(--text-primary); margin-top: 2px; }
        .ppl-card-note { font-size: 0.8rem; color: var(--text-secondary); }
        .ppl-quick { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
        .ppl-quick > * { min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 0.75rem; font-weight: 700; border-radius: 12px; border: 1px solid var(--border-medium); background: var(--bg-surface-elevated); color: var(--text-primary); text-decoration: none; cursor: pointer; font-family: inherit; }
        .ppl-panel .ppl-table th, .ppl-panel .ppl-table td { padding: 0.5rem 0.45rem; }
        .ppl-backdrop { display: none; }
        .ppl-back { display: none; }
        .ppl-apps { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.6rem; }
        @media (min-width: 1500px) {
          .ppl-layout.has-panel { grid-template-columns: minmax(0, 1fr) 380px; }
          .ppl-panel { position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow: auto; }
        }
        @media (max-width: 1499px) {
          .ppl-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100%); z-index: 1000; overflow: auto; border-radius: 0; box-shadow: -10px 0 40px rgba(0, 0, 0, 0.45); }
          .ppl-backdrop { display: block; position: fixed; inset: 0; z-index: 999; background: rgba(0, 0, 0, 0.5); border: none; }
        }
        @media (max-width: 759px) {
          .ppl-table-wrap { display: none; }
          .ppl-list { display: flex; }
          .ppl-panel { width: 100%; border: none; }
          .ppl-back { display: inline-flex; }
          .ppl-close { display: none; }
          .ppl-desktop-only { display: none !important; }
          .ppl-apps, .ppl-apps-more { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="stat-value" style={{ margin: 0 }}>People</h1>
          <p className="text-body" style={{ margin: '0.25rem 0 0' }}>
            Everyone at the club in one place: players, juniors, supporters and staff. Tap someone to see their membership, teams and stats.
          </p>
        </div>
        <div className="row row-wrap" style={{ gap: '0.5rem' }}>
          <button type="button" onClick={actions.openBulk} className="btn btn-secondary row" style={{ gap: '0.45rem' }}>
            <FileSpreadsheet size={16} color="var(--c-green)" /> <span>Import / Export</span>
          </button>
          <button type="button" onClick={actions.openAdd} className="btn btn-primary row" style={{ gap: '0.45rem' }}>
            <Plus size={17} /> <span>Add person</span>
          </button>
        </div>
      </div>

      {tabBar}

      {/* Applications waiting */}
      {canMembers && pending.length > 0 && (
        <section aria-label="Applications waiting" className="glass-panel" style={{ padding: '0.9rem 1rem', marginBottom: '1rem', borderLeft: '4px solid var(--c-amber)' }}>
          <div className="row row-wrap" style={{ justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.7rem' }}>
            <strong className="row" style={{ gap: '0.45rem', color: 'var(--text-primary)' }}>
              <Clock size={16} color="var(--c-amber)" /> {plural(pending.length, 'application')} waiting
            </strong>
            <button type="button" data-view-ok onClick={() => onReviewApplication()} className="btn btn-secondary btn-sm">
              Review all
            </button>
          </div>
          <div className="ppl-apps">
            {pending.slice(0, 3).map(m => {
              const payment = signupPayments[m.id];
              const age = m.date_of_birth ? ageOn(m.date_of_birth, today) : null;
              const supporter = personRoles(m).some(r => r.toLowerCase() === 'supporter');
              const badge = payment === 'paid' ? ['PAID', 'var(--c-green)'] : payment === 'awaiting_review' ? ['RECEIPT TO CHECK', 'var(--c-amber)'] : null;
              return (
                <div key={m.id} data-application={m.full_name} className="ppl-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div className="row" style={{ gap: '0.5rem', justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</strong>
                    {badge && <span className="ppl-pill" style={{ color: badge[1] }}>{badge[0]}</span>}
                  </div>
                  <span className="ppl-card-note">
                    {[supporter ? 'Supporter' : 'Player', m.membership_tier, age !== null ? `age ${age}` : '', m.guardian_name ? `parent ${m.guardian_name}` : ''].filter(Boolean).join(' · ')}
                  </span>
                  {age !== null && age < 18 && !supporter && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--c-amber)' }}>Under 18: check their team when you approve</span>
                  )}
                  <button type="button" data-view-ok onClick={() => onReviewApplication(m.id)} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.2rem' }}>
                    Review
                  </button>
                </div>
              );
            })}
          </div>
          {pending.length > 3 && (
            <p className="ppl-apps-more" style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>and {pending.length - 3} more on the Applications tab.</p>
          )}
        </section>
      )}

      {/* Search and chips */}
      <div className="glass-panel" style={{ padding: '0.9rem 1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="row row-wrap" style={{ gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input data-view-ok type="search" aria-label="Search people" className="form-input" placeholder="Search name, email, parent, shirt number"
              value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: '2.1rem' }} />
          </div>
        </div>
        <div className="ppl-chips" role="group" aria-label="Show">
          {CHIPS.map(c => (
            <button key={c.id} type="button" data-view-ok className="ppl-chip" aria-pressed={group === c.id} onClick={() => setGroup(c.id)}>
              {c.label} <span>{countOf(c.id)}</span>
            </button>
          ))}
        </div>
        <div className="row row-wrap" style={{ gap: '0.6rem', alignItems: 'center' }}>
          {teams.length > 1 && (
            <select data-view-ok aria-label="Team" className="form-select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
              <option value="all">All teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="none">Not in a team</option>
            </select>
          )}
          <select data-view-ok aria-label="Membership" className="form-select" value={membershipFilter} onChange={e => setMembershipFilter(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
            <option value="any">Any membership</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring soon</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
          <select data-view-ok aria-label="Checks" className="form-select" value={checksFilter} onChange={e => setChecksFilter(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
            <option value="any">Any checks</option>
            <option value="needs">Something to check</option>
            <option value="safeguarding">Background check due</option>
            <option value="photo">Photo consent not asked</option>
            <option value="guardian">No parent contact</option>
            <option value="emergency">No emergency contact</option>
          </select>
          {filtersActive && (
            <button type="button" data-view-ok onClick={clearFilters} className="btn btn-secondary btn-sm row" style={{ gap: '0.3rem' }}>
              <X size={14} /> Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Showing <strong className="text-primary">{filtered.length}</strong> of {people.length}
          </span>
          <div role="group" aria-label="Layout" className="ppl-desktop-only" style={{ display: 'flex', background: 'rgba(var(--shade-rgb), 0.35)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '2px' }}>
            {([['table', List, 'Table'], ['cards', LayoutGrid, 'Cards']] as const).map(([mode, Icon, label]) => (
              <button key={mode} type="button" data-view-ok onClick={() => changeViewMode(mode)} aria-pressed={viewMode === mode} aria-label={label} title={label}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', minHeight: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  background: viewMode === mode ? 'var(--club-primary)' : 'transparent', color: viewMode === mode ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)' }}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`ppl-layout${selected ? ' has-panel' : ''}`}>
        <div style={{ minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {people.length === 0 ? 'No one here yet. Add people one by one, import a spreadsheet, or share your join link.' : 'No one matches. Try another search or clear the filters.'}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="ppl-table-wrap">
              <SquadRoster members={filtered} totalCount={people.length} viewMode="grid" getMemberRoles={actions.getMemberRoles}
                onStats={actions.openStats} onEdit={actions.openEdit} onDelete={actions.remove} />
            </div>
          ) : (
            <div className="glass-panel ppl-table-wrap" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="ppl-table">
                <thead>
                  <tr><th>Person</th><th>Role</th><th>{teams.length > 1 ? 'Team · #' : '#'}</th><th>Membership</th><th>{activeSeason}</th></tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const [label, color] = membershipLabel(membershipInfo(m, today));
                    const checks = checksOf(m);
                    return (
                      <tr key={m.id} data-person={m.full_name} className={m.id === selectedId ? 'is-selected' : undefined}>
                        <td>
                          <button type="button" data-view-ok className="ppl-name" onClick={() => select(m.id)} aria-label={`Open ${m.full_name}`}>
                            <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={36} />
                            <span style={{ minWidth: 0 }}>
                              <strong>
                                {m.full_name}
                                {checks.length > 0 && <AlertTriangle size={13} color={checks.some(c => c.urgent) ? 'var(--c-red)' : 'var(--c-amber)'} style={{ marginLeft: 6, verticalAlign: '-2px' }} aria-label={checks.map(c => c.text).join(', ')} />}
                              </strong>
                              <span className="ppl-sub">{isJunior(m) && m.guardian_email ? `Parent: ${m.guardian_email}` : m.email || m.phone || ''}</span>
                            </span>
                          </button>
                        </td>
                        <td>{roleLine(m, isJunior(m))}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{teamLine(m)}</td>
                        <td><span className="ppl-pill" style={{ color }}>{label}</span></td>
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
            <div className="ppl-list">
              {filtered.map(m => {
                const [label, color] = membershipLabel(membershipInfo(m, today));
                const short = label.startsWith('ACTIVE') ? 'ACTIVE' : label.replace(/^EXPIRES IN /, '').replace(/ DAYS?$/, (d) => d.trim() === 'DAY' ? ' DAY LEFT' : ' DAYS LEFT');
                return (
                  <button key={m.id} type="button" data-view-ok data-person-row={m.full_name} className="ppl-item" onClick={() => select(m.id)}>
                    <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={40} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{m.full_name}</strong>
                      <span className="ppl-sub">
                        {[teams.length > 1 ? teamRows(m).map(r => teamName(r.team_id)).filter(Boolean).join(', ') : '', m.jersey_number != null ? `#${m.jersey_number}` : '',
                          isJunior(m) && m.guardian_name ? `parent ${m.guardian_name}` : roleLine(m, false).split(', ').filter(r => r.toLowerCase() !== 'player').join(', ')].filter(Boolean).join(' · ') || m.email}
                      </span>
                    </span>
                    <span className="ppl-pill" style={{ color }}>{short}</span>
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
  const [label, color] = membershipLabel(info);
  const seasons = [...new Set(seasonRows.map(r => r.season || activeSeason))].sort((a, b) => b.localeCompare(a));
  const thisSeason = seasonRows.filter(r => inSeason(r.season, activeSeason, activeSeason));
  const totals = thisSeason.length ? seasonTotals(thisSeason) : null;
  const subline = [roleLine(m, junior), teamRows.map(r => r.name).join(', '), m.jersey_number != null ? `#${m.jersey_number}` : ''].filter(Boolean).join(' · ');
  const isApplication = m.membership_status === 'pending' || m.membership_status === 'rejected';

  const renewal = async () => {
    if (await sendRenewalEmail(club, m, setSending)) setSent(true);
  };
  const remove = async () => {
    if (await actions.remove(m.id, m.full_name)) onClose();
  };

  return (
    <aside className="ppl-panel" aria-label={m.full_name} data-person-panel={m.full_name}>
      <div style={{ padding: '1rem 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <button type="button" data-view-ok className="ppl-back row" onClick={onClose} style={{ gap: '0.2rem', alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--club-ink, var(--c-green))', fontWeight: 800, fontSize: '0.95rem', minHeight: 44, padding: 0, cursor: 'pointer', font: 'inherit' }}>
          <ChevronLeft size={18} /> People
        </button>
        <div className="row" style={{ gap: '0.8rem', alignItems: 'center' }}>
          <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)', outline: 'none' }}>{m.full_name}</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{subline || '—'}</div>
            <span className="ppl-pill" style={{ color, marginTop: 4 }}>{label}</span>
          </div>
          <button type="button" data-view-ok className="ppl-close touch-target" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        <div className="ppl-quick">
          {m.phone ? <a href={`tel:${m.phone.replace(/\s+/g, '')}`}><Phone size={17} color="var(--c-green)" /> Call</a>
            : junior && m.guardian_phone ? <a href={`tel:${m.guardian_phone.replace(/\s+/g, '')}`}><Phone size={17} color="var(--c-green)" /> Call parent</a>
              : <span style={{ opacity: 0.45, cursor: 'default' }}><Phone size={17} /> No phone</span>}
          {canInbox && m.user_id ? (
            <Link href={`/${clubSlug}/admin/inquiries?member=${m.id}`}><MessageSquare size={17} color="var(--c-green)" /> Message</Link>
          ) : (m.email || m.guardian_email) ? (
            <a href={`mailto:${junior && m.guardian_email ? m.guardian_email : m.email}`}><Mail size={17} color="var(--c-green)" /> Email</a>
          ) : <span style={{ opacity: 0.45, cursor: 'default' }}><Mail size={17} /> No email</span>}
          <button type="button" onClick={() => actions.openEdit(m)}><Edit2 size={17} color="var(--c-green)" /> Edit</button>
        </div>

        <div className="ppl-tabs" role="tablist" aria-label="Details">
          {(['overview', 'membership', 'teams', 'stats'] as const).map(t => (
            <button key={t} type="button" role="tab" data-view-ok aria-selected={tab === t} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
        {tab === 'overview' && (
          <>
            <div className="ppl-card">
              <div className="ppl-card-label">Membership</div>
              <div className="ppl-card-value" style={{ color }}>{label}</div>
              <div className="ppl-card-note">{m.membership_tier || 'No plan'}{m.fee_waived_at ? ' · fee waived' : ''}</div>
            </div>
            {(teamRows.length > 0 || m.player_position) && (
              <div className="ppl-card">
                <div className="ppl-card-label">Team</div>
                <div className="ppl-card-value">{[teamRows.map(r => r.name).join(', '), m.jersey_number != null ? `#${m.jersey_number}` : ''].filter(Boolean).join(' · ') || '—'}</div>
                {m.player_position && <div className="ppl-card-note">{[m.player_position, ...(m.secondary_positions || [])].join(', ')}</div>}
              </div>
            )}
            <div className="ppl-card">
              <div className="ppl-card-label">{activeSeason} season</div>
              <div className="ppl-card-value">{seasonLine(totals)}</div>
              {totals && <div className="ppl-card-note">{totals.minutes_played} minutes{totals.motm_awards ? ` · ${plural(totals.motm_awards, 'Player of the Match')}` : ''}</div>}
            </div>
            <div className="ppl-card">
              <div className="ppl-card-label">Contact &amp; checks</div>
              <div className="ppl-card-value" style={{ fontWeight: 700, wordBreak: 'break-word' }}>{[m.email, m.phone].filter(Boolean).join(' · ') || 'No contact details'}</div>
              {junior && <div className="ppl-card-note">Parent: {[m.guardian_name, m.guardian_email, m.guardian_phone].filter(Boolean).join(' · ') || 'not set'}</div>}
              {m.emergency_contact && <div className="ppl-card-note">Emergency contact: {m.emergency_contact}</div>}
              {junior && m.photo_consent != null && <div className="ppl-card-note">Photo consent: {m.photo_consent ? 'yes' : 'no'}</div>}
              {m.medical_notes && <div className="ppl-card-note">Medical: {m.medical_notes}</div>}
              {m.safeguarding_check_type && <div className="ppl-card-note">{m.safeguarding_check_type}{m.safeguarding_check_expiry_date ? ` to ${fmtDate(m.safeguarding_check_expiry_date)}` : ''}</div>}
              {checks.length > 0 ? checks.map(c => (
                <div key={c.kind} className="row" style={{ gap: '0.35rem', marginTop: 4, fontSize: '0.8rem', fontWeight: 700, color: c.urgent ? 'var(--c-red)' : 'var(--c-amber)' }}>
                  <AlertTriangle size={13} /> {c.text}
                </div>
              )) : (
                <div className="row" style={{ gap: '0.35rem', marginTop: 4, fontSize: '0.8rem', color: 'var(--c-green)' }}><CheckCircle2 size={13} /> Nothing to check</div>
              )}
            </div>
          </>
        )}

        {tab === 'membership' && (
          <>
            <div className="ppl-card">
              <div className="ppl-card-label">Status</div>
              <div className="ppl-card-value" style={{ color }}>{label}</div>
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
                        {sent ? '✓ Renewal email sent' : sending ? 'Sending…' : 'Send renewal email'}
                      </button>
                    )}
                    <button type="button" data-view-ok className="btn btn-secondary btn-sm row" style={{ gap: '0.25rem' }} onClick={() => onOpenPass(m.id)}>
                      Member pass <ChevronRight size={14} />
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
                <div className="ppl-card-note">{[r.team_role[0].toUpperCase() + r.team_role.slice(1), r.jersey_number != null ? `#${r.jersey_number}` : ''].filter(Boolean).join(' · ')}</div>
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
                <table className="ppl-table" style={{ fontSize: '0.8rem' }}>
                  <thead><tr><th>Season</th><th>Apps</th><th>Mins</th><th>Goals</th><th>Ast</th><th>CS</th><th>POTM</th></tr></thead>
                  <tbody>
                    {seasons.map(s => {
                      const t = seasonTotals(seasonRows.filter(r => (r.season || activeSeason) === s));
                      return (
                        <tr key={s}><td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{s}</td><td>{t.appearances}</td><td>{t.minutes_played}</td><td>{t.goals}</td><td>{t.assists}</td><td>{t.clean_sheets}</td><td>{t.motm_awards}</td></tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className="btn btn-secondary btn-sm row" style={{ gap: '0.35rem', alignSelf: 'flex-start' }} onClick={() => actions.openStats(m)}>
              <Activity size={14} /> Edit stats
            </button>
          </>
        )}

        <button type="button" data-needs-full onClick={remove} className="btn btn-sm row" style={{ gap: '0.35rem', marginTop: '0.75rem', alignSelf: 'flex-start', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'var(--c-red)' }}>
          <Trash2 size={14} /> Remove from club
        </button>
      </div>
    </aside>
  );
}
