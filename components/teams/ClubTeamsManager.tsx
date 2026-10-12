'use client';

import React, { useMemo, useState } from 'react';
import { useClub } from '@/lib/club-context';
import type { ClubMember, ClubTeam, ClubTeamFormat, ClubTeamGender, ClubTeamRole, ClubTeamType } from '@/lib/supabase/types';
import {
  AGE_GROUPS, STAFF_ROLES, TEAM_FORMATS, TEAM_GENDERS, TEAM_ROLE_LABELS, TEAM_TYPES,
  ageGroupAge, clubTeamsOf, suggestedFormat, teamMemberIds, uniqueTeamSlug,
} from '@/lib/teams';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import { confirmAction } from '@/components/ConfirmDialog';
import PlayerAvatar from '@/components/PlayerAvatar';
import { Plus, Edit2, Trash2, Users, Star, X, Search, Baby, EyeOff } from 'lucide-react';

const COLOR_PRESETS = ['#10B981', '#2563EB', '#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4', '#334155'];

interface TeamForm {
  name: string;
  short_name: string;
  team_type: ClubTeamType;
  age_group: string;
  gender: ClubTeamGender;
  match_format: ClubTeamFormat;
  is_junior: boolean;
  hide_public_scores: boolean;
  color: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM: TeamForm = {
  name: '',
  short_name: '',
  team_type: 'reserve',
  age_group: '',
  gender: 'mixed',
  match_format: '11v11',
  is_junior: false,
  hide_public_scores: false,
  color: '#10B981',
  description: '',
  sort_order: 100,
  is_active: true,
};

function formFor(team: ClubTeam): TeamForm {
  return {
    name: team.name,
    short_name: team.short_name || '',
    team_type: team.team_type,
    age_group: team.age_group || '',
    gender: team.gender,
    match_format: team.match_format,
    is_junior: team.is_junior,
    hide_public_scores: team.hide_public_scores,
    color: team.color || '#10B981',
    description: team.description || '',
    sort_order: team.sort_order,
    is_active: team.is_active,
  };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEscapeToClose(true, () => onClose());
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel" role="dialog" aria-label={title} style={{ width: '100%', maxWidth: 'min(640px, calc(100vw - 2rem))', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
          <button data-view-ok type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ClubTeamsManager({ clubSlug }: { clubSlug: string }) {
  const {
    clubs, selectClubBySlug, members, clubTeams, clubTeamMembers,
    createClubTeam, updateClubTeam, setDefaultClubTeam, deleteClubTeam, setClubTeamRoster,
  } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const teams = useMemo(() => clubTeamsOf(clubTeams, club.id, { includeInactive: true }), [clubTeams, club.id]);
  const clubMembers = useMemo(
    () => members
      .filter(m => m.club_id === club.id && (m.membership_status || 'approved') === 'approved')
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [members, club.id]
  );
  const memberById = useMemo(() => new Map(clubMembers.map(m => [m.id, m])), [clubMembers]);

  const [feedback, setFeedback] = useState<string | null>(null);
  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // ---- Team details ----
  const [editing, setEditing] = useState<ClubTeam | 'new' | null>(null);
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };
  const openEdit = (team: ClubTeam) => {
    setForm(formFor(team));
    setEditing(team);
  };

  // Picking an age group fills in the usual settings for it; the admin can still change each one
  const pickAgeGroup = (ageGroup: string) => {
    const age = ageGroupAge(ageGroup);
    setForm(f => ({
      ...f,
      age_group: ageGroup,
      match_format: suggestedFormat(ageGroup),
      is_junior: age !== null && age <= 18,
      hide_public_scores: age !== null && age <= 11,
      team_type: age !== null && (f.team_type === 'senior' || f.team_type === 'reserve') ? 'youth' : f.team_type,
    }));
  };

  const saveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.replace(/[<>]/g, '').trim();
    if (!name) return;
    const fields = {
      name,
      short_name: form.short_name.replace(/[<>]/g, '').trim().slice(0, 32) || undefined,
      team_type: form.team_type,
      age_group: form.age_group || undefined,
      gender: form.gender,
      match_format: form.match_format,
      is_junior: form.is_junior,
      hide_public_scores: form.hide_public_scores,
      color: form.color || undefined,
      description: form.description.replace(/[<>]/g, '').trim() || undefined,
      sort_order: Number.isFinite(form.sort_order) ? Math.round(form.sort_order) : 100,
    };
    if (editing === 'new') {
      createClubTeam({
        ...fields,
        club_id: club.id,
        slug: uniqueTeamSlug(name, teams),
        is_default: false,
        is_active: form.is_active,
      });
      flash(`Created ${name}`);
    } else if (editing) {
      updateClubTeam(editing.id, {
        ...fields,
        slug: name === editing.name ? editing.slug : uniqueTeamSlug(name, teams, editing.id),
        // The main team always stays active
        is_active: editing.is_default ? true : form.is_active,
      });
      flash(`Saved ${name}`);
    }
    setEditing(null);
  };

