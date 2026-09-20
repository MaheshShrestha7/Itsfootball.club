import {
  Club,
  ClubMember,
  PlayerStats,
  Match,
  MatchEvent,
  ClubEvent,
  Sponsor,
  NewsArticle,
  MediaGalleryItem,
  ClubAnalytics,
  ContactInquiry,
  ClubScoreProfile,
  GamificationActivityLog,
  ClubScoreRuleConfig,
  ClubBadge,
  PlayerAvailability,
  DraftLineup,
  ClubSeason
} from './supabase/types';

// ==============================================================================
// 1. CLUBS
// ==============================================================================
export const INITIAL_CLUBS: Club[] = [
  {
    id: 'club-apex-01',
    owner_id: 'user-elena-vance-admin',
    slug: 'apex-city-fc',
    name: 'Apex City FC',
    short_name: 'ACFC',
    motto: 'Rise As One, Rule The Pitch',
    founded_year: 2018,
    logo_url: '/crests/apex-city.svg',
    banner_url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
    slider_images: [
      'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1489944445391-11dd35366433?w=1600&auto=format&fit=crop&q=80',
    ],
    hero_pinned_items: [
      {
        id: 'pin-fixture-01',
        type: 'fixture',
        target_id: 'match-live-01',
        title: 'Apex City FC vs Metro Rovers',
        subtitle: 'Premier Metropolitan League • Live Pitchside Broadcast',
        badge: 'PINNED MATCHDAY',
        is_active: true,
        order: 1,
      },
      {
        id: 'pin-news-01',
        type: 'news',
        target_id: 'news-01',
        title: 'Dante Moreno Surpasses 25-Goal Milestone in Sensational Campaign',
        subtitle: 'Our Argentine forward reached another career highpoint, scoring against Metro Rovers and propelling Apex City to the summit.',
        badge: 'FEATURED STORY',
        is_active: true,
        order: 2,
      },
      {
        id: 'pin-event-01',
        type: 'event',
        target_id: 'evt-01',
        title: 'First Team Open Training & Fan Meet',
        subtitle: 'Come watch Coach Morales lead tactical drills ahead of the derby. Autograph & photo session on the pitch immediately following training.',
        badge: 'UPCOMING TRAINING',
        is_active: true,
        order: 3,
      },
      {
        id: 'pin-event-02',
        type: 'event',
        target_id: 'evt-02',
        title: 'Annual Club Gala & Championship Dinner',
        subtitle: 'Black tie celebration honoring player achievements, sponsor recognition, and academy graduates. Formal 3-course dinner and live auction.',
        badge: 'CLUB GALA',
        is_active: true,
        order: 4,
      },
      {
        id: 'pin-image-01',
        type: 'image',
        image_url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
        title: 'Official Season Pass 2026/27',
        subtitle: 'Secure guaranteed entry to all home fixtures, VIP member lounge access, and exclusive kit discount.',
        badge: 'MEMBERSHIP SPOTLIGHT',
        cta_label: 'Get Season Pass',
        cta_link: '/membership',
        is_active: true,
        order: 5,
      }
    ],
    primary_color: '#10B981', // Emerald green
    secondary_color: '#0F172A', // Deep dark slate
    accent_color: '#F59E0B', // Championship Gold
    stadium_name: 'Apex Park Stadium',
    stadium_address: '450 Champions Way, Sector 4, Metro City',
    stadium_lat: 40.7128,
    stadium_lng: -74.006,
    stadium_capacity: 12500,
    stadium_pitch_type: 'Hybrid Grass (FIFA Pro Quality)',
    stadium_parking_info: 'East & West Gate parking open 2 hours prior to kickoff. VIP pass holders access Gate 3.',
    contact_email: 'office@apexcityfc.com',
    contact_phone: '+1 (555) 234-5678',
    custom_domain: 'apexcityfc.club',
    is_active: true,
  },
  {
    id: 'club-titan-02',
    slug: 'titan-athletic-fc',
    name: 'Titan Athletic FC',
    short_name: 'TAFC',
    motto: 'Strength In Unity, Pride In Battle',
    founded_year: 2020,
    logo_url: '/crests/red-lions.svg',
    banner_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
    slider_images: [
      'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
    ],
    primary_color: '#2563EB', // Electric Cobalt Blue
    secondary_color: '#090D16', // Obsidian Black
    accent_color: '#EF4444', // Crimson Flame
    stadium_name: 'Titan Colosseum',
    stadium_address: '12 Ironworks Boulevard, Port District',
    stadium_lat: 41.8781,
    stadium_lng: -87.6298,
    stadium_capacity: 8800,
    stadium_pitch_type: 'Natural Monofilament Turf',
    stadium_parking_info: 'North lot park-and-ride with tram connection.',
    contact_email: 'contact@titanathletic.club',
    contact_phone: '+1 (555) 876-5432',
    custom_domain: 'titanathletic.club',
    is_active: true,
  }
];

