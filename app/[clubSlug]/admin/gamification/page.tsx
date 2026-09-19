'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import {
  Trophy,
  Flame,
  Zap,
  Save,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  TrendingUp,
  History,
  ShieldAlert,
  UserCheck
} from 'lucide-react';

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
    activityLogs,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const squadPlayers = members.filter(m => m.club_id === club.id && m.role === 'player');
  const clubProfiles = clubScoreProfiles.filter(p => p.club_id === club.id);
  const currentRules = clubScoreRules[club.id] || {
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
  };

  // Rule Form State
  const [rulesForm, setRulesForm] = useState(currentRules);
  const [rulesSaved, setRulesSaved] = useState(false);

  // Manual Award Form State
  const [selectedMemberId, setSelectedMemberId] = useState(squadPlayers[0]?.id || '');
  const [awardPoints, setAwardPoints] = useState(15);
  const [awardReason, setAwardReason] = useState("Coach's Fair Play & Leadership Award");
  const [awardSuccess, setAwardSuccess] = useState(false);

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    updateClubScoreRules(club.id, rulesForm);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 3000);
  };

  const handleManualAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;

    awardClubScorePoints(
      selectedMemberId,
      awardPoints,
      'admin_award',
      awardReason
    );

    setAwardSuccess(true);
    setTimeout(() => setAwardSuccess(false), 3000);
  };

  // Analytics
  const activeStreaksCount = clubProfiles.filter(p => p.current_streak >= 3).length;
  const totalClubPoints = clubProfiles.reduce((acc, p) => acc + p.total_points, 0);

  return (
    <div style={{ padding: '2rem' }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        marginBottom: '2.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '1.5rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
            <span className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Zap size={12} fill="#F59E0B" /> GRASSROOTS INCENTIVE SCHEME
            </span>
            <span className="badge badge-primary">RETENTION ENGINE</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            🏆 ClubScore Gamification Controller
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Configure points formulas, award manual team-spirit bonuses, and monitor player attendance streaks.
          </p>
        </div>

        {/* Quick KPI Badges */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ACTIVE 3+ STREAKS</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
              <Flame size={18} color="#EF4444" fill="#EF4444" />
              <span>{activeStreaksCount} Players</span>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SEASON TOTAL PTS</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--club-primary)' }}>
              {totalClubPoints} PTS
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '2rem',
        alignItems: 'flex-start',
      }}>
        {/* Column 1: Point Weighting Configuration */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="#F59E0B" />
                <span>Point Weightings & Multipliers</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Customize how heavily training and match actions reward players.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveRules} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Training QR Check-In (pts)
                </label>
                <input
                  type="number"
                  value={rulesForm.points_training_checkin}
                  onChange={e => setRulesForm({ ...rulesForm, points_training_checkin: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Match Appearance (pts)
                </label>
                <input
                  type="number"
                  value={rulesForm.points_match_appearance}
                  onChange={e => setRulesForm({ ...rulesForm, points_match_appearance: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Goal (Forward)
                </label>
                <input
                  type="number"
                  value={rulesForm.points_goal_forward}
                  onChange={e => setRulesForm({ ...rulesForm, points_goal_forward: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Goal (Defender/GK)
                </label>
                <input
                  type="number"
                  value={rulesForm.points_goal_defender}
                  onChange={e => setRulesForm({ ...rulesForm, points_goal_defender: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Assist
                </label>
                <input
                  type="number"
                  value={rulesForm.points_assist}
                  onChange={e => setRulesForm({ ...rulesForm, points_assist: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Clean Sheet (GK/DEF)
                </label>
                <input
                  type="number"
                  value={rulesForm.points_clean_sheet_gk_def}
                  onChange={e => setRulesForm({ ...rulesForm, points_clean_sheet_gk_def: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Flame size={14} color="#EF4444" />
                <span>Streak Multipliers</span>
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>3-Week Streak</label>
                  <input
                    type="number"
                    step="0.05"
                    value={rulesForm.streak_multiplier_3w}
                    onChange={e => setRulesForm({ ...rulesForm, streak_multiplier_3w: Number(e.target.value) })}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>5-Week Streak</label>
                  <input
                    type="number"
                    step="0.05"
                    value={rulesForm.streak_multiplier_5w}
                    onChange={e => setRulesForm({ ...rulesForm, streak_multiplier_5w: Number(e.target.value) })}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>10-Week Streak</label>
                  <input
                    type="number"
                    step="0.05"
                    value={rulesForm.streak_multiplier_10w}
                    onChange={e => setRulesForm({ ...rulesForm, streak_multiplier_10w: Number(e.target.value) })}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
            >
              {rulesSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              <span>{rulesSaved ? 'Rules Saved Successfully!' : 'Save ClubScore Rules'}</span>
            </button>
          </form>
        </div>

        {/* Column 2: Fast Manual Award & Retention Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Quick Bonus Points Awarder */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} color="var(--club-primary)" />
              <span>Award Coach Discretionary Bonus</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Incentivize fair play, helping pitch prep, or extra training sessions.
            </p>

            <form onSubmit={handleManualAward} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Select Player
                </label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  {squadPlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.jersey_number} {p.full_name} ({p.player_position})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                    Points (+/-)
                  </label>
                  <input
                    type="number"
                    value={awardPoints}
                    onChange={e => setAwardPoints(Number(e.target.value))}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 700 }}>
                    Award Reason
                  </label>
                  <input
                    type="text"
                    value={awardReason}
                    onChange={e => setAwardReason(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                  border: '1px solid rgba(16, 185, 129, 0.4)'
                }}
              >
                {awardSuccess ? <CheckCircle2 size={16} color="#10B981" /> : <Sparkles size={16} color="#10B981" />}
                <span>{awardSuccess ? 'Points Allocated & Logged!' : 'Award Points & Record in Ledger'}</span>
              </button>
            </form>
          </div>

          {/* Player Retention & Attendance Streak Health */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Flame size={18} color="#EF4444" />
                <span>Squad Streak Retention Monitor</span>
              </h3>
              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: '0.7rem' }}>
                TOUCHLINE HEALTH
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Spot players at risk of losing their streaks or dropping out of training.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {squadPlayers.map(player => {
                const profile = clubProfiles.find(p => p.member_id === player.id);
                const streak = profile?.current_streak || 0;
                const isAtRisk = streak > 0 && streak < 3;

                return (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img
                        src={player.photo_url}
                        alt={player.full_name}
                        style={{ width: '30px', height: '30px', borderRadius: '6px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{player.full_name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          #{player.jersey_number} • {profile?.tier || 'Rookie'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: streak >= 3 ? '#EF4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          {streak >= 3 && <Flame size={12} color="#EF4444" fill="#EF4444" />}
                          <span>{streak}w streak</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {profile?.total_points || 0} pts
                        </div>
                      </div>

                      {streak >= 5 ? (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '0.65rem' }}>
                          Iron Man
                        </span>
                      ) : isAtRisk ? (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontSize: '0.65rem' }}>
                          Building
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
