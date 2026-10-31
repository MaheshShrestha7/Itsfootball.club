// ==============================================================================
// itsfootball.club: Complete TypeScript Database Models & Types
// ==============================================================================

import type { OrderItem } from '../shop';
import type { AppIcons } from '../app-icons';

export type ClubRole = 'owner' | 'admin' | 'staff' | 'player' | 'member' | 'supporter' | 'Player' | 'Executive committe' | 'Manager' | 'Executive Committee';
export type PlayerPosition = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'SUB';
export type PlayerStatus = 'active' | 'inactive' | 'injured' | 'suspended' | 'alumni';

export type MatchStatus = 'upcoming' | 'live' | 'halftime' | 'completed' | 'postponed' | 'cancelled';
export type MatchPeriod = 'pre_match' | 'first_half' | 'halftime' | 'second_half' | 'extra_time' | 'penalties' | 'full_time';
export type MatchEventType = 'goal' | 'penalty' | 'own_goal' | 'yellow_card' | 'red_card' | 'sub' | 'var' | 'commentary' | 'whistle';
export type MatchType = 'internal' | 'friendly' | 'tournament';

export type EventCategory = 'match' | 'training' | 'social' | 'agm' | 'trial' | 'tournament';
export type SponsorTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'grassroots';
export type SponsorSizeScale = 'auto' | 'xl' | 'lg' | 'md' | 'sm';
export type SponsorPackageStatus = 'prospect' | 'confirmed' | 'paid' | 'expired' | 'cancelled';
export type InquiryType = 'General Inquiry' | 'Player Trial' | 'Sponsorship' | 'Media Request' | 'Youth Academy';

export type HeroPinType = 'event' | 'fixture' | 'news' | 'image';
export type SeasonStatus = 'active' | 'completed' | 'upcoming';
export type MembershipPaymentPolicy = 'require_payment' | 'allow_waiver' | 'auto_approve' | 'auto_approve_with_waiver';