// ==============================================================================
// 1.5 CLUB SEASONS
// ==============================================================================
export const INITIAL_SEASONS: ClubSeason[] = [
  // Apex City FC / Red Lions FC
  {
    id: 'season-2026-27',
    club_id: 'club-apex-01',
    name: '2026/27',
    start_date: '2026-08-01',
    end_date: '2027-05-31',
    is_current: true,
    status: 'active',
    notes: 'Current ongoing championship campaign across league and cup fixtures.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'season-2025-26',
    club_id: 'club-apex-01',
    name: '2025/26',
    start_date: '2025-08-01',
    end_date: '2026-05-30',
    is_current: false,
    status: 'completed',
    notes: 'Historic season finishing top 3 and qualifying for Metropolitan Super Cup.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'season-2027-28',
    club_id: 'club-apex-01',
    name: '2027/28',
    start_date: '2027-08-01',
    end_date: '2028-05-31',
    is_current: false,
    status: 'upcoming',
    notes: 'Upcoming centenary expansion season.',
    created_at: new Date().toISOString(),
  },
  // Titan Athletic FC
  {
    id: 'season-titan-2026-27',
    club_id: 'club-titan-02',
    name: '2026/27',
    start_date: '2026-08-01',
    end_date: '2027-05-31',
    is_current: true,
    status: 'active',
    notes: 'Active premier division challenge.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'season-titan-2025-26',
    club_id: 'club-titan-02',
    name: '2025/26',
    start_date: '2025-08-01',
    end_date: '2026-05-30',
    is_current: false,
    status: 'completed',
    notes: 'Consolidation season.',
    created_at: new Date().toISOString(),
  },
];

