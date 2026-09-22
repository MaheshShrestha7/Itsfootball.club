import { ClubBadge, ClubScoreRuleConfig, PlayerPosition } from './supabase/types';

const MIDFIELDER_POSITIONS: PlayerPosition[] = ['CDM', 'CM', 'CAM'];
const DEFENDER_POSITIONS: PlayerPosition[] = ['GK', 'CB', 'LB', 'RB'];

/**
 * Resolves the configured ClubScore points for a goal based on the scorer's position
 * (clubs can reward defenders/midfielders more than forwards for finding the net).
 * Forwards, subs, and members with no recorded position fall back to the forward rate,
 * matching this app's long-standing default when position is unknown.
 */
export function getGoalPointsForPosition(
  rules: ClubScoreRuleConfig,
  position?: PlayerPosition
): number {
  if (position && DEFENDER_POSITIONS.includes(position)) {
    return rules.points_goal_defender ?? 15;
  }
  if (position && MIDFIELDER_POSITIONS.includes(position)) {
    return rules.points_goal_midfielder ?? 12;
  }
  return rules.points_goal_forward ?? 10;
}

export const STANDARD_BADGES: ClubBadge[] = [
  {
    id: 'badge-ironman',
    name: 'Iron Man 5-Streak',
    description: 'Maintained 5 consecutive weeks of verified training & match attendance.',
    icon: 'flame',
    tier_required: 'Prospect',
  },
  {
    id: 'badge-hattrick',
    name: 'Hat-Trick Hero',
    description: 'Scored 3 goals in a single competitive match.',
    icon: 'award',
    tier_required: 'First Team',
  },
  {
    id: 'badge-wall',
    name: 'Defensive Wall',
    description: 'Kept 3 consecutive clean sheets across league fixtures.',
    icon: 'shield',
    tier_required: 'First Team',
  },
  {
    id: 'badge-centurion',
    name: 'Club Centurion',
    description: 'Crossed 500 lifetime ClubScore fantasy points.',
    icon: 'crown',
    tier_required: 'Club Legend',
  },
  {
    id: 'badge-teamplayer',
    name: 'Pivotal Playmaker',
    description: 'Recorded 5 assists in competitive league action.',
    icon: 'sparkles',
    tier_required: 'All-Star',
  }
];

export function getDefaultClubScoreRules(clubId: string): ClubScoreRuleConfig {
  return {
    club_id: clubId,
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
}
