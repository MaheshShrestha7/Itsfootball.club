'use client';

import React, { useEffect, useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { isPlayerMember, type ClubScoreRuleConfig } from '@/lib/supabase/types';
import { liveStreak } from '@/lib/clubscore-defaults';
import { Flame, Save, CheckCircle2, Award, Sparkles, Search } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';

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
    clubScoreProfiles,
    clubScoreRules,
    updateClubScoreRules,
    awardClubScorePoints,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const squadPlayers = members.filter(m => m.club_id === club.id && isPlayerMember(m));
  const clubProfiles = clubScoreProfiles.filter(p => p.club_id === club.id);
  const savedRules = clubScoreRules[club.id];

  const [rulesForm, setRulesForm] = useState<ClubScoreRuleConfig>(() => savedRules || {
    club_id: club.id,
    points_training_checkin: 10,
    points_social_checkin: 5,
    points_match_appearance: 5,
    points_goal_forward: 10,
    points_goal_midfielder: 12,
    points_goal_defender: 15,
    points_assist: 7,
    points_clean_sheet_gk_def: 10,
    points_motm: 15,
    points_yellow_card_penalty: -3,
    points_red_card_penalty: -10,
    streak_multiplier_3w: 1.15,
    streak_multiplier_5w: 1.25,
    streak_multiplier_10w: 1.50,
    is_active: true,
  });
  const [rulesSaved, setRulesSaved] = useState(false);

  // Saved rules can arrive after the first render; show them so Save never writes the defaults over them
  useEffect(() => {
    if (savedRules) setRulesForm(savedRules);
  }, [savedRules]);

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [awardPoints, setAwardPoints] = useState(15);
  const [awardReason, setAwardReason] = useState("Coach's Fair Play & Leadership Award");
  const [awardSuccess, setAwardSuccess] = useState(false);

  const [streakQuery, setStreakQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StreakStatus | 'all'>('all');

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    updateClubScoreRules(club.id, rulesForm);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 3000);
  };

  const handleManualAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    awardClubScorePoints(selectedMemberId, awardPoints, 'admin_award', awardReason);
    setAwardSuccess(true);
    setTimeout(() => setAwardSuccess(false), 3000);
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

  return (
    <div className="stack" style={{ gap: '1.5rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem', letterSpacing: '0.05em' }}>PEOPLE & MEMBERSHIP • CLUBSCORE</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Flame size={30} /> ClubScore
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '680px', marginTop: '0.2rem' }}>
            Set how many points players earn, award coach bonuses, and keep an eye on attendance streaks.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
        <div className="stat-tile">
          <div className="eyebrow">Players on a 3+ week streak</div>
          <div className="stat-value" style={{ color: 'var(--c-red)' }}>{activeStreaksCount}</div>
        </div>
        <div className="stat-tile">
          <div className="eyebrow">Season points awarded</div>
          <div className="stat-value" style={{ color: 'var(--club-primary)' }}>{totalClubPoints}</div>
        </div>
        <div className="stat-tile">
          <div className="eyebrow">Players tracked</div>
          <div className="stat-value">{squadPlayers.length}</div>
        </div>
      </div>

      <div className="split-2" style={{ alignItems: 'start' }}>
        <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
          <h3 className="row" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Sparkles size={18} /> Points & multipliers
          </h3>
          <p className="text-note" style={{ margin: '0.25rem 0 1.25rem' }}>
            How many points each training and match action is worth.
          </p>

          <form onSubmit={handleSaveRules} className="stack">
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

            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              {rulesSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              <span>{rulesSaved ? 'Rules saved' : 'Save rules'}</span>
            </button>
          </form>
        </div>

        <div className="stack" style={{ gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
            <h3 className="row" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              <Award size={18} /> Coach bonus
            </h3>
            <p className="text-note" style={{ margin: '0.25rem 0 1.25rem' }}>
              Reward fair play, helping with pitch prep, or extra training.
            </p>

            <form onSubmit={handleManualAward}>
              <div className="form-group">
                <span className="form-label">Player</span>
                <PlayerSearchSelect
                  id="gamification-select-player"
                  players={squadPlayers}
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                />
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

              <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center' }} disabled={!selectedMemberId}>
                {awardSuccess ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
                <span>{awardSuccess ? 'Points awarded' : selectedMemberId ? 'Award points' : 'Pick a player first'}</span>
              </button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: 'clamp(1.2rem, 3vw, 1.75rem)' }}>
            <h3 className="row" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              <Flame size={18} /> Streak monitor
            </h3>
            <p className="text-note" style={{ margin: '0.25rem 0 1rem' }}>
              Spot players about to lose their streak or drifting away from training.
            </p>

            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input aria-label="Search players"
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
                <button key={s} type="button" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}
                  className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                  {s === 'all' ? 'All' : STATUS[s].label} ({s === 'all' ? streakRows.length : streakRows.filter(r => r.status === s).length})
                </button>
              ))}
            </div>

            {visibleRows.length === 0 ? (
              <p className="text-note">No players match.</p>
            ) : (
              <ul className="stack stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0, gap: '0.5rem', maxHeight: '480px', overflowY: 'auto' }}>
                {visibleRows.map(({ player, profile, streak, status }) => (
                  <li key={player.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(var(--shade-rgb), 0.2)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}>
                    <div className="row row-loose min-w-0">
                      <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} size={32} />
                      <div className="min-w-0">
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.full_name}</div>
                        <div className="text-meta">#{player.jersey_number ?? '-'} • {profile?.tier || 'Rookie'} • {profile?.total_points || 0} pts</div>
                      </div>
                    </div>
                    <div className="row row-loose shrink-0">
                      <span className="row row-tight" style={{ fontWeight: 800, color: streak >= 3 ? 'var(--c-red)' : 'var(--text-muted)' }}>
                        {streak >= 3 && <Flame size={12} />}
                        {streak}w
                      </span>
                      <span className="badge" style={{ color: STATUS[status].color, background: 'rgba(var(--tint-rgb), 0.05)', border: '1px solid var(--border-subtle)' }}>
                        {STATUS[status].label}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