// ==============================================================================
// 2. CLUB MEMBERS & SQUAD
// ==============================================================================
export const INITIAL_MEMBERS: ClubMember[] = [
  // Apex City FC Executive & Staff
  {
    id: 'mem-apex-01',
    club_id: 'club-apex-01',
    full_name: 'Eleanor Vance',
    email: 'president@apexcityfc.com',
    role: 'owner',
    photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    status: 'active',
    qr_code_token: 'apex-pass-exec-01',
    membership_tier: 'Executive Board',
    membership_expires_at: '2027-12-31',
    is_executive: true,
    executive_title: 'Club President & Founder',
    executive_bio: 'Former national athlete and sports technology leader, spearheading Apex City FC since inception.',
    executive_order: 1,
    executive_season: '2026/27',
  },
  {
    id: 'mem-apex-02',
    club_id: 'club-apex-01',
    full_name: 'Diego Morales',
    email: 'coach@apexcityfc.com',
    role: 'staff',
    photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80',
    status: 'active',
    qr_code_token: 'apex-pass-staff-02',
    membership_tier: 'Technical Staff',
    membership_expires_at: '2026-12-31',
    is_executive: true,
    executive_title: 'Head Coach (UEFA Pro)',
    executive_bio: 'Renowned tactician renowned for high-tempo attacking football and youth development.',
    executive_order: 2,
    executive_season: '2026/27',
  },
  {
    id: 'mem-apex-03',
    club_id: 'club-apex-01',
    full_name: 'Marcus Sterling',
    email: 'secretary@apexcityfc.com',
    role: 'admin',
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    status: 'active',
    qr_code_token: 'apex-pass-exec-03',
    membership_tier: 'Executive Board',
    membership_expires_at: '2026-12-31',
    is_executive: true,
    executive_title: 'Honorary Secretary',
    executive_bio: 'Oversees club compliance, member relations, and municipal league operations.',
    executive_order: 3,
    executive_season: '2026/27',
  },
  {
    id: 'mem-apex-04',
    club_id: 'club-apex-01',
    full_name: 'Chloe Chen',
    email: 'treasurer@apexcityfc.com',
    role: 'admin',
    photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
    status: 'active',
    qr_code_token: 'apex-pass-exec-04',
    membership_tier: 'Executive Board',
    membership_expires_at: '2026-12-31',
    is_executive: true,
    executive_title: 'Club Treasurer',
    executive_bio: 'Chartered accountant managing commercial partnerships and club financial governance.',
    executive_order: 4,
    executive_season: '2026/27',
  },

  // Apex City FC Squad Players
  {
    id: 'player-apex-01',
    club_id: 'club-apex-01',
    full_name: 'Julian Drake',
    email: 'drake@apexcityfc.com',
    role: 'player',
    player_position: 'CAM',
    jersey_number: 10,
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '1998-05-14',
    nationality: 'Spain',
    preferred_foot: 'Right',
    height_cm: 178,
    weight_kg: 72,
    status: 'active',
    qr_code_token: 'apex-player-pass-10',
    membership_tier: 'Senior Captain',
    membership_expires_at: '2026-11-30',
    is_executive: true,
    executive_title: 'First Team Captain',
    executive_bio: 'Team playmaker and talisman with over 75 appearances for the club.',
    executive_order: 5,
  },
  {
    id: 'player-apex-02',
    club_id: 'club-apex-01',
    full_name: 'Dante Moreno',
    email: 'moreno@apexcityfc.com',
    role: 'player',
    player_position: 'ST',
    jersey_number: 9,
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '2001-09-22',
    nationality: 'Argentina',
    preferred_foot: 'Left',
    height_cm: 184,
    weight_kg: 79,
    status: 'active',
    qr_code_token: 'apex-player-pass-09',
    membership_tier: 'Senior Striker',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  },
  {
    id: 'player-apex-03',
    club_id: 'club-apex-01',
    full_name: 'Marcus Thorne',
    email: 'thorne@apexcityfc.com',
    role: 'player',
    player_position: 'GK',
    jersey_number: 1,
    photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '1996-03-10',
    nationality: 'England',
    preferred_foot: 'Right',
    height_cm: 192,
    weight_kg: 86,
    status: 'active',
    qr_code_token: 'apex-player-pass-01',
    membership_tier: 'Senior Goalkeeper',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  },
  {
    id: 'player-apex-04',
    club_id: 'club-apex-01',
    full_name: 'Dominic Vance',
    email: 'vance.d@apexcityfc.com',
    role: 'player',
    player_position: 'CB',
    jersey_number: 4,
    photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '1999-12-04',
    nationality: 'Netherlands',
    preferred_foot: 'Right',
    height_cm: 189,
    weight_kg: 83,
    status: 'active',
    qr_code_token: 'apex-player-pass-04',
    membership_tier: 'Senior Defender',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  },
  {
    id: 'player-apex-05',
    club_id: 'club-apex-01',
    full_name: 'Leo Sterling',
    email: 'sterling.l@apexcityfc.com',
    role: 'player',
    player_position: 'LB',
    jersey_number: 3,
    photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '2002-02-18',
    nationality: 'France',
    preferred_foot: 'Left',
    height_cm: 175,
    weight_kg: 70,
    status: 'active',
    qr_code_token: 'apex-player-pass-03',
    membership_tier: 'Senior Defender',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  },
  {
    id: 'player-apex-06',
    club_id: 'club-apex-01',
    full_name: 'Tariq Al-Mansoor',
    email: 'almansoor@apexcityfc.com',
    role: 'player',
    player_position: 'RB',
    jersey_number: 2,
    photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '2000-08-30',
    nationality: 'Morocco',
    preferred_foot: 'Right',
    height_cm: 180,
    weight_kg: 74,
    status: 'active',
    qr_code_token: 'apex-player-pass-02',
    membership_tier: 'Senior Defender',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  },
  {
    id: 'player-apex-07',
    club_id: 'club-apex-01',
    full_name: 'Kieran O’Connor',
    email: 'kieran@apexcityfc.com',
    role: 'player',
    player_position: 'CDM',
    jersey_number: 6,
    photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '1997-11-12',
    nationality: 'Ireland',
    preferred_foot: 'Both',
    height_cm: 185,
    weight_kg: 81,
    status: 'active',
    qr_code_token: 'apex-player-pass-06',
    membership_tier: 'Senior Midfielder',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  },
  {
    id: 'player-apex-08',
    club_id: 'club-apex-01',
    full_name: 'Gabriel Santos',
    email: 'santos@apexcityfc.com',
    role: 'player',
    player_position: 'RW',
    jersey_number: 7,
    photo_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '2003-04-05',
    nationality: 'Brazil',
    preferred_foot: 'Left',
    height_cm: 176,
    weight_kg: 68,
    status: 'active',
    qr_code_token: 'apex-player-pass-07',
    membership_tier: 'Senior Winger',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  },
  {
    id: 'player-apex-09',
    club_id: 'club-apex-01',
    full_name: 'Kai Takahashi',
    email: 'kai@apexcityfc.com',
    role: 'player',
    player_position: 'LW',
    jersey_number: 11,
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    date_of_birth: '2001-07-19',
    nationality: 'Japan',
    preferred_foot: 'Right',
    height_cm: 173,
    weight_kg: 67,
    status: 'active',
    qr_code_token: 'apex-player-pass-11',
    membership_tier: 'Senior Winger',
    membership_expires_at: '2026-11-30',
    is_executive: false,
  }
];