export interface ClubSeason {
  id: string;
  club_id: string;
  name: string; // e.g. "2026/27" or "2026/2027"
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  is_current: boolean;
  status: SeasonStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HeroSliderPinnedItem {
  id: string;
  type: HeroPinType;
  target_id?: string; // id of referenced event, match, news article, or custom item
  title?: string; // custom title override
  subtitle?: string; // custom subtitle/summary override
  badge?: string; // custom tag pill e.g. "PINNED EVENT", "DERBY MATCHDAY", "BREAKING NEWS"
  image_url?: string; // custom background image or resolved target cover
  cta_label?: string; // custom button label
  cta_link?: string; // custom link destination
  is_active: boolean; // whether active in slider
  order: number; // sort order
}

export interface Club {
  id: string;
  owner_id?: string;
  slug: string;
  name: string;
  short_name: string;
  motto: string;
  founded_year: number;
  logo_url: string;
  banner_url: string;
  slider_images?: string[];
  hero_pinned_items?: HeroSliderPinnedItem[];
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  stadium_name: string;
  stadium_address: string;
  stadium_lat?: number;
  stadium_lng?: number;
  stadium_capacity: number;
  stadium_pitch_type: string;
  stadium_parking_info?: string;
  contact_email: string;
  contact_phone: string;
  custom_domain?: string;
  previous_slugs?: string[];
  current_season_id?: string;
  seasons?: ClubSeason[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  /** How memberships renew (set through set_membership_renewal(); not synced) */
  membership_renewal?: 'anniversary' | 'fiscal';
  /** 1-12: the fiscal year starts on the 1st of this month */
  fiscal_year_start_month?: number;
  /** Fiscal year: joining this many days (or fewer) before it starts counts for the next year */
  fiscal_grace_days?: number;
  /** Membership signup payment policy (set through set_membership_payment_policy(); not synced) */
  membership_payment_policy?: MembershipPaymentPolicy;
  /** Free supporter sign-ups are approved straight away (set through set_auto_approve_free(); 20261120) */
  auto_approve_free?: boolean;
  /** Home-screen icons drawn from the crest (lib/app-icons.ts) */
  app_icons?: AppIcons | null;
  /** Whether U18 teams count as junior (default true) */
  junior_includes_u18?: boolean;
  /** Welfare / safeguarding officer, shown on junior team pages */
  welfare_officer_name?: string;
  welfare_officer_email?: string;
  welfare_officer_phone?: string;
  /** The club's story for the About page: news-editor HTML (sanitised when shown) */
  about_story?: string;
  /** Free-form JSON; `kind: 'event'` marks a tournament-only club behind a public tournament page (lib/public-tournaments.ts) */
  config?: ClubConfig;
}

export interface ClubConfig {
  kind?: 'event';
  /** Public tournament pages: who runs it, shown under the title */
  organiser?: string;
  /** Public tournament pages: e.g. '6-a-side' */
  team_size?: string;
  /** Public tournament pages: shown in a "Thanks to our sponsors" row */
  sponsors?: { name: string; url?: string }[];
  [key: string]: unknown;
}

export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface ClubMember {
  id: string;
  club_id: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  email: string;
  phone?: string;
  role: ClubRole;
  roles?: string[];
  player_position?: PlayerPosition;
  secondary_positions?: PlayerPosition[];
  jersey_number?: number;
  photo_url?: string;
  date_of_birth?: string;
  nationality?: string;
  preferred_foot?: 'Right' | 'Left' | 'Both';
  height_cm?: number;
  weight_kg?: number;
  status: PlayerStatus;
  membership_status?: MembershipStatus;
  applied_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  application_notes?: string;
  emergency_contact?: string;
  qr_code_token: string;
  membership_tier: string;
  membership_expires_at: string;
  /** Start of the current membership term (set by payments; read-only, not synced) */
  membership_starts_at?: string | null;
  /** When the applicant accepted the terms / a guardian consented (set on applying; read-only, not synced) */
  terms_accepted_at?: string | null;
  guardian_consent_at?: string | null;
  /** The team the applicant asked to join (set on applying; read-only, not synced) */
  requested_team_id?: string | null;
  /** Parent or guardian (juniors); never in a public view */
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  /** Photo consent given by the guardian: true / false, null or missing = not asked yet */
  photo_consent?: boolean | null;
  /** Staff background check (e.g. DBS / Working With Children); expiry drives the admin warnings */
  safeguarding_check_type?: string;
  safeguarding_check_date?: string;
  safeguarding_check_expiry_date?: string;
  /** Set by the public member view for players of a junior team (read-only, not synced) */
  is_junior?: boolean;
  is_executive: boolean;
  executive_title?: string;
  executive_bio?: string;
  executive_order?: number;
  executive_season?: string;
  /** Fee waiver info when an admin waives the membership fee */
  fee_waived_at?: string | null;
  fee_waived_by?: string | null;
  fee_waiver_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Squad management stores roles as a capitalized multi-select array (e.g. ['Player', 'Manager'])
// while legacy `role` is a comma-joined string in the same casing. Always check both, case-insensitively.
export function isPlayerMember(member: Pick<ClubMember, 'role' | 'roles'>): boolean {
  if (Array.isArray(member.roles) && member.roles.length > 0) {
    return member.roles.some(r => r.toLowerCase() === 'player');
  }
  if (!member.role) return false;
  return member.role.split(',').some(r => r.trim().toLowerCase() === 'player');
}

// Tournament fixtures and internal friendlies are played between the club's own teams (tournament
// matches store is_club_home = true whoever plays), so their scores aren't the club's results.
export function countsTowardClubRecord(match: Pick<Match, 'tournament_id' | 'match_type'>): boolean {
  return !match.tournament_id && match.match_type !== 'internal';
}

/** Permission level behind the squad role labels, e.g. 'Player, Club Admin, Manager' -> 'admin' */
export function toClubRole(role?: string | null, roles?: string[] | null): 'owner' | 'admin' | 'staff' | 'player' | 'member' | 'supporter' {
  const labels = [...(roles || []), ...(role || '').split(',')].map(r => r.trim().toLowerCase());
  if (labels.includes('owner')) return 'owner';
  if (labels.includes('admin') || labels.includes('club admin')) return 'admin';
  if (labels.some(l => ['staff', 'manager', 'coach', 'executive committee', 'executive committe'].includes(l))) return 'staff';
  if (labels.includes('player')) return 'player';
  if (labels.includes('supporter')) return 'supporter';
  return 'member';
}

export interface PlayerStats {
  id: string;
  club_id: string;
  member_id: string;
  season: string;
  appearances: number;
  minutes_played: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  yellow_cards: number;
  red_cards: number;
  motm_awards: number;
}

export interface PitchPosition {
  id: string;
  member_id?: string;
  name: string;
  number: number;
  position: string;
  x: number; // percentage from left (0 - 100)
  y: number; // percentage from top (0 - 100)
  role?: string;
  is_captain?: boolean;
}

export interface Match {
  id: string;
  club_id: string;
  title?: string;
  match_type?: MatchType;
  competition: string;
  season: string;
  opponent_name?: string;
  opponent_short_name?: string;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string;
  away_team_logo: string;
  is_club_home: boolean;
  match_date: string;
  match_time?: string;
  venue: string;
  match_flyer_url?: string;
  description?: string;
  status: MatchStatus;
  featured_on_hero?: boolean;
  door_qr_checkin_enabled?: boolean;
  checkin_count?: number;
  home_score: number;
  away_score: number;
  current_minute: number;
  /** When the current period (re)started; the live minute is current_minute + time elapsed since */
  period_started_at?: string;
  /** Freezes the live clock at current_minute (e.g. injury or stoppage) without leaving the 'live' status/period */
  is_paused?: boolean;
  added_time: number;
  period: MatchPeriod;
  home_formation?: string;
  away_formation?: string;
  home_lineup_coords?: PitchPosition[];
  away_lineup_coords?: PitchPosition[];
  match_format?: MatchFormat;
  is_audited?: boolean;
  audited_at?: string;
  // Tournament bracket & tiesheet fields
  tournament_id?: string;
  tournament_stage?: 'group' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final' | 'third_place';
  tournament_group?: string;
  tournament_round?: number;
  tournament_match_number?: number;
  home_team_source?: string;
  away_team_source?: string;
  home_penalty_score?: number;
  away_penalty_score?: number;
  winner_side?: 'home' | 'away';
  next_match_id?: string;
  next_match_slot?: 'home' | 'away';
  /** The club team playing this fixture (club_teams); none for internal and tournament matches */
  team_id?: string | null;
  /** The ground in the public grounds directory (grounds); venue stays the text every screen shows */
  ground_id?: string | null;
  /** Which pitch at that ground, e.g. 'Pitch 2' */
  pitch_label?: string | null;
  /** Its readable URL (set by a database trigger; missing until migration 20261117_match_slugs.sql runs).
   *  Never written by the app, so not in TABLE_COLUMNS. */
  slug?: string | null;
  /** Slugs it had before its teams or date changed, which still lead to it */
  previous_slugs?: string[];
  created_at?: string;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  club_id: string;
  minute: number;
  added_minute?: number;
  event_type: MatchEventType;
  team_side: 'home' | 'away';
  player_name: string;
  assist_player_name?: string;
  detail_text?: string;
  created_at?: string;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  title: string;
  description: string;
  category: EventCategory;
  season?: string;
  start_time: string;
  end_time?: string;
  location: string;
  max_capacity: number;
  rsvp_count: number;
  is_public: boolean;
  door_qr_checkin_enabled?: boolean;
  /** > 0: a paid, ticketed event (supabase/migrations/20261018_event_tickets.sql) */
  ticket_price_cents?: number;
  /** What an active member pays per ticket (migration 20261143); blank = ticket_price_cents */
  ticket_member_price_cents?: number | null;
  /** Flyer / poster image; '' or missing = none (supabase/migrations/20261115_event_flyers.sql) */
  flyer_url?: string;
  created_at?: string;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  club_id: string;
  member_id?: string;
  attendee_name: string;
  attendee_email?: string;
  checkin_status: 'registered' | 'checked_in' | 'cancelled';
  checked_in_at?: string;
  qr_ticket_code: string;
  /** The ticket order that created this attendee */
  payment_id?: string | null;
}

export interface Sponsor {
  id: string;
  club_id: string;
  /** When set, this sponsor is scoped to one event instead of the whole club - it only
   * appears on that event's detail page, not the club's general sponsor showcase. */
  event_id?: string | null;
  name: string;
  logo_url: string;
  website_url?: string;
  tier: SponsorTier;
  /** Badge text typed by the admin; blank shows the tier name (see sponsorLabel) */
  label?: string | null;
  size_scale?: SponsorSizeScale;
  display_order: number;
  is_active: boolean;
  // Sponsorship deal / CRM fields - admin-only, never exposed on the public site
  // (see sponsors_public view / "Club admin sponsors read own club" RLS policy).
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  package_value?: number | null;
  package_status?: SponsorPackageStatus;
  season?: string;
  /** Last day on the site (YYYY-MM-DD); blank means no end date. Migration 20261132. */
  ends_on?: string | null;
  /** When the payment or renewal link was last emailed to them */
  link_sent_at?: string | null;
  /** Which link that was (SPE-16). Set by the server, migration 20261136 */
  link_kind?: 'payment' | 'renewal' | null;
  /** First time they went on the site (SPE-6): one hidden after that isn't a new sign-up. Set by a
   *  database trigger, migration 20261136 */
  went_live_at?: string | null;
  /** Whether the club used or kept the old logo or website they last sent (SPE-17). Set by the
   *  server, migration 20261136 */
  change_reviewed?: 'used' | 'kept' | null;
  change_reviewed_at?: string | null;
  // access_key, the secret in their page, payment and renewal links, is left out: the browser can't
  // read it (migration 20261138). Server code reads it with the service role (PortalSponsorRow).
  /** A logo or website the sponsor sent from their own page, waiting for an admin to tap Use it
   *  (migration 20261133). Cleared by Use it or Keep the old one. */
  pending_logo_url?: string | null;
  pending_website_url?: string | null;
  pending_sent_at?: string | null;
  /** The package they hold (SPP-4, migration 20261137): counts towards its max_sponsors. Set by the
   *  sign-up, payment, and the admin's Package choice */
  package_id?: string | null;
  /** Set by the database; read only */
  created_at?: string;
}

export interface NewsArticle {
  id: string;
  club_id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover_image_url: string;
  video_embed_url?: string;
  author_name: string;
  tags: string[];
  is_featured: boolean;
  published_at: string;
}

export interface MediaGalleryItem {
  id: string;
  club_id: string;
  title: string;
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url?: string;
  album_name: string;
  /** The photo shown on its album's cover; an album without one shows its newest photo */
  is_album_cover?: boolean;
  created_at?: string;
}

export interface ClubAnalytics {
  id: string;
  club_id: string;
  event_type: string;
  page_path: string | null;
  visitor_hash?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GateScanRecord {
  id: string;
  club_id: string;
  scan_type: 'pass_verification' | 'event_checkin' | 'match_checkin';
  token: string;
  member_id?: string;
  member_name: string;
  event_id?: string;
  event_title?: string;
  match_id?: string;
  match_title?: string;
  valid: boolean;
  scanned_at: string;
}

export interface ClubAnalyticsSummary {
  totalVisits: number;
  weeklyVisits: number[];
  weeklyDays: string[];
  matchCenterFans: number;
  gateScansCount: number;
  topSections: { name: string; views: string; count: number; color: string }[];
  deviceBreakdown: { name: string; percentage: string; color: string }[];
  recentGateScans: GateScanRecord[];
}

export type SponsorAnalyticsEventType = 'impression' | 'viewable_impression' | 'click';

export interface SponsorAnalyticsEvent {
  id: string;
  club_id: string;
  sponsor_id: string;
  event_type: SponsorAnalyticsEventType;
  placement?: string;
  device?: string;
  country?: string;
  visitor_hash?: string;
  dwell_ms?: number;
  created_at: string;
}

export interface SponsorPlacementStats {
  sponsorId: string;
  /** Placements this sponsor was actually seen in, e.g. 'footer_marquee', 'match_center_marquee' */
  placements: string[];
  impressions: number;
  viewableImpressions: number;
  clicks: number;
  uniqueReach: number;
  ctr: number;
  viewabilityRate: number;
  avgDwellMs: number;
  /** Where they were seen most, in plain words ("Home page"); null before any views */
  topPlacement: string | null;
}

export interface SponsorAnalyticsSummary {
  hasAnyData: boolean;
  totals: {
    impressions: number;
    viewableImpressions: number;
    clicks: number;
    uniqueReach: number;
    ctr: number;
    viewabilityRate: number;
    repeatExposureRate: number;
  };
  byDay: { day: string; impressions: number; clicks: number }[];
  bySponsor: Record<string, SponsorPlacementStats>;
  /** Views and clicks by where on the site, most seen first, in plain words */
  byPlacement: { placement: string; label: string; seen: number; clicks: number }[];
  byCountry: { country: string; count: number }[];
  byDevice: { name: string; percentage: string; color: string }[];
}

export interface ContactInquiry {
  id: string;
  club_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone?: string;
  inquiry_type: InquiryType;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  created_at?: string;
}

// ==============================================================================
// 17. GAMIFICATION & CLUBSCORE TYPES
// ==============================================================================

export type ClubScoreTier = 'Rookie' | 'Prospect' | 'First Team' | 'All-Star' | 'Club Legend';

export type GamificationEventType = 
  | 'training_checkin'
  | 'social_checkin'
  | 'match_appearance'
  | 'match_goal'
  | 'match_assist'
  | 'match_clean_sheet'
  | 'match_motm'
  | 'disciplinary_card'
  | 'streak_bonus'
  | 'admin_award';

export interface ClubBadge {
  id: string;
  name: string;
  description: string;
  icon: string; // Key / SVG identifier or R2 URL
  tier_required?: ClubScoreTier;
  unlocked_at?: string;
}

export interface ClubScoreProfile {
  id: string;
  club_id: string;
  member_id: string;
  season: string;
  total_points: number;
  weekly_points: number;
  monthly_points: number;
  current_streak: number; // Consecutive weeks with verified activity
  highest_streak: number;
  tier: ClubScoreTier;
  badges: ClubBadge[];
  last_activity_date?: string;
  streak_updated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClubScoreRuleConfig {
  id?: string;
  club_id: string;
  points_training_checkin: number;
  points_social_checkin: number;
  points_match_appearance: number;
  points_goal_forward: number;
  points_goal_midfielder: number;
  points_goal_defender: number;
  points_assist: number;
  points_clean_sheet_gk_def: number;
  points_motm: number;
  points_yellow_card_penalty: number;
  points_red_card_penalty: number;
  streak_multiplier_3w: number; // e.g. 1.15
  streak_multiplier_5w: number; // e.g. 1.25
  streak_multiplier_10w: number; // e.g. 1.50
  is_active: boolean;
}

export interface GamificationActivityLog {
  id: string;
  club_id: string;
  member_id: string;
  event_type: GamificationEventType;
  points_awarded: number;
  multiplier: number;
  final_points: number;
  description: string;
  reference_id?: string;
  created_by?: string;
  created_at: string;
}

// ==============================================================================
// 7. MATCHDAY & COACHING TOOLS (SquadGod parity)
// ==============================================================================
export type MatchFormat = '11v11' | '9v9' | '7v7';
export type AvailabilityStatus = 'available' | 'unavailable' | 'maybe' | 'pending';

export interface PlayerAvailability {
  id: string;
  club_id: string;
  match_id?: string;
  event_id?: string;
  member_id: string;
  status: AvailabilityStatus;
  note?: string;
  response_token: string;
  responded_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DraftLineup {
  id: string;
  club_id: string;
  match_id: string;
  format: MatchFormat;
  formation: string;
  lineup_coords: PitchPosition[];
  bench_member_ids: string[];
  tactical_notes?: string;
  is_published: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MatchAuditItem {
  id: string;
  minute: number;
  event_type: 'goal' | 'penalty' | 'yellow_card' | 'red_card';
  team_side: 'home' | 'away';
  player_name: string;
  player_id?: string;
  assist_player_name?: string;
  assist_player_id?: string;
}

export interface MatchAuditPayload {
  match_id: string;
  clean_sheet_member_ids: string[];
  motm_member_id?: string;
  appearance_member_ids: string[];
  /** Minutes each player was on the pitch, where the lineup and subs recorded it */
  minutes_by_member?: Record<string, number>;
  audited_events: MatchAuditItem[];
  notes?: string;
}

// ==============================================================================
// 22. MEMBER PORTAL & MESSAGING TYPES
// ==============================================================================
export type MemberMessageCategory = 'General' | 'Ticket / Pass' | 'Availability' | 'Medical' | 'Kit & Gear' | 'Committee';

export interface MemberMessage {
  id: string;
  club_id: string;
  member_id: string;
  sender_type: 'member' | 'admin';
  sender_name: string;
  sender_email?: string;
  subject?: string;
  category?: MemberMessageCategory;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ClubSeasonStatsSummary {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
  cleanSheets: number;
  form: ('W' | 'D' | 'L')[];
  topScorer?: { name: string; goals: number };
}

export interface MemberApplicationInput {
  full_name: string;
  email: string;
  phone?: string;
  membership_tier: string;
  player_position?: PlayerPosition;
  jersey_number?: number;
  application_notes?: string;
  emergency_contact?: string;
  /** Chosen on the form; only these two are allowed for a public application */
  role?: 'player' | 'supporter';
  date_of_birth?: string;
  terms_accepted?: boolean;
  guardian_consent?: boolean;
  /** Clubs with several teams: the team a player asks to join */
  requested_team_id?: string;
  /** Juniors: the parent or guardian, and whether they allow photos of the child publicly */
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  photo_consent?: boolean;
}

// ==============================================================================
// 22b. CLUB TEAMS (first team, reserves, academy, youth age groups)
// Not the same as internal teams below, which are sides for tournaments and internal matches.
// ==============================================================================
export type ClubTeamType = 'senior' | 'reserve' | 'academy' | 'youth' | 'women' | 'veterans' | 'other';
export type ClubTeamGender = 'mixed' | 'boys' | 'girls' | 'men' | 'women';
export type ClubTeamFormat = '5v5' | '7v7' | '9v9' | '11v11';
export type ClubTeamRole = 'player' | 'coach' | 'assistant' | 'manager' | 'physio' | 'other';

export interface ClubTeam {
  id: string;
  club_id: string;
  name: string;
  short_name?: string;
  slug: string;
  team_type: ClubTeamType;
  /** U5 ... U23; none = open age */
  age_group?: string;
  gender: ClubTeamGender;
  is_junior: boolean;
  hide_public_scores: boolean;
  match_format: ClubTeamFormat;
  color?: string;
  logo_url?: string;
  description?: string;
  sort_order: number;
  /** The club's main team: fixtures with no team belong here */
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClubTeamMember {
  id: string;
  club_id: string;
  team_id: string;
  member_id: string;
  team_role: ClubTeamRole;
  jersey_number?: number;
  is_active?: boolean;
  created_at?: string;
}

// ==============================================================================
// 23. TOURNAMENTS & INTERNAL TEAMS ENGINE (Challonge for Football)
// ==============================================================================
export type TournamentFormat = 'knockout' | 'league' | 'group_knockout';
export type TournamentStatus = 'draft' | 'ongoing' | 'completed';

export interface InternalTeam {
  id: string;
  club_id: string;
  name: string;
  short_name: string;
  color: string;
  logo_url: string;
  cover_url?: string;
  captain_id?: string;
  coach_name?: string;
  player_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  slug: string;
  season: string;
  format: TournamentFormat;
  status: TournamentStatus;
  points_win: number;
  points_draw: number;
  points_loss: number;
  group_count?: number;
  teams_advancing_per_group?: number;
  has_third_place_match?: boolean;
  start_date: string;
  end_date?: string;
  venue?: string;
  description?: string;
  banner_url?: string;
  /** Player of the Tournament award (saved directly, not by the background sync) */
  player_of_tournament_member_id?: string | null;
  player_of_tournament_name?: string | null;
  player_of_tournament_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  team_type: 'internal' | 'external';
  internal_team_id?: string;
  name: string;
  short_name: string;
  logo_url: string;
  color?: string;
  seed?: number;
  group?: string; // 'A', 'B', 'C', etc.
}

export interface TournamentStanding {
  team_id: string;
  name: string;
  short_name: string;
  logo_url: string;
  group?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}


// ==============================================================================
// Finance (supabase/migrations/20261010_finance.sql). Read and written directly, not synced.
// ==============================================================================
export type PaymentKind = 'membership_signup' | 'membership_renewal' | 'sponsorship' | 'shop_order' | 'event_ticket' | 'income_other';
export type PaymentMethod = 'stripe' | 'bank_transfer' | 'cash' | 'other';
export type PaymentStatus = 'pending' | 'awaiting_review' | 'paid' | 'rejected' | 'refunded' | 'failed';

export interface ClubPaymentSettings {
  club_id: string;
  currency: string;
  bank_details?: string | null;
  /** Server only: not readable from the browser (migration 20261116). Use stripe_connected. */
  stripe_account_id?: string | null;
  stripe_charges_enabled: boolean;
  /** Whether a Stripe account is linked, finished or not (generated from stripe_account_id) */
  stripe_connected?: boolean;
  /** Printed on sponsorship invoices (migration 20261133); digits only */
  abn?: string | null;
  /** GST-registered clubs issue a "Tax invoice" showing the GST included */
  gst_registered?: boolean;
}

/** The club_payment_settings columns the browser may read (the Stripe account id stays on the server) */
export const PUBLIC_PAYMENT_SETTINGS = 'club_id, currency, bank_details, stripe_charges_enabled';

export interface MembershipPlan {
  id: string;
  club_id: string;
  /** Plan for one team only (e.g. junior fees); none = every team */
  team_id?: string | null;
  /** Who can choose it on the Join page: everyone, under 18s or adults (migration 20261123) */
  audience?: 'all' | 'junior' | 'adult';
  name: string;
  description?: string | null;
  price_cents: number;
  duration_months: number;
  is_active: boolean;
  sort_order: number;
}

/** An offer members get, usually from a sponsor (migration 20261141). Admins edit club_perks;
 *  everyone else reads club_perks_public, which only has the live ones */
export interface ClubPerk {
  id: string;
  club_id: string;
  sponsor_id?: string | null;
  title: string;
  details?: string | null;
  /** Typed by the admin when there's no sponsor; club_perks_public fills it from the sponsor */
  business_name?: string | null;
  url?: string | null;
  /** Last day it shows (YYYY-MM-DD); blank means no end date */
  ends_on?: string | null;
  /** Admin rows only (club_perks_public leaves it out: every row there is live) */
  is_active?: boolean;
  sort_order: number;
  /** club_perks_public only: the sponsor's logo */
  logo_url?: string | null;
  /** From club_perk_codes (admins) or my_perk_codes (active members); never public */
  code?: string | null;
}

export interface SponsorshipPackage {
  id: string;
  club_id: string;
  name: string;
  tier: SponsorTier;
  price_cents: number;
  benefits?: string | null;
  /** The ticks on the public package card: PACKAGE_INCLUDES keys, then extras the club typed
   *  (migration 20261134). Display only. */
  includes?: string[];
  /** How many of this package the club can sell; blank means no limit (SPP-4, migration 20261137) */
  max_sponsors?: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface Payment {
  id: string;
  club_id: string;
  kind: PaymentKind;
  category: string;
  member_id?: string | null;
  sponsor_id?: string | null;
  plan_id?: string | null;
  package_id?: string | null;
  description?: string | null;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  payer_name?: string | null;
  payer_email?: string | null;
  reference?: string | null;
  receipt_key?: string | null;
  season?: string | null;
  notes?: string | null;
  rejection_reason?: string | null;
  paid_at?: string | null;
  /** Shop orders: what was bought, and when the club handed it over */
  items?: OrderItem[] | null;
  fulfilled_at?: string | null;
  /** Ticket orders: the event the tickets are for */
  event_id?: string | null;
  /** Sponsorships: the period this payment pays for (SPE-14, migration 20261136) */
  covers_from?: string | null;
  covers_until?: string | null;
  /** The club's invoice number for it, once one was given (migration 20261133) */
  invoice_number?: number | null;
  /** An invoice sent before payment is due by this day (SPP-2, migration 20261137) */
  due_on?: string | null;
  created_at: string;
}

// Club shop (supabase/migrations/20261017_club_shop.sql)
export interface ShopProduct {
  id: string;
  club_id: string;
  name: string;
  description?: string | null;
  photos: string[];
  sizes: string[];
  price_cents: number;
  /** What an active member pays (migration 20261143); blank = price_cents */
  member_price_cents?: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface Expense {
  id: string;
  club_id: string;
  category: string;
  description: string;
  vendor?: string | null;
  amount_cents: number;
  currency: string;
  spent_on: string;
  method: 'bank_transfer' | 'card' | 'cash' | 'other';
  receipt_key?: string | null;
  paid_by_member_id?: string | null;
  reimbursed: boolean;
  season?: string | null;
  created_at: string;
}

// ------------------------------------------------------------------------------------------------
// Platform Owner / Super-Admin (supabase/migrations/20261112_platform_admin_and_metrics.sql)
// ------------------------------------------------------------------------------------------------
export interface PlatformAdmin {
  id: string;
  user_id?: string | null;
  email: string;
  full_name?: string | null;
  role: 'super_admin' | 'operator' | 'analyst';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformDailyTrend {
  date: string;
  clubs: number;
  users: number;
  members: number;
  visits: number;
  revenue_cents: number;
}

export interface PlatformTopClub {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string | null;
  is_active: boolean;
  members: number;
  teams: number;
  visits: number;
  gmv_cents: number;
}

export interface PlatformSignupFunnel {
  paid: number;
  awaiting_review: number;
  unpaid_pending: number;
  fee_waived: number;
  direct_approved: number;
}

export interface PlatformRecentActivity {
  type: 'club_created' | 'member_signup' | 'payment_received' | 'gate_scan';
  title: string;
  subtitle: string;
  created_at: string;
}

export interface PlatformMetrics {
  period_days: number;
  total_clubs: number;
  active_clubs: number;
  new_clubs_period: number;
  total_users: number;
  new_users_period: number;
  total_members: number;
  members_pending: number;
  members_approved: number;
  members_rejected: number;
  members_waived: number;
  paid_signups_count: number;
  paid_signups_cents: number;
  total_gmv_cents: number;
  period_gmv_cents: number;
  total_visits_period: number;
  club_visits_period: number;
  platform_visits_period: number;
  daily_trends: PlatformDailyTrend[];
  top_clubs: PlatformTopClub[];
  funnel: PlatformSignupFunnel;
  recent_activity: PlatformRecentActivity[];
}

export interface PlatformClubItem {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  logo_url?: string | null;
  banner_url?: string | null;
  primary_color?: string | null;
  is_active: boolean;
  created_at: string;
  owner_id?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  custom_domain?: string | null;
  membership_payment_policy: MembershipPaymentPolicy;
  member_count: number;
  pending_count: number;
  team_count: number;
  match_count: number;
  visits_30d: number;
  gmv_cents: number;
  stripe_ready: boolean;
}

export interface PlatformUserMembership {
  club_id: string;
  club_name: string;
  club_slug: string;
  role: string;
  membership_status: string;
  membership_tier: string;
  fee_waived: boolean;
}

export interface PlatformUserItem {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  is_super_admin: boolean;
  clubs_owned_count: number;
  memberships_count: number;
  memberships: PlatformUserMembership[];
}

export interface PlatformHealthStats {
  server_timestamp: string;
  counts: {
    clubs: number;
    members: number;
    payments: number;
    matches: number;
    events: number;
    gate_scans: number;
    analytics: number;
  };
  status: string;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  target: 'all' | 'admins' | 'members' | 'public';
  link_url?: string | null;
  link_text?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  expires_at?: string | null;
}

