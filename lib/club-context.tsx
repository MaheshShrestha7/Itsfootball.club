'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  ContactInquiry,
  ClubScoreProfile,
  GamificationActivityLog,
  ClubScoreRuleConfig,
  ClubBadge,
  ClubScoreTier,
  PlayerAvailability,
  AvailabilityStatus,
  DraftLineup,
  MatchAuditPayload,
  ClubSeason
} from './supabase/types';
import {
  INITIAL_CLUBS,
  INITIAL_MEMBERS,
  INITIAL_PLAYER_STATS,
  INITIAL_MATCHES,
  INITIAL_MATCH_EVENTS,
  INITIAL_EVENTS,
  INITIAL_SPONSORS,
  INITIAL_NEWS,
  INITIAL_GALLERY,
  INITIAL_CLUBSCORE_PROFILES,
  INITIAL_ACTIVITY_LOGS,
  DEFAULT_CLUBSCORE_RULES,
  STANDARD_BADGES,
  INITIAL_AVAILABILITIES,
  INITIAL_DRAFT_LINEUPS,
  INITIAL_SEASONS
} from './mock-data';
import { getSupabaseClient, isSupabaseConfigured } from './supabase/client';

interface ClubContextType {
  clubs: Club[];
  activeClub: Club | null;
  members: ClubMember[];
  playerStats: PlayerStats[];
  matches: Match[];
  matchEvents: MatchEvent[];
  events: ClubEvent[];
  sponsors: Sponsor[];
  news: NewsArticle[];
  gallery: MediaGalleryItem[];
  seasons: ClubSeason[];
  
  // Hydration state
  isHydrated: boolean;

  // Selection
  selectClubBySlug: (slug: string) => Club | null;
  
  // Club Management
  createClub: (clubData: Partial<Club>) => Club;
  updateClubBranding: (clubId: string, updates: Partial<Club>) => void;

  // Seasons Management
  addSeason: (seasonData: Omit<ClubSeason, 'id' | 'created_at' | 'updated_at'>) => ClubSeason;
  updateSeason: (seasonId: string, updates: Partial<ClubSeason>) => void;
  deleteSeason: (seasonId: string) => void;
  setCurrentSeason: (clubId: string, seasonId: string) => void;
  getActiveSeason: (clubId: string) => ClubSeason | undefined;
  
  // Match Day Live Controller & Fixtures CRUD
  addMatch: (matchData: Omit<Match, 'id' | 'created_at'>) => Match;
  deleteMatch: (matchId: string) => void;
  updateMatch: (matchId: string, updates: Partial<Match>) => void;
  addMatchEvent: (eventData: Omit<MatchEvent, 'id' | 'created_at'>) => void;
  deleteMatchEvent: (eventId: string) => void;
  
  // Events Management
  addEvent: (eventData: Omit<ClubEvent, 'id' | 'created_at'>) => void;
  updateEvent: (eventId: string, updates: Partial<ClubEvent>) => void;
  deleteEvent: (eventId: string) => void;
  
  // Member & Squad Management
  addMember: (memberData: Omit<ClubMember, 'id' | 'created_at'>) => ClubMember;
  updateMember: (memberId: string, updates: Partial<ClubMember>) => void;
  deleteMember: (memberId: string) => void;
  appointExecutive: (memberId: string, title: string, bio?: string, order?: number, season?: string) => void;
  updatePlayerStats: (memberId: string, stats: Partial<PlayerStats>) => void;
  
  // Sponsors Management
  addSponsor: (sponsorData: Omit<Sponsor, 'id'>) => void;
  updateSponsor: (sponsorId: string, updates: Partial<Sponsor>) => void;
  deleteSponsor: (sponsorId: string) => void;
  
  // Content CMS Management
  addNewsArticle: (articleData: Omit<NewsArticle, 'id' | 'published_at'>) => void;
  updateNewsArticle: (articleId: string, updates: Partial<NewsArticle>) => void;
  deleteNewsArticle: (articleId: string) => void;
  addMediaItem: (mediaData: Omit<MediaGalleryItem, 'id' | 'created_at'>) => void;
  
  // QR Verification & Check-in
  verifyMemberPass: (token: string) => { valid: boolean; member?: ClubMember; message: string };
  checkInMemberToEvent: (eventId: string, qrToken: string) => { success: boolean; message: string; attendeeName?: string };
  
  // Inquiries
  submitInquiry: (inquiryData: Omit<ContactInquiry, 'id' | 'created_at' | 'status'>) => void;

  // Gamification & ClubScore Engine
  clubScoreProfiles: ClubScoreProfile[];
  activityLogs: GamificationActivityLog[];
  clubScoreRules: Record<string, ClubScoreRuleConfig>;
  awardClubScorePoints: (memberId: string, points: number, eventType: any, description: string, referenceId?: string) => void;
  updateClubScoreRules: (clubId: string, rules: Partial<ClubScoreRuleConfig>) => void;
  getMemberClubScore: (memberId: string) => ClubScoreProfile | undefined;
  getMemberActivityLogs: (memberId: string) => GamificationActivityLog[];

  // Pre-Match Availability & RSVP Hub
  availabilities: PlayerAvailability[];
  setPlayerAvailability: (matchId: string, memberId: string, status: AvailabilityStatus, note?: string) => void;
  getMatchAvailabilities: (matchId: string) => PlayerAvailability[];
  getAvailabilityByToken: (token: string) => { availability: PlayerAvailability; member: ClubMember; match?: Match; event?: ClubEvent } | null;

  // Draft Lineups (Coach Workbench)
  draftLineups: DraftLineup[];
  saveDraftLineup: (draft: Partial<DraftLineup> & { match_id: string; club_id: string }) => void;
  getDraftLineup: (matchId: string) => DraftLineup | undefined;
  publishDraftLineup: (matchId: string) => { success: boolean; message: string };

  // Post-Match Stats Audit & Leaderboard Baking
  auditAndBakeMatchStats: (matchId: string, payload: MatchAuditPayload) => { success: boolean; totalPointsAwarded: number; message: string };
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

const STORAGE_KEY = 'itsfootball_state_v1';

export const RESERVED_SLUGS = [
  'api', 'admin', 'clubs', 'create-club', 'verify', 'match', 'member',
  'squad', 'events', 'news', 'sponsors', 'branding', 'analytics', 'scanner',
  'login', 'register', 'auth', 'settings', 'dashboard', 'static', 'assets'
];

export function sanitizeText(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '') // Strip potential script injection tags
    .trim();
}