// ==============================================================================
// 3. PLAYER STATS
// ==============================================================================
export const INITIAL_PLAYER_STATS: PlayerStats[] = [
  {
    id: 'stat-01',
    club_id: 'club-apex-01',
    member_id: 'player-apex-02', // Dante Moreno
    season: '2025/2026',
    appearances: 22,
    minutes_played: 1890,
    goals: 19,
    assists: 7,
    clean_sheets: 0,
    yellow_cards: 2,
    red_cards: 0,
    motm_awards: 6,
  },
  {
    id: 'stat-02',
    club_id: 'club-apex-01',
    member_id: 'player-apex-01', // Julian Drake
    season: '2025/2026',
    appearances: 21,
    minutes_played: 1810,
    goals: 11,
    assists: 14,
    clean_sheets: 0,
    yellow_cards: 3,
    red_cards: 0,
    motm_awards: 5,
  },
  {
    id: 'stat-03',
    club_id: 'club-apex-01',
    member_id: 'player-apex-08', // Gabriel Santos
    season: '2025/2026',
    appearances: 19,
    minutes_played: 1540,
    goals: 8,
    assists: 9,
    clean_sheets: 0,
    yellow_cards: 1,
    red_cards: 0,
    motm_awards: 3,
  },
  {
    id: 'stat-04',
    club_id: 'club-apex-01',
    member_id: 'player-apex-09', // Kai Takahashi
    season: '2025/2026',
    appearances: 20,
    minutes_played: 1620,
    goals: 9,
    assists: 6,
    clean_sheets: 0,
    yellow_cards: 2,
    red_cards: 0,
    motm_awards: 2,
  },
  {
    id: 'stat-05',
    club_id: 'club-apex-01',
    member_id: 'player-apex-03', // Marcus Thorne (GK)
    season: '2025/2026',
    appearances: 22,
    minutes_played: 1980,
    goals: 0,
    assists: 1,
    clean_sheets: 11,
    yellow_cards: 1,
    red_cards: 0,
    motm_awards: 3,
  },
  {
    id: 'stat-06',
    club_id: 'club-apex-01',
    member_id: 'player-apex-04', // Dominic Vance (CB)
    season: '2025/2026',
    appearances: 22,
    minutes_played: 1980,
    goals: 3,
    assists: 1,
    clean_sheets: 11,
    yellow_cards: 4,
    red_cards: 0,
    motm_awards: 2,
  }
];

// ==============================================================================
// 4. MATCHES
// ==============================================================================
export const INITIAL_MATCHES: Match[] = [
  // 1. Currently LIVE Match!
  {
    id: 'match-live-01',
    club_id: 'club-apex-01',
    competition: 'Premier Metropolitan League',
    season: '2026/27',
    home_team_name: 'Apex City FC',
    away_team_name: 'Metro Rovers',
    home_team_logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80',
    away_team_logo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100&auto=format&fit=crop&q=80',
    is_club_home: true,
    match_date: new Date().toISOString(),
    venue: 'Apex Park Stadium',
    status: 'live',
    home_score: 2,
    away_score: 1,
    current_minute: 71,
    added_time: 3,
    period: 'second_half',
    home_formation: '4-3-3 Attacking',
    away_formation: '4-4-2 Flat',
  },
  // 2. Upcoming High Stakes Derby
  {
    id: 'match-upcoming-02',
    club_id: 'club-apex-01',
    competition: 'Metropolitan Super Cup (Semi-Final)',
    season: '2026/27',
    home_team_name: 'Titan Athletic FC',
    away_team_name: 'Apex City FC',
    home_team_logo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100&auto=format&fit=crop&q=80',
    away_team_logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80',
    is_club_home: false,
    match_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // in 4 days
    venue: 'Titan Colosseum',
    status: 'upcoming',
    home_score: 0,
    away_score: 0,
    current_minute: 0,
    added_time: 0,
    period: 'pre_match',
    home_formation: '4-2-3-1',
    away_formation: '4-3-3',
  },
  // 3. Past Result
  {
    id: 'match-past-03',
    club_id: 'club-apex-01',
    competition: 'Premier Metropolitan League',
    season: '2025/26',
    home_team_name: 'Apex City FC',
    away_team_name: 'St. Jude United',
    home_team_logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80',
    away_team_logo: 'https://images.unsplash.com/photo-1489944445391-11dd35366433?w=100&auto=format&fit=crop&q=80',
    is_club_home: true,
    match_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    venue: 'Apex Park Stadium',
    status: 'completed',
    home_score: 3,
    away_score: 0,
    current_minute: 90,
    added_time: 4,
    period: 'full_time',
  },
  // 4. Past Result
  {
    id: 'match-past-04',
    club_id: 'club-apex-01',
    competition: 'Premier Metropolitan League',
    season: '2025/26',
    home_team_name: 'Harbor City Rangers',
    away_team_name: 'Apex City FC',
    home_team_logo: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=100&auto=format&fit=crop&q=80',
    away_team_logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80',
    is_club_home: false,
    match_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Harbor Sports Complex',
    status: 'completed',
    home_score: 1,
    away_score: 2,
    current_minute: 90,
    added_time: 5,
    period: 'full_time',
  }
];

