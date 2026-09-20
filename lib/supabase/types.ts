// ==============================================================================
// itsfootball.club: Complete TypeScript Database Models & Types
// ==============================================================================

export type ClubRole = 'owner' | 'admin' | 'staff' | 'player' | 'member' | 'supporter' | 'Player' | 'Executive committe' | 'Manager' | 'Executive Committee';
export type PlayerPosition = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'SUB';
export type PlayerStatus = 'active' | 'inactive' | 'injured' | 'suspended' | 'alumni';

export type MatchStatus = 'upcoming' | 'live' | 'halftime' | 'completed' | 'postponed' | 'cancelled';
export type MatchPeriod = 'pre_match' | 'first_half' | 'halftime' | 'second_half' | 'extra_time' | 'penalties' | 'full_time';
export type MatchEventType = 'goal' | 'penalty' | 'own_goal' | 'yellow_card' | 'red_card' | 'sub' | 'var' | 'commentary' | 'whistle';

export type EventCategory = 'match' | 'training' | 'social' | 'agm' | 'trial' | 'tournament';
export type SponsorTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'grassroots';
export type InquiryType = 'General Inquiry' | 'Player Trial' | 'Sponsorship' | 'Media Request' | 'Youth Academy';

export type HeroPinType = 'event' | 'fixture' | 'news' | 'image';
export type SeasonStatus = 'active' | 'completed' | 'upcoming';

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
  photo_url: string;
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
  password_hash?: string;
  magic_token?: string;
  magic_token_expires_at?: string;
  application_notes?: string;
  emergency_contact?: string;
  qr_code_token: string;
  membership_tier: string;
  membership_expires_at: string;
  is_executive: boolean;
  executive_title?: string;
  executive_bio?: string;
  executive_order?: number;
  executive_season?: string;
  created_at?: string;
  updated_at?: string;
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
  competition: string;
  season: string;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string;
  away_team_logo: string;
  is_club_home: boolean;
  match_date: string;
  venue: string;
  status: MatchStatus;
  home_score: number;
  away_score: number;
  current_minute: number;
  added_time: number;
  period: MatchPeriod;
  home_formation?: string;
  away_formation?: string;
  home_lineup_coords?: PitchPosition[];
  away_lineup_coords?: PitchPosition[];
  match_format?: MatchFormat;
  is_audited?: boolean;
  audited_at?: string;
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
}

export interface Sponsor {
  id: string;
  club_id: string;
  name: string;
  logo_url: string;
  website_url?: string;
  tier: SponsorTier;
  display_order: number;
  is_active: boolean;
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
  created_at?: string;
}

export interface ClubAnalytics {
  id: string;
  club_id: string;
  event_type: string;
  page_path: string;
  visitor_hash?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GateScanRecord {
  id: string;
  club_id: string;
  scan_type: 'pass_verification' | 'event_checkin';
  token: string;
  member_id?: string;
  member_name: string;
  event_id?: string;
  event_title?: string;
  valid: boolean;
  scanned_at: string;
}

export interface ClubAnalyticsSummary {
  totalVisits: number;
  weeklyVisits: number[];
  weeklyDays: string[];
  matchCenterFans: number;
  gateScansCount: number;
  avgDuration: string;
  topSections: { name: string; views: string; count: number; color: string }[];
  deviceBreakdown: { name: string; percentage: string; color: string }[];
  recentGateScans: GateScanRecord[];
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
  points: number;
  winRate: number;
  cleanSheets: number;
  form: ('W' | 'D' | 'L')[];
  topScorer?: { name: string; goals: number };
}

export interface MemberApplicationInput {
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
  membership_tier: string;
  player_position?: PlayerPosition;
  jersey_number?: number;
  application_notes?: string;
  emergency_contact?: string;
}