  const removeTeam = async (team: ClubTeam) => {
    const ok = await confirmAction({
      title: `Delete "${team.name}"?`,
      message: 'Its squad list is removed. Its fixtures are kept but no longer belong to a team.',
      confirmLabel: 'Delete team',
      danger: true,
    });
    if (!ok) return;
    deleteClubTeam(team.id);
    flash(`Deleted ${team.name}`);
  };

  const makeMain = async (team: ClubTeam) => {
    const ok = await confirmAction({
      title: `Make "${team.name}" the main team?`,
      message: 'New fixtures and newly approved players go to the main team unless you pick another one.',
      confirmLabel: 'Make main team',
    });
    if (!ok) return;
    setDefaultClubTeam(team.id);
    flash(`${team.name} is now the main team`);
  };

  // ---- Squad and staff ----
  const [rosterTeam, setRosterTeam] = useState<ClubTeam | null>(null);
  const [rosterPlayers, setRosterPlayers] = useState<string[]>([]);
  const [rosterStaff, setRosterStaff] = useState<{ member_id: string; team_role: ClubTeamRole }[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<ClubTeamRole>('coach');

  const openRoster = (team: ClubTeam) => {
    setRosterTeam(team);
    setRosterPlayers(teamMemberIds(clubTeamMembers, team.id, 'player'));
    setRosterStaff(
      clubTeamMembers
        .filter(r => r.team_id === team.id && r.team_role !== 'player' && r.is_active !== false)
        .map(r => ({ member_id: r.member_id, team_role: r.team_role }))
    );
    setRosterSearch('');
    setNewStaffId('');
    setNewStaffRole('coach');
  };

  const togglePlayer = (id: string) =>
    setRosterPlayers(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const addStaff = () => {
    if (!newStaffId) return;
    setRosterStaff(prev =>
      prev.some(s => s.member_id === newStaffId && s.team_role === newStaffRole)
        ? prev
        : [...prev, { member_id: newStaffId, team_role: newStaffRole }]
    );
    setNewStaffId('');
  };

  const saveRoster = () => {
    if (!rosterTeam) return;
    setClubTeamRoster(rosterTeam.id, 'player', rosterPlayers);
    for (const role of STAFF_ROLES) {
      setClubTeamRoster(rosterTeam.id, role, rosterStaff.filter(s => s.team_role === role).map(s => s.member_id));
    }
    flash(`Saved the ${rosterTeam.name} squad`);
    setRosterTeam(null);
  };

  const filteredMembers = clubMembers.filter(m => m.full_name.toLowerCase().includes(rosterSearch.trim().toLowerCase()));
  const isPlayerLike = (m: ClubMember) => /player/i.test(m.role || '') || (m.roles || []).some(r => /player/i.test(r));

  return (
    <div>
      <div className="row row-wrap" style={{ justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Club Teams</h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Your first team, reserves, academy and youth age groups. Each team has its own squad, staff and fixtures.
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} />
          <span>Add Team</span>
        </button>
      </div>

      {feedback && (
        <div role="status" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: 'var(--c-green)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontWeight: 700, fontSize: '0.85rem' }}>
          {feedback}
        </div>
      )}

      {teams.length === 0 ? (
        <div className="glass-panel text-center" style={{ padding: '3rem 1.5rem' }}>
          <Users size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
          <p className="text-body" style={{ margin: 0 }}>No teams yet. Your main team appears here once the club has loaded.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1.25rem' }}>
          {teams.map(team => {
            const players = teamMemberIds(clubTeamMembers, team.id, 'player').filter(id => memberById.has(id));
            const staff = clubTeamMembers.filter(r => r.team_id === team.id && r.team_role !== 'player' && r.is_active !== false && memberById.has(r.member_id));
            const typeLabel = TEAM_TYPES.find(t => t.value === team.team_type)?.label || team.team_type;
            return (
              <div key={team.id} className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: team.is_active ? 1 : 0.65 }}>
                <div style={{ height: '4px', background: team.color || club.primary_color }} />
                <div style={{ padding: '1.1rem 1.25rem', flex: 1 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div className="min-w-0">
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{team.name}</h3>
                      <div className="text-meta" style={{ marginTop: '0.2rem' }}>
                        {typeLabel}
                        {team.age_group ? ` · ${team.age_group}` : ''}
                        {` · ${TEAM_GENDERS.find(g => g.value === team.gender)?.label || team.gender}`}
                        {` · ${team.match_format}`}
                      </div>
                    </div>
                    <div className="row row-tight shrink-0">
                      <button onClick={() => openEdit(team)} className="btn btn-secondary btn-sm" title="Edit team" aria-label={`Edit ${team.name}`}>
                        <Edit2 size={13} />
                      </button>
                      {!team.is_default && (
                        <button data-needs-full onClick={() => removeTeam(team)} className="btn btn-secondary btn-sm" title="Delete team" aria-label={`Delete ${team.name}`} style={{ color: 'var(--c-red)' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="row row-wrap row-tight" style={{ marginTop: '0.75rem' }}>
                    {team.is_default && (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber, #F59E0B)' }}>
                        <Star size={11} style={{ marginRight: 3 }} />Main team
                      </span>
                    )}
                    {team.is_junior && (
                      <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }}>
                        <Baby size={11} style={{ marginRight: 3 }} />Junior
                      </span>
                    )}
                    {team.hide_public_scores && (
                      <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)' }}>
                        <EyeOff size={11} style={{ marginRight: 3 }} />Scores hidden
                      </span>
                    )}
                    {!team.is_active && <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)' }}>Inactive</span>}
                  </div>

                  <div className="text-note" style={{ marginTop: '0.85rem' }}>
                    <strong className="text-primary">{players.length}</strong> {players.length === 1 ? 'player' : 'players'}
                    {staff.length > 0 && (
                      <> · {staff.map(r => `${memberById.get(r.member_id)?.full_name} (${TEAM_ROLE_LABELS[r.team_role]})`).join(', ')}</>
                    )}
                  </div>
                </div>
                <div className="row row-wrap" style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border-subtle)', gap: '0.5rem' }}>
                  <button onClick={() => openRoster(team)} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Users size={13} /> Squad & Staff
                  </button>
                  {!team.is_default && team.is_active && (
                    <button onClick={() => makeMain(team)} className="btn btn-secondary btn-sm">Make main team</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Add Team' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={saveTeam} className="stack stack-sm">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="team-name">Team name *</label>
                <input id="team-name" className="form-input" required maxLength={128} placeholder="e.g. Reserves, U10 Lions" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="team-short">Short name</label>
                <input id="team-short" className="form-input" maxLength={32} placeholder="e.g. RES, U10" value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="team-type">Type</label>
                <select id="team-type" className="form-input" value={form.team_type} onChange={e => setForm({ ...form, team_type: e.target.value as ClubTeamType })}>
                  {TEAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="team-age">Age group</label>
                <select id="team-age" className="form-input" value={form.age_group} onChange={e => pickAgeGroup(e.target.value)}>
                  <option value="">Open age</option>
                  {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="team-gender">Players</label>
                <select id="team-gender" className="form-input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as ClubTeamGender })}>
                  {TEAM_GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="team-format">Match format</label>
                <select id="team-format" className="form-input" value={form.match_format} onChange={e => setForm({ ...form, match_format: e.target.value as ClubTeamFormat })}>
                  {TEAM_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <label className="row" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_junior} onChange={e => setForm({ ...form, is_junior: e.target.checked })} style={{ marginTop: 3 }} />
              <span>
                <strong className="text-primary" style={{ fontSize: '0.88rem' }}>Junior (kids) team</strong>
                <span className="text-note" style={{ display: 'block' }}>Its squad list is never shown on the public site.</span>
              </span>
            </label>
            <label className="row" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.hide_public_scores} onChange={e => setForm({ ...form, hide_public_scores: e.target.checked })} style={{ marginTop: 3 }} />
              <span>
                <strong className="text-primary" style={{ fontSize: '0.88rem' }}>Hide scores on the public site</strong>
                <span className="text-note" style={{ display: 'block' }}>Fixtures still show; results and scores don&apos;t. Usual for U7 to U11.</span>
              </span>
            </label>

            <div className="form-group" style={{ margin: 0 }}>
              <span className="form-label">Team colour</span>
              <div className="row row-wrap">
                {COLOR_PRESETS.map(c => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} aria-label={`Colour ${c}`}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid var(--text-primary)' : '2px solid rgba(0,0,0,0.3)' }} />
                ))}
                <input type="color" aria-label="Custom team colour" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer' }} />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="team-desc">About the team</label>
              <textarea id="team-desc" className="form-input" rows={3} maxLength={1000} placeholder="Training times, league, who it's for..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.75rem', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="team-order">Display order</label>
                <input id="team-order" type="number" className="form-input" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
              {!(editing !== 'new' && editing.is_default) && (
                <label className="row" style={{ cursor: 'pointer', paddingBottom: '0.6rem' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  <span className="text-primary" style={{ fontSize: '0.88rem', fontWeight: 600 }}>Active</span>
                </label>
              )}
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" data-view-ok onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">{editing === 'new' ? 'Create team' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {rosterTeam && (
        <Modal title={`${rosterTeam.name}: Squad & Staff`} onClose={() => setRosterTeam(null)}>
          <div className="stack stack-sm">
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong className="text-primary" style={{ fontSize: '0.9rem' }}>Players ({rosterPlayers.length})</strong>
                <span className="text-meta">A player can be in more than one team</span>
              </div>
              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input data-view-ok aria-label="Search members" className="form-input" placeholder="Search members..." value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} style={{ paddingLeft: '2.2rem' }} />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                {filteredMembers.length === 0 && <div className="text-note" style={{ padding: '0.75rem' }}>No members found.</div>}
                {filteredMembers.map(m => (
                  <label key={m.id} className="row" style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
                    <input type="checkbox" checked={rosterPlayers.includes(m.id)} onChange={() => togglePlayer(m.id)} />
                    <PlayerAvatar name={m.full_name} photoUrl={m.photo_url} size={26} />
                    <span className="min-w-0" style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {m.full_name}
                      {!isPlayerLike(m) && <span className="text-meta"> · {m.role}</span>}
                    </span>
                    {m.player_position && <span className="text-meta">{m.player_position}</span>}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <strong className="text-primary" style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Coaches & staff</strong>
              {rosterStaff.length === 0 && <div className="text-note" style={{ marginBottom: '0.5rem' }}>No staff yet.</div>}
              {rosterStaff.map(s => (
                <div key={`${s.member_id}-${s.team_role}`} className="row" style={{ justifyContent: 'space-between', padding: '0.35rem 0' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {memberById.get(s.member_id)?.full_name || 'Former member'} <span className="text-meta">· {TEAM_ROLE_LABELS[s.team_role]}</span>
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" aria-label="Remove from staff"
                    onClick={() => setRosterStaff(prev => prev.filter(x => !(x.member_id === s.member_id && x.team_role === s.team_role)))}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="row row-wrap" style={{ marginTop: '0.5rem' }}>
                <select aria-label="Staff member" className="form-input" style={{ flex: '2 1 180px' }} value={newStaffId} onChange={e => setNewStaffId(e.target.value)}>
                  <option value="">Choose a member...</option>
                  {clubMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
                <select aria-label="Staff role" className="form-input" style={{ flex: '1 1 130px' }} value={newStaffRole} onChange={e => setNewStaffRole(e.target.value as ClubTeamRole)}>
                  {STAFF_ROLES.map(r => <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>)}
                </select>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addStaff} disabled={!newStaffId}>Add</button>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" data-view-ok onClick={() => setRosterTeam(null)} className="btn btn-secondary">Cancel</button>
              <button type="button" onClick={saveRoster} className="btn btn-primary">Save squad</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