// ==============================================================================
// 5. MATCH EVENTS (For the LIVE Match)
// ==============================================================================
export const INITIAL_MATCH_EVENTS: MatchEvent[] = [
  {
    id: 'event-01',
    match_id: 'match-live-01',
    club_id: 'club-apex-01',
    minute: 18,
    event_type: 'goal',
    team_side: 'home',
    player_name: 'Dante Moreno',
    assist_player_name: 'Julian Drake',
    detail_text: 'Thunderous strike into top-right corner from 20 yards after an incisive through ball.',
  },
  {
    id: 'event-02',
    match_id: 'match-live-01',
    club_id: 'club-apex-01',
    minute: 34,
    event_type: 'yellow_card',
    team_side: 'away',
    player_name: 'C. Henderson (Metro Rovers)',
    detail_text: 'Tactical foul breaking up a counter-attack led by Gabriel Santos.',
  },
  {
    id: 'event-03',
    match_id: 'match-live-01',
    club_id: 'club-apex-01',
    minute: 45,
    added_minute: 2,
    event_type: 'commentary',
    team_side: 'home',
    player_name: 'Referee Whistle',
    detail_text: 'Half-time called. Apex City FC leads 1-0 with 64% possession and 5 shots on target.',
  },
  {
    id: 'event-04',
    match_id: 'match-live-01',
    club_id: 'club-apex-01',
    minute: 53,
    event_type: 'goal',
    team_side: 'home',
    player_name: 'Julian Drake',
    assist_player_name: 'Kai Takahashi',
    detail_text: 'Curling free-kick over the 4-man wall beating the keeper at the near post.',
  },
  {
    id: 'event-05',
    match_id: 'match-live-01',
    club_id: 'club-apex-01',
    minute: 62,
    event_type: 'goal',
    team_side: 'away',
    player_name: 'L. Romero (Metro Rovers)',
    detail_text: 'Header from a corner delivery into the bottom corner.',
  },
  {
    id: 'event-06',
    match_id: 'match-live-01',
    club_id: 'club-apex-01',
    minute: 68,
    event_type: 'yellow_card',
    team_side: 'home',
    player_name: 'Dominic Vance',
    detail_text: 'Late slide tackle on the sideline.',
  }
];

// ==============================================================================
// 6. CLUB EVENTS (Training, Socials, AGM, Trials)
// ==============================================================================
export const INITIAL_EVENTS: ClubEvent[] = [
  {
    id: 'evt-01',
    club_id: 'club-apex-01',
    title: 'First Team Open Training & Fan Meet',
    description: 'Come watch Coach Morales lead tactical drills ahead of the derby. Autograph & photo session on the pitch immediately following training.',
    category: 'training',
    season: '2026/27',
    start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 3600 * 1000).toISOString(),
    location: 'Apex Park Main Pitch',
    max_capacity: 500,
    rsvp_count: 312,
    is_public: true,
  },
  {
    id: 'evt-02',
    club_id: 'club-apex-01',
    title: 'Annual Club Gala & Championship Dinner',
    description: 'Black tie celebration honoring player achievements, sponsor recognition, and academy graduates. Formal 3-course dinner and live auction.',
    category: 'social',
    season: '2026/27',
    start_time: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000 + 5 * 3600 * 1000).toISOString(),
    location: 'Grand Ballroom, Metro Harbor Hotel',
    max_capacity: 250,
    rsvp_count: 184,
    is_public: true,
  },
  {
    id: 'evt-03',
    club_id: 'club-apex-01',
    title: 'Senior & U23 Open Player Trials',
    description: 'Official assessment trial for outfield players and goalkeepers seeking entry into the Apex City FC competitive squad for the 2026/27 campaign.',
    category: 'trial',
    season: '2026/27',
    start_time: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 4 * 3600 * 1000).toISOString(),
    location: 'Apex Training Grounds - Pitch 2',
    max_capacity: 60,
    rsvp_count: 48,
    is_public: true,
  },
  {
    id: 'evt-04',
    club_id: 'club-apex-01',
    title: 'Apex City FC Annual General Meeting (AGM)',
    description: 'Club executive committee updates, financial review, voting on constitution amendments, and member forum.',
    category: 'agm',
    season: '2026/27',
    start_time: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000 + 2 * 3600 * 1000).toISOString(),
    location: 'Apex Clubhouse Member Lounge',
    max_capacity: 100,
    rsvp_count: 67,
    is_public: false,
  }
];

