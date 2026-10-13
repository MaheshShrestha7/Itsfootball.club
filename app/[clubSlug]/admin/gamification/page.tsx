'use client';

import React, { useEffect, useRef, useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { isPlayerMember, type ClubScoreRuleConfig } from '@/lib/supabase/types';
import { getDefaultClubScoreRules, liveStreak } from '@/lib/clubscore-defaults';
import { Flame, Save, CheckCircle2, Award, Sparkles, Search, Settings2, X, RotateCcw, Plus, History } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import { useEscapeToClose } from '@/lib/use-escape-to-close';

type NumericRule = { [K in keyof ClubScoreRuleConfig]-?: ClubScoreRuleConfig[K] extends number ? K : never }[keyof ClubScoreRuleConfig];

const POINT_FIELDS: { key: NumericRule; label: string }[] = [
  { key: 'points_training_checkin', label: 'Training check-in' },
  { key: 'points_social_checkin', label: 'Social check-in' },
  { key: 'points_match_appearance', label: 'Match appearance' },
  { key: 'points_goal_forward', label: 'Goal (forward)' },
  { key: 'points_goal_midfielder', label: 'Goal (midfielder)' },
  { key: 'points_goal_defender', label: 'Goal (defender/GK)' },
  { key: 'points_assist', label: 'Assist' },
  { key: 'points_clean_sheet_gk_def', label: 'Clean sheet (GK/DEF)' },
  { key: 'points_motm', label: 'Man of the match' },
  { key: 'points_yellow_card_penalty', label: 'Yellow card' },
  { key: 'points_red_card_penalty', label: 'Red card' },
];

const MULTIPLIER_FIELDS: { key: NumericRule; label: string }[] = [
  { key: 'streak_multiplier_3w', label: '3-week streak' },
  { key: 'streak_multiplier_5w', label: '5-week streak' },
  { key: 'streak_multiplier_10w', label: '10-week streak' },
];

// Common coach bonuses: one tap fills the reason and points
const BONUS_PRESETS = [
  { reason: 'Fair play & leadership', points: 15 },
  { reason: 'Pitch prep', points: 10 },
  { reason: 'Extra training', points: 5 },
  { reason: 'Volunteering', points: 10 },
  { reason: 'Missed kit duty', points: -5 },
];

type StreakStatus = 'iron' | 'fire' | 'building' | 'inactive';

const STATUS: Record<StreakStatus, { label: string; color: string }> = {
  iron: { label: 'Iron Man', color: 'var(--c-green)' },
  fire: { label: 'On Fire', color: 'var(--c-red)' },
  building: { label: 'Building', color: 'var(--c-amber)' },
  inactive: { label: 'Inactive', color: 'var(--text-muted)' },
};

function streakStatus(streak: number): StreakStatus {
  if (streak >= 5) return 'iron';
  if (streak >= 3) return 'fire';
  return streak > 0 ? 'building' : 'inactive';
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const days = Math.floor((Date.now() - Date.parse(dateStr)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(var(--dk-4-6-9), 0.88)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1rem',
};

const dialogStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgb(var(--dk-17-24-39)) 0%, rgb(var(--dk-15-23-42)) 100%)',
  border: '1px solid rgba(var(--tint-rgb), 0.12)',
  borderRadius: '16px',
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
  color: 'var(--text-primary)',
};

const dialogHeaderStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid rgba(var(--tint-rgb), 0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
};

const closeButtonStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' };

export default function AdminGamificationPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    members,
    seasons,
    getActiveSeason,
    clubScoreProfiles,
    clubScoreRules,
    activityLogs,
    updateClubScoreRules,
    awardClubScorePoints,
    saveNow,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const squadPlayers = members.filter(m => m.club_id === club.id && isPlayerMember(m));
  const clubSeasons = seasons.filter(s => s.club_id === club.id);
  const activeSeason = getActiveSeason(club.id);
  const savedRules = clubScoreRules[club.id];

  const [seasonName, setSeasonName] = useState(activeSeason?.name || '');
  // Seasons load from Supabase after the first render: follow the active one until the admin picks another
  const [seasonPicked, setSeasonPicked] = useState(false);
  useEffect(() => {
    if (!seasonPicked && activeSeason?.name) setSeasonName(activeSeason.name);
  }, [activeSeason?.name, seasonPicked]);
  const season = clubSeasons.find(s => s.name === seasonName);

  const clubProfiles = clubScoreProfiles.filter(p => p.club_id === club.id && (!seasonName || p.season === seasonName));

  const [rulesForm, setRulesForm] = useState<ClubScoreRuleConfig>(() => savedRules || getDefaultClubScoreRules(club.id));
  const [showRules, setShowRules] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesError, setRulesError] = useState(false);
  // Set on Save: once the new rules are in state, they are written to the database straight away
  const saveRulesPendingRef = useRef(false);
  useEscapeToClose(showRules && !rulesSaving, setShowRules);

  // Saved rules can arrive after the first render; show them so Save never writes the defaults over them
  useEffect(() => {
    if (savedRules) setRulesForm(savedRules);
  }, [savedRules]);

  // "Saved" only once the database has the new rules; on failure the popup stays open with the edits
  useEffect(() => {
    if (!saveRulesPendingRef.current) return;
    saveRulesPendingRef.current = false;
    saveNow().then(saved => {
      setRulesSaving(false);
      if (!saved) {
        setRulesError(true);
        return;
      }
      setShowRules(false);
      setRulesSaved(true);
      setTimeout(() => setRulesSaved(false), 3000);
    });
  }, [savedRules, saveNow]);

  const [showAward, setShowAward] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [awardPoints, setAwardPoints] = useState(BONUS_PRESETS[0].points);
  const [awardReason, setAwardReason] = useState(BONUS_PRESETS[0].reason);
  const [awardSuccess, setAwardSuccess] = useState('');
  useEscapeToClose(showAward, setShowAward);

  const [streakQuery, setStreakQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StreakStatus | 'all'>('all');

  const openRules = () => {
    setRulesForm(savedRules || getDefaultClubScoreRules(club.id));
    setRulesError(false);
    setShowRules(true);
  };

  const openAward = (memberId = '') => {
    setSelectedMemberId(memberId);
    setShowAward(true);
  };

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    setRulesError(false);
    setRulesSaving(true);
    saveRulesPendingRef.current = true;
    updateClubScoreRules(club.id, rulesForm);
  };

  const handleManualAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    awardClubScorePoints(selectedMemberId, awardPoints, 'admin_award', awardReason);
    const name = squadPlayers.find(p => p.id === selectedMemberId)?.full_name || 'Player';
    setShowAward(false);
    setAwardSuccess(`${awardPoints > 0 ? '+' : ''}${awardPoints} points awarded to ${name}`);
    setTimeout(() => setAwardSuccess(''), 3000);
  };

  const ruleInput = (f: { key: NumericRule; label: string }, step?: string) => (
    <div key={f.key} className="form-group m-0">
      <label htmlFor={`gamification-${f.key}`} className="form-label">{f.label}</label>
      <input id={`gamification-${f.key}`}
        type="number"
        step={step}
        value={rulesForm[f.key]}
        onChange={e => setRulesForm({ ...rulesForm, [f.key]: Number(e.target.value) })}
        className="form-input"
      />
    </div>
  );

  const streakRows = squadPlayers
    .map(player => {
      const profile = clubProfiles.find(p => p.member_id === player.id);
      const streak = profile ? liveStreak(profile) : 0;
      return { player, profile, streak, status: streakStatus(streak) };
    })
    .sort((a, b) => b.streak - a.streak || (b.profile?.total_points || 0) - (a.profile?.total_points || 0));

  const q = streakQuery.trim().toLowerCase().replace(/^#/, '');
  const visibleRows = streakRows.filter(r =>
    (statusFilter === 'all' || r.status === statusFilter) &&
    (!q || r.player.full_name.toLowerCase().includes(q) || String(r.player.jersey_number ?? '') === q)
  );

  const activeStreaksCount = streakRows.filter(r => r.streak >= 3).length;
  const totalClubPoints = clubProfiles.reduce((acc, p) => acc + p.total_points, 0);

  // Coach bonuses given in the picked season, newest first
  const inSeason = (date?: string) => !season || !date || (date.slice(0, 10) >= season.start_date && date.slice(0, 10) <= season.end_date);
  const recentBonuses = activityLogs
    .filter(l => l.club_id === club.id && l.event_type === 'admin_award' && inSeason(l.created_at))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 6);

  const rules = savedRules || getDefaultClubScoreRules(club.id);
  const ruleSummary: [string, string, boolean?][] = [
    ['Training check-in', `${rules.points_training_checkin}`],
    ['Social check-in', `${rules.points_social_checkin}`],
    ['Match appearance', `${rules.points_match_appearance}`],
    ['Goal (FWD / MID / DEF)', `${rules.points_goal_forward} / ${rules.points_goal_midfielder} / ${rules.points_goal_defender}`],
    ['Assist', `${rules.points_assist}`],
    ['Clean sheet (GK/DEF)', `${rules.points_clean_sheet_gk_def}`],
    ['Man of the match', `${rules.points_motm}`],
    ['Yellow / red card', `${rules.points_yellow_card_penalty} / ${rules.points_red_card_penalty}`, true],
    ['Streak 3w / 5w / 10w', `×${rules.streak_multiplier_3w} / ×${rules.streak_multiplier_5w} / ×${rules.streak_multiplier_10w}`],
  ];

  return (
    <div className="stack" style={{ gap: '1.5rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem', letterSpacing: '0.05em' }}>FANS & ENGAGEMENT • CLUBSCORE</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Flame size={30} /> ClubScore
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '680px', marginTop: '0.2rem' }}>
            Keep an eye on attendance streaks, award coach bonuses and set how many points players earn.
          </p>
        </div>
        <div className="row row-wrap">
          {clubSeasons.length > 0 && (
            <select aria-label="Season" className="form-select" style={{ width: 'auto' }}
              value={seasonName}
              onChange={e => { setSeasonName(e.target.value); setSeasonPicked(true); }}>
              {clubSeasons.map(s => (
                <option key={s.id} value={s.name}>Season {s.name}{s.is_current ? ' (current)' : ''}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-secondary" onClick={openRules}>
            <Settings2 size={16} /> <span>Points rules</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openAward()} disabled={!rules.is_active}
            title={rules.is_active ? undefined : 'ClubScore is off, so no points can be awarded'}>
            <Plus size={16} /> <span>Award bonus</span>
          </button>
        </div>
      </div>

      {(awardSuccess || rulesSaved) && (
        <div role="status" style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          color: 'var(--c-green)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <CheckCircle2 size={18} />
          <span>{awardSuccess || 'Points rules saved'}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 96px), 1fr))', gap: 'clamp(0.5rem, 2vw, 1rem)' }}>
        <div className="stat-tile">
          <div className="eyebrow">Players on a 3+ week streak</div>
          <div className="stat-value" style={{ color: 'var(--c-red)' }}>{activeStreaksCount}</div>
        </div>
        <div className="stat-tile">
          <div className="eyebrow">Points this season</div>
          <div className="stat-value" style={{ color: 'var(--club-ink)' }}>{totalClubPoints.toLocaleString()}</div>
        </div>
        <div className="stat-tile">
          <div className="eyebrow">Players tracked</div>
          <div className="stat-value">{squadPlayers.length}</div>
        </div>
      </div>

      <div className="split-main-side">
        <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
          <h3 className="row" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Flame size={18} /> Streak monitor
          </h3>
          <p className="text-note" style={{ margin: '0.25rem 0 1rem' }}>
            Spot players about to lose their streak or drifting away from training.
          </p>

          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input data-view-ok aria-label="Search players"
              type="search"
              className="form-input"
              placeholder="Search by name or squad number..."
              value={streakQuery}
              onChange={e => setStreakQuery(e.target.value)}
              style={{ paddingLeft: '2.1rem' }}
            />
          </div>

          <div className="row row-wrap" style={{ marginBottom: '1rem' }}>
            {(['all', 'iron', 'fire', 'building', 'inactive'] as const).map(s => (
              <button data-view-ok key={s} type="button" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                {s === 'all' ? 'All' : STATUS[s].label} ({s === 'all' ? streakRows.length : streakRows.filter(r => r.status === s).length})
              </button>
            ))}
          </div>

          {visibleRows.length === 0 ? (
            <p className="text-note">No players match.</p>
          ) : (
            <ul className="stack stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0, gap: '0.5rem' }}>
              {visibleRows.map(({ player, profile, streak, status }) => (
                <li key={player.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem 0.75rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(var(--shade-rgb), 0.2)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                }}>
                  <div className="row row-loose min-w-0" style={{ flex: '1 1 180px' }}>
                    <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} size={32} />
                    <div className="min-w-0">
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.full_name}</div>
                      <div className="text-meta">#{player.jersey_number ?? '-'} • {profile?.total_points || 0} pts • {timeAgo(profile?.last_activity_date)}</div>
                    </div>
                  </div>
                  <div className="row row-loose shrink-0" style={{ marginLeft: 'auto' }}>
                    <span className="row row-tight" style={{ fontWeight: 800, color: streak >= 3 ? 'var(--c-red)' : 'var(--text-muted)' }}>
                      {streak >= 3 && <Flame size={12} />}
                      {streak}w
                    </span>
                    <span className="badge" style={{ color: STATUS[status].color, background: 'rgba(var(--tint-rgb), 0.05)', border: '1px solid var(--border-subtle)' }}>
                      {STATUS[status].label}
                    </span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAward(player.id)} disabled={!rules.is_active}
                      aria-label={`Award bonus to ${player.full_name}`}>
                      <Plus size={14} /> <span>Bonus</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="stack" style={{ gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 className="row" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                <Sparkles size={18} /> Points rules
              </h3>
              <span className="badge" style={{ color: rules.is_active ? 'var(--c-green)' : 'var(--text-muted)', background: 'rgba(var(--tint-rgb), 0.05)', border: '1px solid var(--border-subtle)' }}>
                {rules.is_active ? 'On' : 'Off'}
              </span>
            </div>
            <p className="text-note" style={{ margin: '0.25rem 0 1rem' }}>
              What each training and match action is worth.
            </p>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.45rem 1rem', fontSize: '0.85rem', margin: 0 }}>
              {ruleSummary.map(([label, value, penalty]) => (
                <React.Fragment key={label}>
                  <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
                  <dd style={{ margin: 0, fontWeight: 700, textAlign: 'right', color: penalty ? 'var(--c-red)' : 'var(--text-primary)' }}>{value}</dd>
                </React.Fragment>
              ))}
            </dl>
            <button type="button" className="btn btn-secondary btn-sm w-full" style={{ marginTop: '1.1rem' }} onClick={openRules}>
              <Settings2 size={14} /> <span>Edit rules</span>
            </button>
          </div>

          <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
            <h3 className="row" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              <History size={18} /> Recent coach bonuses
            </h3>
            {recentBonuses.length === 0 ? (
              <p className="text-note" style={{ marginTop: '0.5rem' }}>No bonuses awarded this season yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
                {recentBonuses.map(log => {
                  const player = members.find(m => m.id === log.member_id);
                  return (
                    <li key={log.id} className="row" style={{ justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                      <div className="min-w-0">
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{player?.full_name || 'Former player'}</div>
                        <div className="text-meta">{log.description} • {timeAgo(log.created_at)}</div>
                      </div>
                      <span style={{ fontWeight: 800, color: log.final_points < 0 ? 'var(--c-red)' : 'var(--c-green)', whiteSpace: 'nowrap' }}>
                        {log.final_points > 0 ? '+' : ''}{log.final_points}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showRules && (
        <div style={overlayStyle} onClick={() => { if (!rulesSaving) setShowRules(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="gamification-rules-title" style={{ ...dialogStyle, maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div style={dialogHeaderStyle}>
              <h3 id="gamification-rules-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="var(--c-amber)" /> Points rules
              </h3>
              <button type="button" onClick={() => setShowRules(false)} aria-label="Close" style={closeButtonStyle} disabled={rulesSaving}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRules} className="stack" style={{ padding: '1.5rem' }}>
              <label className="row" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={rulesForm.is_active}
                  onChange={e => setRulesForm({ ...rulesForm, is_active: e.target.checked })} />
                ClubScore is on for this club
              </label>
              {!rulesForm.is_active && (
                <p className="text-note" style={{ marginTop: '-0.5rem' }}>
                  While it is off, players earn no points from check-ins, matches or coach bonuses. Points already earned stay.
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '1rem' }}>
                {POINT_FIELDS.map(f => ruleInput(f))}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <h4 className="row" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  <Flame size={14} /> Streak multipliers
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '1rem' }}>
                  {MULTIPLIER_FIELDS.map(f => ruleInput(f, '0.05'))}
                </div>
              </div>

              {rulesError && (
                <div role="alert" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', color: 'var(--c-red)', fontSize: '0.85rem', fontWeight: 600 }}>
                  The rules could not be saved to the database. Your changes are still here, so try again.
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" disabled={rulesSaving}
                  onClick={() => setRulesForm({ ...getDefaultClubScoreRules(club.id), id: rulesForm.id, is_active: rulesForm.is_active })}>
                  <RotateCcw size={16} /> <span>Reset to defaults</span>
                </button>
                <div className="row row-wrap">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRules(false)} disabled={rulesSaving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={rulesSaving}>
                    <Save size={16} /> <span>{rulesSaving ? 'Saving...' : 'Save rules'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAward && (
        <div style={overlayStyle} onClick={() => setShowAward(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="gamification-award-title" style={{ ...dialogStyle, maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div style={dialogHeaderStyle}>
              <h3 id="gamification-award-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} color="var(--c-amber)" /> Award coach bonus
              </h3>
              <button type="button" onClick={() => setShowAward(false)} aria-label="Close" style={closeButtonStyle}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleManualAward} style={{ padding: '1.5rem' }}>
              <div className="form-group">
                <span className="form-label">Player</span>
                <PlayerSearchSelect
                  id="gamification-select-player"
                  players={squadPlayers}
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Quick pick</span>
                <div className="row row-wrap">
                  {BONUS_PRESETS.map(p => {
                    const on = awardReason === p.reason && awardPoints === p.points;
                    return (
                      <button key={p.reason} type="button" aria-pressed={on}
                        className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setAwardReason(p.reason); setAwardPoints(p.points); }}>
                        {p.reason} {p.points > 0 ? '+' : ''}{p.points}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-row-2-1">
                <div className="form-group">
                  <label htmlFor="gamification-award-reason" className="form-label">Reason</label>
                  <input id="gamification-award-reason"
                    type="text"
                    value={awardReason}
                    onChange={e => setAwardReason(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="gamification-points" className="form-label">Points (+/-)</label>
                  <input id="gamification-points"
                    type="number"
                    value={awardPoints}
                    onChange={e => setAwardPoints(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAward(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!selectedMemberId}>
                  <Sparkles size={16} />
                  <span>{selectedMemberId ? `Award ${awardPoints} points` : 'Pick a player first'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