export function validateClubSlug(
  rawSlug: string,
  existingClubs: Club[],
  currentClubId?: string
): { valid: boolean; error?: string; cleanSlug: string } {
  const cleanSlug = rawSlug
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-');

  if (!cleanSlug || cleanSlug.length < 3) {
    return { valid: false, error: 'Club slug must be at least 3 characters.', cleanSlug };
  }

  if (cleanSlug.length > 48) {
    return { valid: false, error: 'Club slug cannot exceed 48 characters.', cleanSlug };
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
    return { valid: false, error: 'Slug must start and end with an alphanumeric character and contain only single hyphens.', cleanSlug };
  }

  if (RESERVED_SLUGS.includes(cleanSlug)) {
    return { valid: false, error: `"${cleanSlug}" is a reserved system path and cannot be used.`, cleanSlug };
  }

  const collision = existingClubs.find(
    c => c.slug.toLowerCase() === cleanSlug && c.id !== currentClubId
  );
  if (collision) {
    return { valid: false, error: `The URL slug "${cleanSlug}" is already taken by ${collision.name}.`, cleanSlug };
  }

  return { valid: true, cleanSlug };
}

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const [clubs, setClubs] = useState<Club[]>(INITIAL_CLUBS);
  const [activeClub, setActiveClub] = useState<Club | null>(INITIAL_CLUBS[0]);
  const [members, setMembers] = useState<ClubMember[]>(INITIAL_MEMBERS);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>(INITIAL_PLAYER_STATS);
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>(INITIAL_MATCH_EVENTS);
  const [events, setEvents] = useState<ClubEvent[]>(INITIAL_EVENTS);
  const [sponsors, setSponsors] = useState<Sponsor[]>(INITIAL_SPONSORS);
  const [news, setNews] = useState<NewsArticle[]>(INITIAL_NEWS);
  const [gallery, setGallery] = useState<MediaGalleryItem[]>(INITIAL_GALLERY);
  const [clubScoreProfiles, setClubScoreProfiles] = useState<ClubScoreProfile[]>(INITIAL_CLUBSCORE_PROFILES);
  const [activityLogs, setActivityLogs] = useState<GamificationActivityLog[]>(INITIAL_ACTIVITY_LOGS);
  const [clubScoreRules, setClubScoreRules] = useState<Record<string, ClubScoreRuleConfig>>(DEFAULT_CLUBSCORE_RULES);
  const [availabilities, setAvailabilities] = useState<PlayerAvailability[]>(INITIAL_AVAILABILITIES);
  const [draftLineups, setDraftLineups] = useState<DraftLineup[]>(INITIAL_DRAFT_LINEUPS);
  const [seasons, setSeasons] = useState<ClubSeason[]>(INITIAL_SEASONS);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.clubs?.length) {
            setClubs(parsed.clubs);
            if (parsed.activeClubId) {
              const found = parsed.clubs.find((c: Club) => c.id === parsed.activeClubId);
              setActiveClub(found || parsed.clubs[0]);
            } else {
              setActiveClub(parsed.clubs[0]);
            }
          }
          if (parsed.members?.length) setMembers(parsed.members);
          if (parsed.playerStats?.length) setPlayerStats(parsed.playerStats);
          if (parsed.matches?.length) setMatches(parsed.matches);
          if (parsed.matchEvents?.length) setMatchEvents(parsed.matchEvents);
          if (parsed.events?.length) setEvents(parsed.events);
          if (parsed.sponsors?.length) setSponsors(parsed.sponsors);
          if (parsed.news?.length) setNews(parsed.news);
          if (parsed.gallery?.length) setGallery(parsed.gallery);
          if (parsed.clubScoreProfiles?.length) setClubScoreProfiles(parsed.clubScoreProfiles);
          if (parsed.activityLogs?.length) setActivityLogs(parsed.activityLogs);
          if (parsed.clubScoreRules) setClubScoreRules(parsed.clubScoreRules);
          if (parsed.availabilities?.length) setAvailabilities(parsed.availabilities);
          if (parsed.draftLineups?.length) setDraftLineups(parsed.draftLineups);
          if (parsed.seasons?.length) setSeasons(parsed.seasons);
        }
      } catch (err) {
        console.warn('Could not read state from localStorage', err);
      } finally {
        setIsHydrated(true);
      }
    }
  }, []);

  // Listen to cross-tab storage changes for real-time multi-window sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.clubs?.length) {
            setClubs(parsed.clubs);
            if (parsed.activeClubId) {
              const found = parsed.clubs.find((c: Club) => c.id === parsed.activeClubId);
              setActiveClub(found || parsed.clubs[0]);
            }
          }
          if (parsed.members?.length) setMembers(parsed.members);
          if (parsed.playerStats?.length) setPlayerStats(parsed.playerStats);
          if (parsed.matches?.length) setMatches(parsed.matches);
          if (parsed.matchEvents?.length) setMatchEvents(parsed.matchEvents);
          if (parsed.events?.length) setEvents(parsed.events);
          if (parsed.sponsors?.length) setSponsors(parsed.sponsors);
          if (parsed.news?.length) setNews(parsed.news);
          if (parsed.gallery?.length) setGallery(parsed.gallery);
          if (parsed.clubScoreProfiles?.length) setClubScoreProfiles(parsed.clubScoreProfiles);
          if (parsed.activityLogs?.length) setActivityLogs(parsed.activityLogs);
          if (parsed.clubScoreRules) setClubScoreRules(parsed.clubScoreRules);
          if (parsed.availabilities?.length) setAvailabilities(parsed.availabilities);
          if (parsed.draftLineups?.length) setDraftLineups(parsed.draftLineups);
          if (parsed.seasons?.length) setSeasons(parsed.seasons);
        } catch (err) {
          console.warn('Cross-tab storage parse error', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync back to localStorage ONLY when hydrated
  useEffect(() => {
    if (!isHydrated) return;
    if (typeof window !== 'undefined') {
      try {
        const stateToSave = {
          clubs,
          activeClubId: activeClub?.id || clubs[0]?.id,
          members,
          playerStats,
          matches,
          matchEvents,
          events,
          sponsors,
          news,
          gallery,
          clubScoreProfiles,
          activityLogs,
          clubScoreRules,
          availabilities,
          draftLineups,
          seasons
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (err) {
        console.warn('Could not save state to localStorage', err);
      }
    }
  }, [isHydrated, clubs, members, playerStats, matches, matchEvents, events, sponsors, news, gallery, clubScoreProfiles, activityLogs, clubScoreRules, availabilities, draftLineups, seasons]);

  // Realtime match timer tick simulation for live matches
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches(prevMatches =>
        prevMatches.map(m => {
          if (m.status === 'live' && m.current_minute < 90) {
            return {
              ...m,
              current_minute: m.current_minute + 1,
            };
          }
          return m;
        })
      );
    }, 45000); // Increment every 45s for demo realism

    return () => clearInterval(interval);
  }, []);

  // Helper to select active club by slug (with previous_slugs alias support for redirects)
  const selectClubBySlug = useCallback((slug: string): Club | null => {
    if (!slug) return null;
    const clean = slug.toLowerCase();
    const found = clubs.find(c => c.slug.toLowerCase() === clean)
      || clubs.find(c => c.previous_slugs?.some(prev => prev.toLowerCase() === clean))
      || null;
    return found;
  }, [clubs]);

  // 1. Create Club with validation, sanitization & starter kit
  const createClub = useCallback((clubData: Partial<Club>): Club => {
    const rawSlug = clubData.slug || clubData.name || `club-${Date.now()}`;
    const slugResult = validateClubSlug(rawSlug, clubs);
    const finalSlug = slugResult.cleanSlug;

    const clubId = `club-${Date.now()}`;
    const cleanName = sanitizeText(clubData.name) || 'New Football Club';

    const newClub: Club = {
      id: clubId,
      slug: finalSlug,
      name: cleanName,
      short_name: sanitizeText(clubData.short_name) || cleanName.substring(0, 3).toUpperCase(),
      motto: sanitizeText(clubData.motto) || 'Play with Passion',
      founded_year: clubData.founded_year || new Date().getFullYear(),
      logo_url: clubData.logo_url || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&auto=format&fit=crop&q=80',
      banner_url: clubData.banner_url || 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
      primary_color: clubData.primary_color || '#10B981',
      secondary_color: clubData.secondary_color || '#0F172A',
      accent_color: clubData.accent_color || '#F59E0B',
      stadium_name: sanitizeText(clubData.stadium_name) || `${cleanName} Arena`,
      stadium_address: sanitizeText(clubData.stadium_address) || '100 Stadium Way, Sports City',
      stadium_capacity: clubData.stadium_capacity || 5000,
      stadium_pitch_type: sanitizeText(clubData.stadium_pitch_type) || 'Natural Hybrid Turf',
      stadium_parking_info: sanitizeText(clubData.stadium_parking_info) || 'Matchday spectator parking at North Gate.',
      contact_email: sanitizeText(clubData.contact_email) || 'contact@footballclub.org',
      contact_phone: sanitizeText(clubData.contact_phone) || '+1 (555) 019-2831',
      custom_domain: sanitizeText(clubData.custom_domain) || undefined,
      hero_pinned_items: clubData.hero_pinned_items || [],
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Seed starter roster and match fixtures so new club public portal is immediately rich & operable
    const starterMember1: ClubMember = {
      id: `mem-${clubId}-1`,
      club_id: clubId,
      full_name: 'Mateo Rossi',
      email: 'm.rossi@club.org',
      role: 'player',
      player_position: 'ST',
      jersey_number: 9,
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      status: 'active',
      qr_code_token: `pass-${clubId}-rossi`,
      membership_tier: 'First Team Pro',
      membership_expires_at: '2027-12-31',
      is_executive: false,
      created_at: new Date().toISOString(),
    };

    const starterMember2: ClubMember = {
      id: `mem-${clubId}-2`,
      club_id: clubId,
      full_name: 'Coach David Vance',
      email: 'coach@club.org',
      role: 'staff',
      photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
      status: 'active',
      qr_code_token: `pass-${clubId}-vance`,
      membership_tier: 'Staff Accreditation',
      membership_expires_at: '2027-12-31',
      is_executive: true,
      executive_title: 'Head Coach & Technical Director',
      executive_bio: 'Licensed UEFA Pro Coach leading technical squad operations.',
      executive_order: 1,
      created_at: new Date().toISOString(),
    };

    const starterStats: PlayerStats = {
      id: `stat-${starterMember1.id}`,
      club_id: clubId,
      member_id: starterMember1.id,
      season: '2025/2026',
      appearances: 12,
      minutes_played: 1040,
      goals: 8,
      assists: 4,
      clean_sheets: 0,
      yellow_cards: 1,
      red_cards: 0,
      motm_awards: 3,
    };

    const starterMatch: Match = {
      id: `match-${clubId}-1`,
      club_id: clubId,
      competition: 'Premier Regional League',
      season: '2026/27',
      home_team_name: newClub.name,
      away_team_name: 'United Athletic',
      home_team_logo: newClub.logo_url,
      away_team_logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80',
      is_club_home: true,
      match_date: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days in future
      venue: newClub.stadium_name,
      status: 'upcoming',
      home_score: 0,
      away_score: 0,
      current_minute: 0,
      added_time: 0,
      period: 'pre_match',
      home_formation: '4-3-3',
      away_formation: '4-2-3-1',
      created_at: new Date().toISOString(),
    };

    const starterSeason: ClubSeason = {
      id: `season-${clubId}-1`,
      club_id: clubId,
      name: '2026/27',
      start_date: '2026-08-01',
      end_date: '2027-05-31',
      is_current: true,
      status: 'active',
      notes: 'Inaugural championship season.',
      created_at: new Date().toISOString(),
    };

    const starterNews: NewsArticle = {
      id: `news-${clubId}-1`,
      club_id: clubId,
      title: `Welcome to the Official Portal of ${newClub.name}`,
      slug: `welcome-to-${newClub.slug}`,
      summary: `Official launch of our new digital club experience, member passes, and live matchday center.`,
      content: `We are thrilled to welcome our supporters, players, and commercial partners to the new official online home of ${newClub.name}. Stay tuned for live fixtures, membership accreditation, and club announcements.`,
      cover_image_url: newClub.banner_url,
      author_name: 'Club Secretariat',
      tags: ['Announcement', 'Season Launch'],
      is_featured: true,
      published_at: new Date().toISOString(),
    };

    setClubs(prev => [...prev, newClub]);
    setMembers(prev => [...prev, starterMember1, starterMember2]);
    setPlayerStats(prev => [...prev, starterStats]);
    setMatches(prev => [...prev, starterMatch]);
    setSeasons(prev => [...prev, starterSeason]);
    setNews(prev => [starterNews, ...prev]);
    setActiveClub(newClub);

    // If Supabase is connected, asynchronously insert the club
    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.from('clubs').insert(newClub).then(({ error }) => {
          if (error) console.warn('Could not sync created club to Supabase:', error.message);
        });
      }
    }

    return newClub;
  }, [clubs]);

  // 2. Update Club Branding & Interface Settings with Supabase sync and slug migration
  const updateClubBranding = useCallback((clubId: string, updates: Partial<Club>) => {
    setClubs(prev =>
      prev.map(c => {
        if (c.id === clubId) {
          const previous_slugs = Array.isArray(c.previous_slugs) ? [...c.previous_slugs] : [];
          if (updates.slug && updates.slug !== c.slug && !previous_slugs.includes(c.slug)) {
            previous_slugs.push(c.slug);
          }
          return {
            ...c,
            ...updates,
            previous_slugs,
            updated_at: new Date().toISOString(),
          };
        }
        return c;
      })
    );

    setActiveClub(prev => {
      if (!prev || prev.id === clubId) {
        return {
          ...(prev || {}),
          ...updates,
          updated_at: new Date().toISOString(),
        } as Club;
      }
      return prev;
    });

    // When team name, stadium, or crest is updated, also sync match records for this club
    setMatches(prevMatches =>
      prevMatches.map(m => {
        if (m.club_id === clubId) {
          return {
            ...m,
            home_team_name: updates.name && m.is_club_home ? updates.name : m.home_team_name,
            away_team_name: updates.name && !m.is_club_home ? updates.name : m.away_team_name,
            home_team_logo: updates.logo_url && m.is_club_home ? updates.logo_url : m.home_team_logo,
            away_team_logo: updates.logo_url && !m.is_club_home ? updates.logo_url : m.away_team_logo,
            venue: updates.stadium_name && m.is_club_home ? updates.stadium_name : m.venue,
          };
        }
        return m;
      })
    );

    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        try {
          // Prepare sanitized payload: only top-level columns that exist in Supabase clubs table
          const supabasePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.name !== undefined) supabasePayload.name = updates.name;
          if (updates.slug !== undefined) supabasePayload.slug = updates.slug;
          if (updates.short_name !== undefined) supabasePayload.short_name = updates.short_name;
          if (updates.motto !== undefined) supabasePayload.motto = updates.motto;
          if (updates.logo_url !== undefined) supabasePayload.logo_url = updates.logo_url;
          if (updates.custom_domain !== undefined) supabasePayload.custom_domain = updates.custom_domain || null;
          
          const targetClub = clubs.find(c => c.id === clubId);
          // Embed rich theme, contact, stadium specs, and hero_pinned_items into config JSONB column
          supabasePayload.config = {
            theme: {
              primaryColor: updates.primary_color !== undefined ? updates.primary_color : targetClub?.primary_color,
              secondaryColor: updates.secondary_color !== undefined ? updates.secondary_color : targetClub?.secondary_color,
              accentColor: updates.accent_color !== undefined ? updates.accent_color : targetClub?.accent_color,
            },
            contact: {
              email: updates.contact_email !== undefined ? updates.contact_email : targetClub?.contact_email,
              phone: updates.contact_phone !== undefined ? updates.contact_phone : targetClub?.contact_phone,
              address: updates.stadium_address !== undefined ? updates.stadium_address : targetClub?.stadium_address,
            },
            identity: {
              clubName: updates.name !== undefined ? updates.name : targetClub?.name,
              shortName: updates.short_name !== undefined ? updates.short_name : targetClub?.short_name,
              motto: updates.motto !== undefined ? updates.motto : targetClub?.motto,
              logoUrl: updates.logo_url !== undefined ? updates.logo_url : targetClub?.logo_url,
              stadiumName: updates.stadium_name !== undefined ? updates.stadium_name : targetClub?.stadium_name,
              capacity: updates.stadium_capacity !== undefined ? updates.stadium_capacity : targetClub?.stadium_capacity,
              pitchType: updates.stadium_pitch_type !== undefined ? updates.stadium_pitch_type : targetClub?.stadium_pitch_type,
            },
            hero_pinned_items: updates.hero_pinned_items !== undefined ? updates.hero_pinned_items : targetClub?.hero_pinned_items,
          };

          client
            .from('clubs')
            .update(supabasePayload)
            .eq('id', clubId)
            .then(
              ({ error }) => {
                if (error) console.warn('Supabase sync notice (local storage preserved):', error.message);
              },
              (err: any) => {
                console.warn('Supabase update catch:', err);
              }
            );
        } catch (e) {
          console.warn('Error formatting Supabase payload:', e);
        }
      }
    }

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('itsfootball-club-updated', { detail: { clubId } }));
      } catch (e) {
        // ignore
      }
    }
  }, [clubs]);

  // Season Management
  const addSeason = useCallback((seasonData: Omit<ClubSeason, 'id' | 'created_at' | 'updated_at'>): ClubSeason => {
    const newSeason: ClubSeason = {
      ...seasonData,
      id: `season-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSeasons(prev => {
      if (newSeason.is_current) {
        return [...prev.map(s => s.club_id === newSeason.club_id ? { ...s, is_current: false } : s), newSeason];
      }
      return [...prev, newSeason];
    });

    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.from('club_seasons').insert(newSeason).then(({ error }) => {
          if (error) console.warn('Could not sync created season to Supabase:', error.message);
        });
      }
    }

    return newSeason;
  }, []);

  const updateSeason = useCallback((seasonId: string, updates: Partial<ClubSeason>) => {
    setSeasons(prev => {
      const target = prev.find(s => s.id === seasonId);
      if (!target) return prev;
      const clubId = target.club_id;

      return prev.map(s => {
        if (s.id === seasonId) {
          return { ...s, ...updates, updated_at: new Date().toISOString() };
        }
        if (updates.is_current && s.club_id === clubId && s.id !== seasonId) {
          return { ...s, is_current: false };
        }
        return s;
      });
    });

    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.from('club_seasons').update(updates).eq('id', seasonId).then(({ error }) => {
          if (error) console.warn('Could not sync updated season to Supabase:', error.message);
        });
      }
    }
  }, []);

  const deleteSeason = useCallback((seasonId: string) => {
    setSeasons(prev => prev.filter(s => s.id !== seasonId));

    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.from('club_seasons').delete().eq('id', seasonId).then(({ error }) => {
          if (error) console.warn('Could not sync deleted season to Supabase:', error.message);
        });
      }
    }
  }, []);

  const setCurrentSeason = useCallback((clubId: string, seasonId: string) => {
    setSeasons(prev =>
      prev.map(s => {
        if (s.club_id !== clubId) return s;
        return {
          ...s,
          is_current: s.id === seasonId,
          status: s.id === seasonId ? 'active' : s.status,
          updated_at: new Date().toISOString(),
        };
      })
    );
  }, []);

  const getActiveSeason = useCallback((clubId: string): ClubSeason | undefined => {
    const clubSeasons = seasons.filter(s => s.club_id === clubId);
    return clubSeasons.find(s => s.is_current) || clubSeasons.find(s => s.status === 'active') || clubSeasons[0];
  }, [seasons]);

  // Fixtures CRUD
  const addMatch = useCallback((matchData: Omit<Match, 'id' | 'created_at'>): Match => {
    const newMatch: Match = {
      ...matchData,
      id: `match-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setMatches(prev => [newMatch, ...prev]);

    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.from('matches').insert(newMatch).then(({ error }) => {
          if (error) console.warn('Could not sync created match to Supabase:', error.message);
        });
      }
    }

    return newMatch;
  }, []);

  const deleteMatch = useCallback((matchId: string) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setMatchEvents(prev => prev.filter(e => e.match_id !== matchId));

    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.from('matches').delete().eq('id', matchId).then(({ error }) => {
          if (error) console.warn('Could not sync deleted match to Supabase:', error.message);
        });
      }
    }
  }, []);

  // 3. Update Match
  const updateMatch = useCallback((matchId: string, updates: Partial<Match>) => {
    setMatches(prev =>
      prev.map(m => (m.id === matchId ? { ...m, ...updates } : m))
    );
  }, []);

  // Tier calculation helper
  const calculateTier = (points: number): ClubScoreTier => {
    if (points >= 500) return 'Club Legend';
    if (points >= 300) return 'All-Star';
    if (points >= 150) return 'First Team';
    if (points >= 50) return 'Prospect';
    return 'Rookie';
  };

  // Gamification & ClubScore Engine
  const awardClubScorePoints = useCallback(
    (memberId: string, basePoints: number, eventType: any, description: string, referenceId?: string) => {
      const member = members.find(m => m.id === memberId);
      if (!member) return;

      setClubScoreProfiles(prevProfiles => {
        const existing = prevProfiles.find(p => p.member_id === memberId);
        const currentStreak = existing?.current_streak || 0;

        // Calculate multiplier based on streak
        let multiplier = 1.0;
        if (currentStreak >= 10) multiplier = 1.50;
        else if (currentStreak >= 5) multiplier = 1.25;
        else if (currentStreak >= 3) multiplier = 1.15;

        const finalPoints = basePoints > 0 ? Math.round(basePoints * multiplier) : basePoints;

        // Calculate streak increment if attendance event
        const isAttendance = ['training_checkin', 'social_checkin', 'match_appearance'].includes(eventType);
        const newStreak = isAttendance ? currentStreak + 1 : currentStreak;
        const highestStreak = Math.max(existing?.highest_streak || 0, newStreak);

        const newTotal = Math.max(0, (existing?.total_points || 0) + finalPoints);
        const newWeekly = Math.max(0, (existing?.weekly_points || 0) + finalPoints);
        const newMonthly = Math.max(0, (existing?.monthly_points || 0) + finalPoints);
        const newTier = calculateTier(newTotal);

        // Check for unlocked badges
        const currentBadges = existing?.badges ? [...existing.badges] : [];
        if (newStreak >= 5 && !currentBadges.some(b => b.id === 'badge-ironman')) {
          currentBadges.push(STANDARD_BADGES[0]);
        }
        if (newTotal >= 500 && !currentBadges.some(b => b.id === 'badge-centurion')) {
          currentBadges.push(STANDARD_BADGES[3]);
        }

        const updatedProfile: ClubScoreProfile = {
          id: existing?.id || `score-${Date.now()}`,
          club_id: member.club_id,
          member_id: memberId,
          season: existing?.season || '2025/2026',
          total_points: newTotal,
          weekly_points: newWeekly,
          monthly_points: newMonthly,
          current_streak: newStreak,
          highest_streak: highestStreak,
          tier: newTier,
          badges: currentBadges,
          last_activity_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        };

        // Create Activity Log
        const newLog: GamificationActivityLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          club_id: member.club_id,
          member_id: memberId,
          event_type: eventType,
          points_awarded: basePoints,
          multiplier,
          final_points: finalPoints,
          description: multiplier > 1.0 ? `${description} (${currentStreak}-streak bonus applied)` : description,
          reference_id: referenceId,
          created_at: new Date().toISOString(),
        };

        setActivityLogs(prevLogs => [newLog, ...prevLogs]);

        if (existing) {
          return prevProfiles.map(p => (p.member_id === memberId ? updatedProfile : p));
        } else {
          return [...prevProfiles, updatedProfile];
        }
      });
    },
    [members]
  );

  const updateClubScoreRules = useCallback((clubId: string, rules: Partial<ClubScoreRuleConfig>) => {
    setClubScoreRules(prev => ({
      ...prev,
      [clubId]: {
        ...(prev[clubId] || DEFAULT_CLUBSCORE_RULES[clubId] || {
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
        }),
        ...rules,
      },
    }));
  }, []);

  const getMemberClubScore = useCallback((memberId: string): ClubScoreProfile | undefined => {
    return clubScoreProfiles.find(p => p.member_id === memberId);
  }, [clubScoreProfiles]);

  const getMemberActivityLogs = useCallback((memberId: string): GamificationActivityLog[] => {
    return activityLogs.filter(l => l.member_id === memberId);
  }, [activityLogs]);

  // 4. Add Live Match Event
  const addMatchEvent = useCallback((eventData: Omit<MatchEvent, 'id' | 'created_at'>) => {
    const newEvent: MatchEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };

    setMatchEvents(prev => [...prev, newEvent]);

    // Update match score if event is a goal
    if (eventData.event_type === 'goal' || eventData.event_type === 'penalty') {
      setMatches(prev =>
        prev.map(m => {
          if (m.id === eventData.match_id) {
            return {
              ...m,
              home_score: eventData.team_side === 'home' ? m.home_score + 1 : m.home_score,
              away_score: eventData.team_side === 'away' ? m.away_score + 1 : m.away_score,
            };
          }
          return m;
        })
      );

      // Auto-award ClubScore fantasy points if scorer is in club squad
      if (eventData.player_name) {
        const pName = eventData.player_name.toLowerCase();
        const scorer = members.find(m => pName.includes(m.full_name.toLowerCase()) || m.full_name.toLowerCase().includes(pName));
        if (scorer) {
          awardClubScorePoints(scorer.id, 10, 'match_goal', `Goal (${eventData.minute}') in match`, eventData.match_id);
        }
      }

      // Auto-award assist points
      if (eventData.assist_player_name) {
        const aName = eventData.assist_player_name.toLowerCase();
        const assister = members.find(m => aName.includes(m.full_name.toLowerCase()) || m.full_name.toLowerCase().includes(aName));
        if (assister) {
          awardClubScorePoints(assister.id, 7, 'match_assist', `Assist (${eventData.minute}') in match`, eventData.match_id);
        }
      }
    } else if (eventData.event_type === 'yellow_card' && eventData.player_name) {
      const pName = eventData.player_name.toLowerCase();
      const player = members.find(m => pName.includes(m.full_name.toLowerCase()) || m.full_name.toLowerCase().includes(pName));
      if (player) {
        awardClubScorePoints(player.id, -3, 'disciplinary_card', `Yellow Card (${eventData.minute}') penalty`, eventData.match_id);
      }
    } else if (eventData.event_type === 'red_card' && eventData.player_name) {
      const pName = eventData.player_name.toLowerCase();
      const player = members.find(m => pName.includes(m.full_name.toLowerCase()) || m.full_name.toLowerCase().includes(pName));
      if (player) {
        awardClubScorePoints(player.id, -10, 'disciplinary_card', `Red Card (${eventData.minute}') penalty`, eventData.match_id);
      }
    }
  }, [members, awardClubScorePoints]);

  const deleteMatchEvent = useCallback((eventId: string) => {
    setMatchEvents(prev => {
      const target = prev.find(e => e.id === eventId);
      if (target && (target.event_type === 'goal' || target.event_type === 'penalty')) {
        setMatches(matchesPrev =>
          matchesPrev.map(m => {
            if (m.id === target.match_id) {
              return {
                ...m,
                home_score: target.team_side === 'home' ? Math.max(0, m.home_score - 1) : m.home_score,
                away_score: target.team_side === 'away' ? Math.max(0, m.away_score - 1) : m.away_score,
              };
            }
            return m;
          })
        );
      }
      return prev.filter(e => e.id !== eventId);
    });
  }, []);

  // 5. Events Management
  const addEvent = useCallback((eventData: Omit<ClubEvent, 'id' | 'created_at'>) => {
    const newEvt: ClubEvent = {
      ...eventData,
      id: `event-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setEvents(prev => [newEvt, ...prev]);
  }, []);

  const updateEvent = useCallback((eventId: string, updates: Partial<ClubEvent>) => {
    setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, ...updates } : e)));
  }, []);

  const deleteEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  // 6. Member & Squad Management
  const addMember = useCallback((memberData: Omit<ClubMember, 'id' | 'created_at'>): ClubMember => {
    const newMem: ClubMember = {
      ...memberData,
      id: `mem-${Date.now()}`,
      qr_code_token: memberData.qr_code_token || `pass-${Math.random().toString(36).substring(2, 10)}`,
      created_at: new Date().toISOString(),
    };
    setMembers(prev => [...prev, newMem]);

    // Initialize stats
    const newStats: PlayerStats = {
      id: `stat-${newMem.id}`,
      club_id: newMem.club_id,
      member_id: newMem.id,
      season: '2025/2026',
      appearances: 0,
      minutes_played: 0,
      goals: 0,
      assists: 0,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      motm_awards: 0,
    };
    setPlayerStats(prev => [...prev, newStats]);

    return newMem;
  }, []);

  const updateMember = useCallback((memberId: string, updates: Partial<ClubMember>) => {
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, ...updates } : m)));
  }, []);

  const deleteMember = useCallback((memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
    setPlayerStats(prev => prev.filter(s => s.member_id !== memberId));
  }, []);

  const appointExecutive = useCallback((memberId: string, title: string, bio?: string, order?: number, season?: string) => {
    setMembers(prev =>
      prev.map(m =>
        m.id === memberId
          ? {
              ...m,
              is_executive: true,
              executive_title: title,
              executive_bio: bio || m.executive_bio,
              executive_order: order ?? (m.executive_order || 99),
              executive_season: season || m.executive_season,
            }
          : m
      )
    );
  }, []);

  const updatePlayerStats = useCallback((memberId: string, stats: Partial<PlayerStats>) => {
    setPlayerStats(prev =>
      prev.map(s => (s.member_id === memberId ? { ...s, ...stats } : s))
    );
  }, []);

  // 7. Sponsors
  const addSponsor = useCallback((sponsorData: Omit<Sponsor, 'id'>) => {
    const newSpon: Sponsor = {
      ...sponsorData,
      id: `spon-${Date.now()}`,
    };
    setSponsors(prev => [...prev, newSpon]);
  }, []);

  const updateSponsor = useCallback((sponsorId: string, updates: Partial<Sponsor>) => {
    setSponsors(prev => prev.map(s => (s.id === sponsorId ? { ...s, ...updates } : s)));
  }, []);

  const deleteSponsor = useCallback((sponsorId: string) => {
    setSponsors(prev => prev.filter(s => s.id !== sponsorId));
  }, []);

  // 8. News Articles CMS
  const addNewsArticle = useCallback((articleData: Omit<NewsArticle, 'id' | 'published_at'>) => {
    const newArticle: NewsArticle = {
      ...articleData,
      id: `news-${Date.now()}`,
      published_at: new Date().toISOString(),
    };
    setNews(prev => [newArticle, ...prev]);
  }, []);

  const updateNewsArticle = useCallback((articleId: string, updates: Partial<NewsArticle>) => {
    setNews(prev => prev.map(n => (n.id === articleId ? { ...n, ...updates } : n)));
  }, []);

  const deleteNewsArticle = useCallback((articleId: string) => {
    setNews(prev => prev.filter(n => n.id !== articleId));
  }, []);

  const addMediaItem = useCallback((mediaData: Omit<MediaGalleryItem, 'id' | 'created_at'>) => {
    const newMedia: MediaGalleryItem = {
      ...mediaData,
      id: `media-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setGallery(prev => [newMedia, ...prev]);
  }, []);

  // 9. QR Verification & Check-in
  const verifyMemberPass = useCallback((token: string): { valid: boolean; member?: ClubMember; message: string } => {
    const cleaned = token.trim();
    const member = members.find(
      m => m.qr_code_token === cleaned || m.id === cleaned || cleaned.includes(m.qr_code_token)
    );

    if (!member) {
      return {
        valid: false,
        message: 'Invalid pass: No matching club member found for this QR token.'
      };
    }

    if (member.status === 'suspended') {
      return {
        valid: false,
        member,
        message: 'Pass suspended: This member is currently suspended from club activities.'
      };
    }

    const expiryDate = new Date(member.membership_expires_at);
    if (expiryDate < new Date()) {
      return {
        valid: false,
        member,
        message: `Pass expired: Membership expired on ${member.membership_expires_at}.`
      };
    }

    return {
      valid: true,
      member,
      message: `Verified: Active ${member.membership_tier} pass.`
    };
  }, [members]);

  const checkInMemberToEvent = useCallback((eventId: string, qrToken: string) => {
    const verification = verifyMemberPass(qrToken);
    if (!verification.valid || !verification.member) {
      return {
        success: false,
        message: verification.message
      };
    }

    // Increment event RSVP / attendance count
    setEvents(prev =>
      prev.map(e => (e.id === eventId ? { ...e, rsvp_count: e.rsvp_count + 1 } : e))
    );

    // Auto-award ClubScore points for verified check-in
    const targetEvent = events.find(e => e.id === eventId);
    const category = targetEvent?.category || 'training';
    const basePts = category === 'training' ? 10 : 5;
    awardClubScorePoints(
      verification.member.id,
      basePts,
      category === 'training' ? 'training_checkin' : 'social_checkin',
      `Verified QR Check-In: ${targetEvent?.title || 'Club Event'}`,
      eventId
    );

    return {
      success: true,
      attendeeName: verification.member.full_name,
      message: `Successfully checked in ${verification.member.full_name} (+${basePts} ClubScore pts awarded)`
    };
  }, [verifyMemberPass, events, awardClubScorePoints]);

  // 11. Inquiries
  const submitInquiry = useCallback((inquiryData: Omit<ContactInquiry, 'id' | 'created_at' | 'status'>) => {
    // Stored / logged
    console.log('Inquiry submitted:', inquiryData);
  }, []);

  // 12. Pre-Match Availability & RSVP Hub
  const setPlayerAvailability = useCallback((
    matchId: string,
    memberId: string,
    status: AvailabilityStatus,
    note?: string
  ) => {
    setAvailabilities(prev => {
      const existing = prev.find(a => a.match_id === matchId && a.member_id === memberId);
      if (existing) {
        return prev.map(a =>
          a.id === existing.id
            ? {
                ...a,
                status,
                note: note !== undefined ? sanitizeText(note) : a.note,
                responded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : a
        );
      }
      const newAvail: PlayerAvailability = {
        id: `avail-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        club_id: activeClub?.id || 'club-apex-01',
        match_id: matchId,
        member_id: memberId,
        status,
        note: note ? sanitizeText(note) : undefined,
        response_token: `tok-${memberId}-${Date.now().toString(36)}`,
        responded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [...prev, newAvail];
    });
  }, [activeClub]);

  const getMatchAvailabilities = useCallback((matchId: string): PlayerAvailability[] => {
    return availabilities.filter(a => a.match_id === matchId);
  }, [availabilities]);

  const getAvailabilityByToken = useCallback((token: string) => {
    if (!token) return null;
    const avail = availabilities.find(a => a.response_token === token);
    if (!avail) return null;
    const member = members.find(m => m.id === avail.member_id);
    if (!member) return null;
    const match = matches.find(m => m.id === avail.match_id);
    const event = events.find(e => e.id === avail.event_id);
    return { availability: avail, member, match, event };
  }, [availabilities, members, matches, events]);

  // 13. Draft Lineups (Coach Workbench)
  const saveDraftLineup = useCallback((draft: Partial<DraftLineup> & { match_id: string; club_id: string }) => {
    setDraftLineups(prev => {
      const existing = prev.find(d => d.match_id === draft.match_id);
      if (existing) {
        return prev.map(d =>
          d.id === existing.id
            ? {
                ...d,
                ...draft,
                updated_at: new Date().toISOString(),
              }
            : d
        );
      }
      const newDraft: DraftLineup = {
        id: `draft-${Date.now()}`,
        club_id: draft.club_id,
        match_id: draft.match_id,
        format: draft.format || '11v11',
        formation: draft.formation || '4-3-3',
        lineup_coords: draft.lineup_coords || [],
        bench_member_ids: draft.bench_member_ids || [],
        tactical_notes: draft.tactical_notes ? sanitizeText(draft.tactical_notes) : undefined,
        is_published: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [...prev, newDraft];
    });
  }, []);

  const getDraftLineup = useCallback((matchId: string): DraftLineup | undefined => {
    return draftLineups.find(d => d.match_id === matchId);
  }, [draftLineups]);

  const publishDraftLineup = useCallback((matchId: string): { success: boolean; message: string } => {
    const draft = draftLineups.find(d => d.match_id === matchId);
    if (!draft) {
      return { success: false, message: 'Draft lineup not found for this match.' };
    }

    setMatches(prev =>
      prev.map(m =>
        m.id === matchId
          ? {
              ...m,
              home_formation: draft.formation,
              home_lineup_coords: draft.lineup_coords,
              match_format: draft.format,
            }
          : m
      )
    );

    setDraftLineups(prev =>
      prev.map(d =>
        d.id === draft.id
          ? {
              ...d,
              is_published: true,
              published_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : d
      )
    );

    return {
      success: true,
      message: `Published ${draft.format} ${draft.formation} lineup to live Match Center!`,
    };
  }, [draftLineups]);

  // 14. Post-Match Stats Audit & Leaderboard Baking
  const auditAndBakeMatchStats = useCallback((
    matchId: string,
    payload: MatchAuditPayload
  ): { success: boolean; totalPointsAwarded: number; message: string } => {
    const targetMatch = matches.find(m => m.id === matchId);
    if (!targetMatch) {
      return { success: false, totalPointsAwarded: 0, message: 'Match fixture not found.' };
    }

    let totalXP = 0;
    const rules = clubScoreRules[targetMatch.club_id] || DEFAULT_CLUBSCORE_RULES;

    // 1. Process and award Clean Sheet points to GK & Defenders
    payload.clean_sheet_member_ids.forEach(memId => {
      const pts = rules.points_clean_sheet_gk_def || 10;
      awardClubScorePoints(
        memId,
        pts,
        'match_clean_sheet',
        `Clean Sheet verified vs ${targetMatch.away_team_name}`,
        matchId
      );
      totalXP += pts;

      setPlayerStats(prev =>
        prev.map(s => (s.member_id === memId ? { ...s, clean_sheets: s.clean_sheets + 1 } : s))
      );
    });

    // 2. Process and award Man of the Match (MOTM)
    if (payload.motm_member_id) {
      const pts = rules.points_motm || 15;
      awardClubScorePoints(
        payload.motm_member_id,
        pts,
        'match_motm',
        `Official Man of the Match vs ${targetMatch.away_team_name}`,
        matchId
      );
      totalXP += pts;

      setPlayerStats(prev =>
        prev.map(s => (s.member_id === payload.motm_member_id ? { ...s, motm_awards: s.motm_awards + 1 } : s))
      );
    }

    // 3. Process audited match events (goals, assists, cards)
    payload.audited_events.forEach(evt => {
      if (evt.player_id) {
        if (evt.event_type === 'goal' || evt.event_type === 'penalty') {
          const pts = rules.points_goal_forward || 10;
          awardClubScorePoints(evt.player_id, pts, 'match_goal', `Match Goal (${evt.minute}') verified vs ${targetMatch.away_team_name}`, matchId);
          totalXP += pts;
          setPlayerStats(prev =>
            prev.map(s => (s.member_id === evt.player_id ? { ...s, goals: s.goals + 1 } : s))
          );
        } else if (evt.event_type === 'yellow_card') {
          const pts = rules.points_yellow_card_penalty || -3;
          awardClubScorePoints(evt.player_id, pts, 'disciplinary_card', `Yellow Card (${evt.minute}') audited`, matchId);
          totalXP += pts;
          setPlayerStats(prev =>
            prev.map(s => (s.member_id === evt.player_id ? { ...s, yellow_cards: s.yellow_cards + 1 } : s))
          );
        } else if (evt.event_type === 'red_card') {
          const pts = rules.points_red_card_penalty || -10;
          awardClubScorePoints(evt.player_id, pts, 'disciplinary_card', `Red Card (${evt.minute}') audited`, matchId);
          totalXP += pts;
          setPlayerStats(prev =>
            prev.map(s => (s.member_id === evt.player_id ? { ...s, red_cards: s.red_cards + 1 } : s))
          );
        }
      }

      if (evt.assist_player_id) {
        const pts = rules.points_assist || 7;
        awardClubScorePoints(evt.assist_player_id, pts, 'match_assist', `Match Assist (${evt.minute}') verified vs ${targetMatch.away_team_name}`, matchId);
        totalXP += pts;
        setPlayerStats(prev =>
          prev.map(s => (s.member_id === evt.assist_player_id ? { ...s, assists: s.assists + 1 } : s))
        );
      }
    });

    // 4. Record appearance for squad participants
    payload.appearance_member_ids.forEach(memId => {
      const pts = rules.points_match_appearance || 5;
      awardClubScorePoints(memId, pts, 'match_appearance', `Match Appearance vs ${targetMatch.away_team_name}`, matchId);
      totalXP += pts;
      setPlayerStats(prev =>
        prev.map(s => (s.member_id === memId ? { ...s, appearances: s.appearances + 1, minutes_played: s.minutes_played + 90 } : s))
      );
    });

    // 5. Mark match fixture as audited
    setMatches(prev =>
      prev.map(m =>
        m.id === matchId
          ? {
              ...m,
              is_audited: true,
              audited_at: new Date().toISOString(),
            }
          : m
      )
    );

    return {
      success: true,
      totalPointsAwarded: totalXP,
      message: `Match stats verified and baked! Awarded ${totalXP} ClubScore XP across the squad.`,
    };
  }, [matches, clubScoreRules, awardClubScorePoints]);

  return (
    <ClubContext.Provider
      value={{
        clubs,
        isHydrated,
        activeClub,
        members,
        playerStats,
        matches,
        matchEvents,
        events,
        sponsors,
        news,
        gallery,
        seasons,
        clubScoreProfiles,
        activityLogs,
        clubScoreRules,
        availabilities,
        draftLineups,
        selectClubBySlug,
        createClub,
        updateClubBranding,
        addSeason,
        updateSeason,
        deleteSeason,
        setCurrentSeason,
        getActiveSeason,
        addMatch,
        deleteMatch,
        updateMatch,
        addMatchEvent,
        deleteMatchEvent,
        addEvent,
        updateEvent,
        deleteEvent,
        addMember,
        updateMember,
        deleteMember,
        appointExecutive,
        updatePlayerStats,
        awardClubScorePoints,
        updateClubScoreRules,
        getMemberClubScore,
        getMemberActivityLogs,
        addSponsor,
        updateSponsor,
        deleteSponsor,
        addNewsArticle,
        updateNewsArticle,
        deleteNewsArticle,
        addMediaItem,
        verifyMemberPass,
        checkInMemberToEvent,
        submitInquiry,
        setPlayerAvailability,
        getMatchAvailabilities,
        getAvailabilityByToken,
        saveDraftLineup,
        getDraftLineup,
        publishDraftLineup,
        auditAndBakeMatchStats,
      }}
    >
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
}