// ==============================================================================
// 7. SPONSORS
// ==============================================================================
export const INITIAL_SPONSORS: Sponsor[] = [
  {
    id: 'spon-01',
    club_id: 'club-apex-01',
    name: 'Aura Hydration Systems',
    logo_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://aurahydration.example.com',
    tier: 'platinum',
    display_order: 1,
    is_active: true,
  },
  {
    id: 'spon-02',
    club_id: 'club-apex-01',
    name: 'Vanguard Sports Performance',
    logo_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://vanguardsports.example.com',
    tier: 'gold',
    display_order: 2,
    is_active: true,
  },
  {
    id: 'spon-03',
    club_id: 'club-apex-01',
    name: 'Meridian Capital Bank',
    logo_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://meridianbank.example.com',
    tier: 'gold',
    display_order: 3,
    is_active: true,
  },
  {
    id: 'spon-04',
    club_id: 'club-apex-01',
    name: 'Apex Physiotherapy & Rehab',
    logo_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://apexphysio.example.com',
    tier: 'silver',
    display_order: 4,
    is_active: true,
  },
  {
    id: 'spon-05',
    club_id: 'club-apex-01',
    name: 'Metro Artisan Bakeries',
    logo_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://metrobakery.example.com',
    tier: 'grassroots',
    display_order: 5,
    is_active: true,
  }
];

// ==============================================================================
// 8. NEWS & MEDIA (CMS)
// ==============================================================================
export const INITIAL_NEWS: NewsArticle[] = [
  {
    id: 'news-01',
    club_id: 'club-apex-01',
    title: 'Dante Moreno Surpasses 25-Goal Milestone in Sensational Campaign',
    slug: 'moreno-25-goal-milestone',
    summary: 'Our Argentine forward reached another career highpoint, scoring against Metro Rovers and propelling Apex City to the summit.',
    content: `Dante Moreno's astonishing campaign continued this weekend with another dazzling display at Apex Park.

Speaking after the fixture, Manager Diego Morales reflected on his striker's work ethic:

"Dante represents everything we want in an Apex City player: relentless pressure, intelligent movement between lines, and the composure of a surgeon in front of goal. What the supporters see on Saturday is the direct product of his dedication at 7 AM on cold Tuesday mornings."

With 6 matches remaining in the regular season, Moreno is within four goals of the all-time club single-season record set in 2021.`,
    cover_image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
    video_embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    author_name: 'Media Officer Elena Cruz',
    tags: ['Match Report', 'First Team', 'Records'],
    is_featured: true,
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'news-02',
    club_id: 'club-apex-01',
    title: 'Tactical Blueprint: Unpacking Coach Morales’ High Press System',
    slug: 'tactical-blueprint-high-press',
    summary: 'A deep analytical breakdown of how our 4-3-3 formation forces turnovers in the attacking third and controls tempo.',
    content: `Since taking charge, Diego Morales has transformed Apex City FC into one of the most proactive possession-and-press teams in the region.

Key tactical metrics:
1. PPDA (Passes Allowed per Defensive Action): 7.4 (League lowest)
2. High Recoveries: 12.8 per 90 minutes
3. Counter-pressing intensity in transition zones

Our midfield triumvirate of Kieran O'Connor, Julian Drake, and Gabriel Santos creates numerical overloads that suffocate opposing build-ups before they cross the halfway stripe.`,
    cover_image_url: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=1200&auto=format&fit=crop&q=80',
    author_name: 'Tactical Analyst Ben Vance',
    tags: ['Tactics', 'Coach Insights', 'Analytics'],
    is_featured: false,
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'news-03',
    club_id: 'club-apex-01',
    title: 'Apex City Launches Grassroots Football Clinic for Under-12s',
    slug: 'grassroots-football-clinic-u12',
    summary: 'Free weekly training clinics supported by Aura Hydration to inspire the next generation of youth footballers in our community.',
    content: `Apex City FC is thrilled to announce the launch of our Community Grassroots Academy, beginning next month.

Open to all children aged 7-12, the 8-week curriculum focuses on foundational ball mastery, teamwork, and healthy lifestyle choices. Registered participants receive an authentic junior Apex City jersey and a personal visit from First Team squad members.`,
    cover_image_url: 'https://images.unsplash.com/photo-1529778873920-4da4926a72c2?w=1200&auto=format&fit=crop&q=80',
    author_name: 'Community Director Chloe Chen',
    tags: ['Community', 'Youth Academy', 'Grassroots'],
    is_featured: false,
    published_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

// ==============================================================================
// 9. MEDIA GALLERY
// ==============================================================================
export const INITIAL_GALLERY: MediaGalleryItem[] = [
  {
    id: 'gal-01',
    club_id: 'club-apex-01',
    title: 'Derby Victory Celebration at Apex Park',
    media_type: 'image',
    media_url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&auto=format&fit=crop&q=80',
    album_name: 'Championship Matches',
  },
  {
    id: 'gal-02',
    club_id: 'club-apex-01',
    title: 'Captain Julian Drake Free-Kick Mastery',
    media_type: 'image',
    media_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&auto=format&fit=crop&q=80',
    album_name: 'Action Shots',
  },
  {
    id: 'gal-03',
    club_id: 'club-apex-01',
    title: 'Goalkeeper Marcus Thorne Clean Sheet Save',
    media_type: 'image',
    media_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1200&auto=format&fit=crop&q=80',
    album_name: 'Action Shots',
  },
  {
    id: 'gal-04',
    club_id: 'club-apex-01',
    title: 'Full Squad Pre-Match Tunnel Walk',
    media_type: 'image',
    media_url: 'https://images.unsplash.com/photo-1489944445391-11dd35366433?w=1200&auto=format&fit=crop&q=80',
    album_name: 'Behind The Scenes',
  }
];

// ==============================================================================
// 10. ANALYTICS (Simulated metrics for Admin Portal)
// ==============================================================================
export const INITIAL_ANALYTICS: ClubAnalytics[] = [
  { id: 'ana-01', club_id: 'club-apex-01', event_type: 'page_view', page_path: '/apex-city-fc', created_at: new Date().toISOString() },
  { id: 'ana-02', club_id: 'club-apex-01', event_type: 'pass_scanned', page_path: '/apex-city-fc/verify', created_at: new Date().toISOString() },
  { id: 'ana-03', club_id: 'club-apex-01', event_type: 'match_view', page_path: '/apex-city-fc/match/match-live-01', created_at: new Date().toISOString() },
];

// ==============================================================================
// 11. GAMIFICATION & CLUBSCORE MOCK DATA
// ==============================================================================

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

export const DEFAULT_CLUBSCORE_RULES: Record<string, ClubScoreRuleConfig> = {
  'club-apex-01': {
    club_id: 'club-apex-01',
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
  },
  'club-titan-02': {
    club_id: 'club-titan-02',
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
  }
};

export const INITIAL_CLUBSCORE_PROFILES: ClubScoreProfile[] = [
  {
    id: 'score-prof-01',
    club_id: 'club-apex-01',
    member_id: 'player-apex-01', // Julian Drake (CAM)
    season: '2025/2026',
    total_points: 385,
    weekly_points: 34,
    monthly_points: 112,
    current_streak: 6,
    highest_streak: 8,
    tier: 'All-Star',
    badges: [STANDARD_BADGES[0], STANDARD_BADGES[4]],
    last_activity_date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'score-prof-02',
    club_id: 'club-apex-01',
    member_id: 'player-apex-02', // Dante Moreno (ST)
    season: '2025/2026',
    total_points: 440,
    weekly_points: 45,
    monthly_points: 140,
    current_streak: 4,
    highest_streak: 6,
    tier: 'All-Star',
    badges: [STANDARD_BADGES[0], STANDARD_BADGES[1]],
    last_activity_date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'score-prof-03',
    club_id: 'club-apex-01',
    member_id: 'player-apex-03', // Marcus Thorne (GK)
    season: '2025/2026',
    total_points: 295,
    weekly_points: 25,
    monthly_points: 90,
    current_streak: 7,
    highest_streak: 7,
    tier: 'First Team',
    badges: [STANDARD_BADGES[0], STANDARD_BADGES[2]],
    last_activity_date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'score-prof-04',
    club_id: 'club-apex-01',
    member_id: 'player-apex-04', // Mateo Rossi (CB)
    season: '2025/2026',
    total_points: 260,
    weekly_points: 20,
    monthly_points: 85,
    current_streak: 5,
    highest_streak: 5,
    tier: 'First Team',
    badges: [STANDARD_BADGES[0], STANDARD_BADGES[2]],
    last_activity_date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
  },
  {
    id: 'score-prof-05',
    club_id: 'club-apex-01',
    member_id: 'player-apex-05', // Lucas Sterling (CM)
    season: '2025/2026',
    total_points: 215,
    weekly_points: 15,
    monthly_points: 65,
    current_streak: 3,
    highest_streak: 4,
    tier: 'First Team',
    badges: [STANDARD_BADGES[0]],
    last_activity_date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
  },
  {
    id: 'score-prof-06',
    club_id: 'club-apex-01',
    member_id: 'player-apex-06', // Liam Becker (LB)
    season: '2025/2026',
    total_points: 145,
    weekly_points: 10,
    monthly_points: 45,
    current_streak: 2,
    highest_streak: 3,
    tier: 'Prospect',
    badges: [],
    last_activity_date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString().split('T')[0],
  }
];

export const INITIAL_ACTIVITY_LOGS: GamificationActivityLog[] = [
  {
    id: 'log-01',
    club_id: 'club-apex-01',
    member_id: 'player-apex-02',
    event_type: 'match_goal',
    points_awarded: 10,
    multiplier: 1.15,
    final_points: 12,
    description: 'Goal (54\') vs Metro Rovers (4-week streak bonus applied)',
    created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'log-02',
    club_id: 'club-apex-01',
    member_id: 'player-apex-01',
    event_type: 'match_assist',
    points_awarded: 7,
    multiplier: 1.25,
    final_points: 9,
    description: 'Assist (54\') pinpoint through ball for opening goal',
    created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'log-03',
    club_id: 'club-apex-01',
    member_id: 'player-apex-03',
    event_type: 'training_checkin',
    points_awarded: 10,
    multiplier: 1.25,
    final_points: 13,
    description: 'Verified QR Check-In: First Team Tactical Training',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'log-04',
    club_id: 'club-apex-01',
    member_id: 'player-apex-04',
    event_type: 'training_checkin',
    points_awarded: 10,
    multiplier: 1.25,
    final_points: 13,
    description: 'Verified QR Check-In: First Team Tactical Training',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'log-05',
    club_id: 'club-apex-01',
    member_id: 'player-apex-01',
    event_type: 'admin_award',
    points_awarded: 15,
    multiplier: 1.0,
    final_points: 15,
    description: 'Coach Award: Outstanding Leadership & Fair Play in Derby',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  }
];

// ==============================================================================
// 12. MATCHDAY & PRE-MATCH AVAILABILITY (Pre-Match Call-ups & Magic Links)
// ==============================================================================
export const INITIAL_AVAILABILITIES: PlayerAvailability[] = [
  {
    id: 'avail-01',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-01', // Julian Drake
    status: 'available',
    note: '100% fit, captain ready for starting XI',
    response_token: 'tok-drake-01',
    responded_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-02',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-02', // Dante Moreno
    status: 'available',
    note: 'Targeting 2 goals this weekend!',
    response_token: 'tok-moreno-02',
    responded_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-03',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-03', // Marcus Thorne
    status: 'available',
    note: 'Gloves packed, clean sheet mission',
    response_token: 'tok-thorne-03',
    responded_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-04',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-04', // Dominic Vance
    status: 'available',
    response_token: 'tok-vance-04',
    responded_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-05',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-05', // Leo Sterling
    status: 'available',
    response_token: 'tok-sterling-05',
    responded_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-06',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-06', // Tariq Al-Mansoor
    status: 'available',
    response_token: 'tok-mansoor-06',
    responded_at: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-07',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-07', // Mateo Rossi
    status: 'available',
    response_token: 'tok-rossi-07',
    responded_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-08',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-08', // Gabriel Santos
    status: 'available',
    response_token: 'tok-santos-08',
    responded_at: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-09',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-09', // Kai Takahashi
    status: 'maybe',
    note: 'Hamstring soreness after training; can play 25-30 mins off bench',
    response_token: 'tok-takahashi-09',
    responded_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-10',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-10', // Arlo Bennett
    status: 'unavailable',
    note: 'Family wedding out of state. Returning Monday.',
    response_token: 'tok-bennett-10',
    responded_at: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-11',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-11', // Stefan Lindqvist
    status: 'available',
    response_token: 'tok-lindqvist-11',
    responded_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-12',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-12', // Xavier Cole
    status: 'available',
    response_token: 'tok-cole-12',
    responded_at: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-13',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-13', // Nico Bellini
    status: 'maybe',
    note: 'Working shift until 1:30pm; might arrive 20 mins before kickoff',
    response_token: 'tok-bellini-13',
    responded_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-14',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-14', // Devon Ray
    status: 'available',
    response_token: 'tok-ray-14',
    responded_at: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
  },
  {
    id: 'avail-15',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    member_id: 'player-apex-15', // Liam O'Connor
    status: 'pending',
    response_token: 'tok-oconnor-15',
  }
];

// ==============================================================================
// 13. DRAFT LINEUPS (Coach Workbench Storage)
// ==============================================================================
export const INITIAL_DRAFT_LINEUPS: DraftLineup[] = [
  {
    id: 'draft-01',
    club_id: 'club-apex-01',
    match_id: 'match-upcoming-02',
    format: '11v11',
    formation: '4-3-3',
    lineup_coords: [],
    bench_member_ids: [
      'player-apex-09', // Kai Takahashi (bench)
      'player-apex-12', // Xavier Cole (bench)
      'player-apex-13', // Nico Bellini (bench)
      'player-apex-14'  // Devon Ray (bench)
    ],
    tactical_notes: 'High-intensity press from 1st minute. Target the channels behind Titan fullbacks. Drake to take direct free kicks.',
    is_published: false,
    updated_at: new Date().toISOString(),
  }
];


