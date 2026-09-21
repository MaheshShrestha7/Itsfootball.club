'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Club,
  ClubMember,
  ClubRole,
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
  ClubSeason,
  ClubAnalytics,
  GateScanRecord,
  ClubAnalyticsSummary,
  MatchAuditPayload,
  MatchAuditItem,
  MemberMessage,
  MemberApplicationInput,
  ClubSeasonStatsSummary,
  HeroSliderPinnedItem,
  InternalTeam,
  Tournament,
  TournamentParticipant,
  TournamentStanding
} from './supabase/types';
import { STANDARD_BADGES, getDefaultClubScoreRules } from './clubscore-defaults';
import {
  generateKnockoutBracket,
  generateRoundRobinSchedule,
  generateGroupKnockoutSchedule,
  computeStandings,
  progressKnockoutMatch,
  seedKnockoutFromGroups
} from './tournament-engine';
import { getSupabaseClient, isSupabaseConfigured } from './supabase/client';
import { newId, stableId, secureToken, isUuid } from './ids';
import { defaultSeasonLabel } from './season';
import { DEFAULT_CREST } from './crest';
import { SupabaseSync, SyncState } from './supabase/sync';

// Singleton BroadcastChannel for reliable cross-tab live synchronization without premature channel closure
let liveBroadcastChannel: BroadcastChannel | null = null;
export function broadcastLiveMatchdayEvent(message: any) {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    if (!liveBroadcastChannel) {
      liveBroadcastChannel = new BroadcastChannel('itsfootball_live_matchday');
    }
    liveBroadcastChannel.postMessage(message);
  } catch {
    try {
      const ch = new BroadcastChannel('itsfootball_live_matchday');
      ch.postMessage(message);
      setTimeout(() => {
        try { ch.close(); } catch {}
      }, 1500);
    } catch {}
  }
}

export interface SyncStatus {
  /** off = Supabase not configured; readonly = changes are waiting for a sign-in */
  phase: 'off' | 'loading' | 'idle' | 'saving' | 'readonly' | 'error';
  message?: string;
  pending?: number;
}

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

  // Supabase sync
  syncStatus: SyncStatus;
  retrySync: () => void;
  /** Re-read everything from Supabase (e.g. after a member profile was linked) */
  reloadFromServer: () => void;

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
  selfCheckInMatch: (matchId: string, attendee: { name?: string; email?: string; token?: string }) => { success: boolean; message: string; attendeeName?: string };
  addMatchEvent: (eventData: Omit<MatchEvent, 'id' | 'created_at'>) => void;
  deleteMatchEvent: (eventId: string) => void;
  
  // Events Management
  addEvent: (eventData: Omit<ClubEvent, 'id' | 'created_at'>) => void;
  updateEvent: (eventId: string, updates: Partial<ClubEvent>) => void;
  deleteEvent: (eventId: string) => void;
  
  // Member & Squad Management
  addMember: (memberData: Omit<ClubMember, 'id' | 'created_at'>) => ClubMember;
  bulkAddMembers: (
    membersData: Omit<ClubMember, 'id' | 'created_at'>[],
    options?: { updateDuplicates?: boolean }
  ) => { added: number; updated: number };
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
  /** Public pass check, run on the server (visitors never receive pass tokens) */
  verifyMemberPassPublic: (token: string) => Promise<{ valid: boolean; member?: ClubMember; message: string }>;
  /** Public door check-in, run on the server */
  publicMatchCheckin: (matchId: string, attendee: { name?: string; email?: string; token?: string }) => Promise<{ success: boolean; message: string; attendeeName?: string }>;
  checkInMemberToEvent: (eventId: string, qrToken: string) => { success: boolean; message: string; attendeeName?: string };
  
  // Inquiries
  submitInquiry: (inquiryData: Omit<ContactInquiry, 'id' | 'created_at' | 'status'>) => Promise<{ success: boolean; error?: string }>;
  inquiries: ContactInquiry[];
  updateInquiryStatus: (inquiryId: string, status: ContactInquiry['status']) => void;

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
  /** Player-facing: look up a personal RSVP link (works for signed-out visitors) */
  resolveAvailabilityToken: (token: string) => Promise<{ availability: PlayerAvailability; member?: ClubMember; match?: Match; event?: ClubEvent } | null>;
  respondToAvailabilityToken: (token: string, status: AvailabilityStatus, note?: string) => Promise<{ success: boolean; error?: string }>;
  /** Admin: make sure a player has a personal RSVP link for this match */
  ensureAvailability: (matchId: string, memberId: string) => PlayerAvailability | undefined;

  // Draft Lineups (Coach Workbench)
  draftLineups: DraftLineup[];
  saveDraftLineup: (draft: Partial<DraftLineup> & { match_id: string; club_id: string }) => void;
  getDraftLineup: (matchId: string) => DraftLineup | undefined;
  publishDraftLineup: (matchId: string) => { success: boolean; message: string };

  // Post-Match Stats Audit & Leaderboard Baking
  auditAndBakeMatchStats: (matchId: string, payload: MatchAuditPayload) => { success: boolean; totalPointsAwarded: number; message: string };

  // Live Analytics & Operations Tracking
  analyticsEvents: ClubAnalytics[];
  gateScans: GateScanRecord[];
  trackPageView: (clubId: string, path: string) => void;
  loadClubAnalytics: (clubId: string) => Promise<void>;
  recordGateScan: (scan: Omit<GateScanRecord, 'id' | 'scanned_at'>) => void;
  getClubAnalytics: (clubId: string) => ClubAnalyticsSummary;

  // Member Portal, Application Lifecycle & Messaging
  memberMessages: MemberMessage[];
  applyForMembership: (clubId: string, input: MemberApplicationInput) => { success: boolean; member?: ClubMember; message: string; error?: string };
  approveMemberApplication: (memberId: string, adminName?: string) => { success: boolean; member?: ClubMember; message: string };
  rejectMemberApplication: (memberId: string, reason: string, adminName?: string) => { success: boolean; member?: ClubMember; message: string };
  sendMemberMessage: (messageData: Omit<MemberMessage, 'id' | 'created_at' | 'is_read'>) => MemberMessage;
  replyToMemberMessage: (originalMessageId: string, replyContent: string, adminName?: string) => { success: boolean; message?: MemberMessage };
  getMemberMessages: (clubId: string, memberId: string) => MemberMessage[];
  getClubMemberMessages: (clubId: string) => MemberMessage[];
  getClubSeasonStats: (clubId: string) => ClubSeasonStatsSummary;

  // Tournaments & Internal Teams Engine (Challonge for Football)
  internalTeams: InternalTeam[];
  tournaments: Tournament[];
  tournamentParticipants: TournamentParticipant[];
  createInternalTeam: (teamData: Omit<InternalTeam, 'id' | 'created_at' | 'updated_at'>) => InternalTeam;
  updateInternalTeam: (teamId: string, updates: Partial<InternalTeam>) => void;
  deleteInternalTeam: (teamId: string) => void;
  createTournament: (tournamentData: Omit<Tournament, 'id' | 'created_at' | 'updated_at'>, participantInputs?: Omit<TournamentParticipant, 'id' | 'tournament_id'>[]) => Tournament;
  updateTournament: (tournamentId: string, updates: Partial<Tournament>) => void;
  deleteTournament: (tournamentId: string) => void;
  addTournamentParticipant: (participantData: Omit<TournamentParticipant, 'id'>) => TournamentParticipant;
  deleteTournamentParticipant: (participantId: string) => void;
  generateTournamentTiesheet: (tournamentId: string, options?: { shuffle?: boolean }) => Match[];
  updateTournamentMatchScore: (matchId: string, homeScore: number, awayScore: number, homePens?: number, awayPens?: number, isCompleted?: boolean) => void;
  progressKnockoutStage: (tournamentId: string) => void;
  getTournamentStandings: (tournamentId: string, group?: string) => TournamentStanding[];
  getTournamentMatches: (tournamentId: string) => Match[];
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
  const [clubs, setClubs] = useState<Club[]>([]);
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [gallery, setGallery] = useState<MediaGalleryItem[]>([]);
  const [clubScoreProfiles, setClubScoreProfiles] = useState<ClubScoreProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<GamificationActivityLog[]>([]);
  const [clubScoreRules, setClubScoreRules] = useState<Record<string, ClubScoreRuleConfig>>({});
  const [availabilities, setAvailabilities] = useState<PlayerAvailability[]>([]);
  const [draftLineups, setDraftLineups] = useState<DraftLineup[]>([]);
  const [seasons, setSeasons] = useState<ClubSeason[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<ClubAnalytics[]>([]);
  const [gateScans, setGateScans] = useState<GateScanRecord[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [memberMessages, setMemberMessages] = useState<MemberMessage[]>([]);
  const [internalTeams, setInternalTeams] = useState<InternalTeam[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentParticipants, setTournamentParticipants] = useState<TournamentParticipant[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Label of a club's current season (falls back to the calendar-based default)
  const seasonsRef = useRef<ClubSeason[]>([]);
  seasonsRef.current = seasons;
  const seasonLabelFor = useCallback((clubId: string): string => {
    const clubSeasons = seasonsRef.current.filter(x => x.club_id === clubId);
    const current = clubSeasons.find(x => x.is_current) || clubSeasons.find(x => x.status === 'active') || clubSeasons[0];
    return current?.name || defaultSeasonLabel();
  }, []);

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
          if (parsed.members?.length) {
            setMembers(parsed.members.map((m: ClubMember) => ({
              ...m,
              membership_status: m.membership_status || 'approved'
            })));
          }
          if (parsed.playerStats?.length) setPlayerStats(parsed.playerStats);
          if (Array.isArray(parsed.matches)) {
            setMatches(parsed.matches);
          }
          if (parsed.matchEvents?.length) setMatchEvents(parsed.matchEvents);
          // Use Array.isArray so empty arrays (all items deleted) are respected
          if (Array.isArray(parsed.events)) setEvents(parsed.events);
          if (Array.isArray(parsed.sponsors)) setSponsors(parsed.sponsors);
          if (Array.isArray(parsed.news)) setNews(parsed.news);
          if (parsed.gallery?.length) setGallery(parsed.gallery);
          if (parsed.clubScoreProfiles?.length) setClubScoreProfiles(parsed.clubScoreProfiles);
          if (parsed.activityLogs?.length) setActivityLogs(parsed.activityLogs);
          if (parsed.clubScoreRules) setClubScoreRules(parsed.clubScoreRules);
          if (parsed.availabilities?.length) setAvailabilities(parsed.availabilities);
          if (parsed.draftLineups?.length) setDraftLineups(parsed.draftLineups);
          if (Array.isArray(parsed.seasons)) setSeasons(parsed.seasons);
          if (parsed.gateScans?.length) setGateScans(parsed.gateScans);
          if (parsed.memberMessages?.length) setMemberMessages(parsed.memberMessages);
          if (Array.isArray(parsed.internalTeams)) {
            setInternalTeams(parsed.internalTeams);
          }
          if (Array.isArray(parsed.tournaments)) {
            setTournaments(parsed.tournaments);
          }
          if (Array.isArray(parsed.tournamentParticipants)) {
            setTournamentParticipants(parsed.tournamentParticipants);
          }
        }
      } catch (err) {
        console.warn('Could not read state from localStorage', err);
      } finally {
        setIsHydrated(true);
      }

    }
  }, []);

  // ---------------------------------------------------------------------------
  // Supabase sync: the database is the source of truth, localStorage is a cache
  // ---------------------------------------------------------------------------
  const syncRef = useRef<SupabaseSync | null>(null);
  const syncStateRef = useRef<Partial<SyncState>>({});
  const flushingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [syncReady, setSyncReady] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    phase: isSupabaseConfigured ? 'loading' : 'off',
  });

  syncStateRef.current = {
    clubs,
    members,
    seasons,
    internalTeams,
    tournaments,
    tournamentParticipants,
    playerStats,
    matches,
    matchEvents,
    events,
    sponsors,
    news,
    gallery,
    clubScoreRules,
    clubScoreProfiles,
    activityLogs,
    availabilities,
    draftLineups,
    memberMessages,
    gateScans,
    inquiries,
  };

  // Reload when the signed-in user changes (admins see more rows than visitors)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabaseClient();
    if (!client) return;
    let lastUid: string | null | undefined;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (lastUid === undefined) {
        lastUid = uid;
        return;
      }
      if (uid !== lastUid) {
        lastUid = uid;
        setLoadNonce(n => n + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Initial / repeat load from Supabase
  useEffect(() => {
    if (!isHydrated || !isSupabaseConfigured) return;
    const client = getSupabaseClient();
    if (!client) return;

    let cancelled = false;
    const engine = new SupabaseSync(client);
    syncRef.current = engine;
    setSyncReady(false);
    setSyncStatus({ phase: 'loading' });

    engine
      .load()
      .then(({ data, errors }) => {
        if (cancelled) return;
        const local = syncStateRef.current;

        // Remote wins field-by-field; rows that exist only locally are kept and uploaded later
        const mergeById = (localRows: any[] = [], remoteRows: any[]) => {
          const localById = new Map(localRows.map(r => [r.id, r]));
          const remoteIds = new Set(remoteRows.map(r => r.id));
          return [
            ...remoteRows.map(r => ({ ...(localById.get(r.id) || {}), ...r })),
            ...localRows.filter(r => !remoteIds.has(r.id)),
          ];
        };

        engine.seed(data);

        if (data.clubs) {
          const merged = mergeById(local.clubs, data.clubs) as Club[];
          setClubs(merged);
          setActiveClub(prev => merged.find(c => c.id === prev?.id) || prev || merged[0] || null);
        }
        if (data.members) setMembers(mergeById(local.members, data.members));
        if (data.seasons) setSeasons(mergeById(local.seasons, data.seasons));
        if (data.internalTeams) setInternalTeams(mergeById(local.internalTeams, data.internalTeams));
        if (data.tournaments) setTournaments(mergeById(local.tournaments, data.tournaments));
        if (data.tournamentParticipants) setTournamentParticipants(mergeById(local.tournamentParticipants, data.tournamentParticipants));
        if (data.playerStats) setPlayerStats(mergeById(local.playerStats, data.playerStats));
        if (data.matches) setMatches(mergeById(local.matches, data.matches));
        if (data.matchEvents) setMatchEvents(mergeById(local.matchEvents, data.matchEvents));
        if (data.events) setEvents(mergeById(local.events, data.events));
        if (data.sponsors) setSponsors(mergeById(local.sponsors, data.sponsors));
        if (data.news) setNews(mergeById(local.news, data.news));
        if (data.gallery) setGallery(mergeById(local.gallery, data.gallery));
        if (data.clubScoreProfiles) setClubScoreProfiles(mergeById(local.clubScoreProfiles, data.clubScoreProfiles));
        if (data.activityLogs) setActivityLogs(mergeById(local.activityLogs, data.activityLogs));
        if (data.availabilities) setAvailabilities(mergeById(local.availabilities, data.availabilities));
        if (data.draftLineups) setDraftLineups(mergeById(local.draftLineups, data.draftLineups));
        if (data.memberMessages) setMemberMessages(mergeById(local.memberMessages, data.memberMessages));
        if (data.gateScans) setGateScans(mergeById(local.gateScans, data.gateScans));
        if (data.inquiries) setInquiries(mergeById(local.inquiries, data.inquiries));
        if (data.clubScoreRules) {
          const rules: Record<string, ClubScoreRuleConfig> = { ...(local.clubScoreRules || {}) };
          (data.clubScoreRules as ClubScoreRuleConfig[]).forEach(r => {
            rules[r.club_id] = { ...(rules[r.club_id] || {}), ...r };
          });
          setClubScoreRules(rules);
        }

        setSyncReady(true);
        setSyncStatus(
          errors.length > 0
            ? { phase: 'error', message: `Could not load: ${errors.join('; ')}` }
            : { phase: 'idle' }
        );
      })
      .catch(err => {
        if (cancelled) return;
        setSyncStatus({ phase: 'error', message: `Could not reach Supabase: ${err?.message || err}` });
      });

    return () => {
      cancelled = true;
    };
  }, [isHydrated, loadNonce]);


  // Live matchday: Supabase pushes match and event changes to every open screen
  const clubIdsKey = clubs.map(c => c.id).filter(id => /^[0-9a-f-]{36}$/i.test(id)).sort().join(',');
  useEffect(() => {
    if (!syncReady || !isSupabaseConfigured || !clubIdsKey) return;
    const client = getSupabaseClient();
    const engine = syncRef.current;
    if (!client || !engine) return;

    const ids = clubIdsKey.split(',').slice(0, 100);
    const filter = `club_id=in.(${ids.join(',')})`;

    const apply = <T extends { id: string }>(
      key: 'matches' | 'matchEvents',
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      payload: any
    ) => {
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (!id) return;
        engine.removeRemote(key, id);
        setter(prev => prev.filter(r => r.id !== id));
        return;
      }
      const row = payload.new;
      if (!row?.id) return;
      setter(prev => {
        const existing = prev.find(r => r.id === row.id);
        const merged = engine.applyRemote(key, existing as any, row) as T;
        return existing ? prev.map(r => (r.id === row.id ? merged : r)) : [...prev, merged];
      });
    };

    const channel = client
      .channel('live-matchday')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter }, payload =>
        apply<Match>('matches', setMatches, payload)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter }, payload =>
        apply<MatchEvent>('matchEvents', setMatchEvents, payload)
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [syncReady, clubIdsKey]);

  const runFlush = useCallback(async () => {
    const engine = syncRef.current;
    if (!engine) return;
    if (flushingRef.current) {
      dirtyRef.current = true;
      return;
    }
    flushingRef.current = true;
    try {
      const result = await engine.flush(syncStateRef.current);
      if (result.errors.length > 0) {
        setSyncStatus({ phase: 'error', message: Array.from(new Set(result.errors)).slice(0, 3).join('; ') });
      } else if (result.pendingReadonly > 0) {
        setSyncStatus({
          phase: 'readonly',
          pending: result.pendingReadonly,
          message: 'Sign in to save your changes to the cloud.',
        });
      } else {
        setSyncStatus({ phase: 'idle' });
      }
    } catch (err: any) {
      setSyncStatus({ phase: 'error', message: `Sync failed: ${err?.message || err}` });
    } finally {
      flushingRef.current = false;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        runFlush();
      }
    }
  }, []);

  // Push local changes shortly after the last edit
  useEffect(() => {
    if (!syncReady) return;
    const timer = setTimeout(runFlush, 800);
    return () => clearTimeout(timer);
  }, [
    syncReady, runFlush,
    clubs, members, seasons, internalTeams, tournaments, tournamentParticipants, playerStats,
    matches, matchEvents, events, sponsors, news, gallery, clubScoreRules, clubScoreProfiles,
    activityLogs, availabilities, draftLineups, memberMessages, gateScans, inquiries,
  ]);

  const reloadFromServer = useCallback(() => setLoadNonce(n => n + 1), []);

  const retrySync = useCallback(() => {
    syncRef.current?.clearFailures();
    if (syncReady) runFlush();
    else setLoadNonce(n => n + 1);
  }, [syncReady, runFlush]);

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
          if (Array.isArray(parsed.events)) setEvents(parsed.events);
          if (Array.isArray(parsed.sponsors)) setSponsors(parsed.sponsors);
          if (Array.isArray(parsed.news)) setNews(parsed.news);
          if (parsed.gallery?.length) setGallery(parsed.gallery);
          if (parsed.clubScoreProfiles?.length) setClubScoreProfiles(parsed.clubScoreProfiles);
          if (parsed.activityLogs?.length) setActivityLogs(parsed.activityLogs);
          if (parsed.clubScoreRules) setClubScoreRules(parsed.clubScoreRules);
          if (parsed.availabilities?.length) setAvailabilities(parsed.availabilities);
          if (parsed.draftLineups?.length) setDraftLineups(parsed.draftLineups);
          if (Array.isArray(parsed.seasons)) setSeasons(parsed.seasons);
          if (parsed.gateScans?.length) setGateScans(parsed.gateScans);
          if (parsed.memberMessages?.length) setMemberMessages(parsed.memberMessages);
          if (Array.isArray(parsed.internalTeams)) setInternalTeams(parsed.internalTeams);
          if (Array.isArray(parsed.tournaments)) setTournaments(parsed.tournaments);
          if (Array.isArray(parsed.tournamentParticipants)) setTournamentParticipants(parsed.tournamentParticipants);
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
          seasons,
          gateScans,
          memberMessages,
          internalTeams,
          tournaments,
          tournamentParticipants,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (err) {
        console.warn('Could not save state to localStorage', err);
      }
    }
  }, [
    isHydrated,
    clubs,
    activeClub?.id,
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
    seasons,
    gateScans,
    memberMessages,
    internalTeams,
    tournaments,
    tournamentParticipants,
  ]);

  // Cross-tab live synchronization via BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      const channel = new BroadcastChannel('itsfootball_live_matchday');
      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.type) return;

        if (data.type === 'MATCH_UPDATED' && data.matchId && data.updates) {
          setMatches(prev => prev.map(m => m.id === data.matchId ? { ...m, ...data.updates } : m));
        } else if (data.type === 'MATCH_EVENT_ADDED' && data.event) {
          setMatchEvents(prev => {
            if (prev.some(e => e.id === data.event.id)) return prev;
            return [...prev, data.event];
          });
          if (data.event.event_type === 'goal' || data.event.event_type === 'penalty') {
            setMatches(prev => prev.map(m => {
              if (m.id === data.matchId) {
                return {
                  ...m,
                  home_score: data.event.team_side === 'home' ? m.home_score + 1 : m.home_score,
                  away_score: data.event.team_side === 'away' ? m.away_score + 1 : m.away_score,
                };
              }
              return m;
            }));
          }
        } else if (data.type === 'MATCH_EVENT_DELETED' && data.eventId) {
          setMatchEvents(prev => {
            const target = prev.find(e => e.id === data.eventId);
            if (target && (target.event_type === 'goal' || target.event_type === 'penalty')) {
              setMatches(matchesPrev => matchesPrev.map(m => {
                if (m.id === (data.matchId || target.match_id)) {
                  return {
                    ...m,
                    home_score: target.team_side === 'home' ? Math.max(0, m.home_score - 1) : m.home_score,
                    away_score: target.team_side === 'away' ? Math.max(0, m.away_score - 1) : m.away_score,
                  };
                }
                return m;
              }));
            }
            return prev.filter(e => e.id !== data.eventId);
          });
        } else if (data.type === 'MATCH_CHECKIN' && data.matchId) {
          setMatches(prev => prev.map(m => m.id === data.matchId ? { ...m, checkin_count: (m.checkin_count || 0) + 1 } : m));
        }
      };
      return () => {
        channel.close();
      };
    } catch {
      // BroadcastChannel unavailable
    }
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

  // 1. Create Club with validation & sanitization
  const createClub = useCallback((clubData: Partial<Club>): Club => {
    const rawSlug = clubData.slug || clubData.name || `club-${Date.now()}`;
    const slugResult = validateClubSlug(rawSlug, clubs);
    const finalSlug = slugResult.cleanSlug;

    const clubId = newId();
    const cleanName = sanitizeText(clubData.name) || 'New Football Club';

    const newClub: Club = {
      id: clubId,
      owner_id: clubData.owner_id,
      slug: finalSlug,
      name: cleanName,
      short_name: sanitizeText(clubData.short_name) || cleanName.substring(0, 3).toUpperCase(),
      motto: sanitizeText(clubData.motto),
      founded_year: clubData.founded_year || new Date().getFullYear(),
      logo_url: clubData.logo_url || DEFAULT_CREST,
      banner_url: clubData.banner_url || 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
      primary_color: clubData.primary_color || '#10B981',
      secondary_color: clubData.secondary_color || '#0F172A',
      accent_color: clubData.accent_color || '#F59E0B',
      stadium_name: sanitizeText(clubData.stadium_name),
      stadium_address: sanitizeText(clubData.stadium_address),
      stadium_capacity: clubData.stadium_capacity || 0,
      stadium_pitch_type: sanitizeText(clubData.stadium_pitch_type),
      stadium_parking_info: sanitizeText(clubData.stadium_parking_info),
      contact_email: sanitizeText(clubData.contact_email),
      contact_phone: sanitizeText(clubData.contact_phone),
      custom_domain: sanitizeText(clubData.custom_domain) || undefined,
      hero_pinned_items: clubData.hero_pinned_items || [],
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setClubs(prev => [...prev, newClub]);
    setActiveClub(newClub);

    // If Supabase is connected, asynchronously insert the club

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

    if (typeof window !== 'undefined') {
      try {
        const currentSaved = localStorage.getItem(STORAGE_KEY);
        const parsed = currentSaved ? JSON.parse(currentSaved) : {};
        const updatedClubs = (parsed.clubs || clubs).map((c: Club) =>
          c.id === clubId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...parsed,
          clubs: updatedClubs,
          activeClubId: activeClub?.id === clubId ? clubId : parsed.activeClubId,
        }));
      } catch (err) {
        console.warn('Could not immediately sync branding to localStorage', err);
      }

      try {
        window.dispatchEvent(new CustomEvent('itsfootball-club-updated', { detail: { clubId } }));
      } catch (e) {
        // ignore
      }
    }
  }, [clubs, activeClub]);

  // Season Management
  const addSeason = useCallback((seasonData: Omit<ClubSeason, 'id' | 'created_at' | 'updated_at'>): ClubSeason => {
    const newSeason: ClubSeason = {
      ...seasonData,
      id: newId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSeasons(prev => {
      if (newSeason.is_current) {
        return [...prev.map(s => s.club_id === newSeason.club_id ? { ...s, is_current: false } : s), newSeason];
      }
      return [...prev, newSeason];
    });

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
  }, []);

  const deleteSeason = useCallback((seasonId: string) => {
    setSeasons(prev => prev.filter(s => s.id !== seasonId));
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
    const matchId = newId();
    const qrCode = matchData.door_qr_checkin_enabled
      ? (matchData.door_qr_code || secureToken('door-match'))
      : matchData.door_qr_code;

    const newMatch: Match = {
      ...matchData,
      id: matchId,
      door_qr_code: qrCode,
      checkin_count: matchData.checkin_count || 0,
      created_at: new Date().toISOString(),
    };
    setMatches(prev => [newMatch, ...prev]);

    // Handle hero slider pinning if requested
    if (newMatch.featured_on_hero) {
      setClubs(prevClubs => prevClubs.map(c => {
        if (c.id === newMatch.club_id) {
          const existingPins = c.hero_pinned_items || [];
          const pinId = `pin-fixture-${newMatch.id}`;
          const newPin: HeroSliderPinnedItem = {
            id: pinId,
            type: 'fixture',
            target_id: newMatch.id,
            title: newMatch.title || `${newMatch.home_team_name} vs ${newMatch.away_team_name}`,
            subtitle: `${newMatch.match_type ? newMatch.match_type.toUpperCase() + ' • ' : ''}${newMatch.venue}`,
            badge: `FEATURED MATCH • ${(newMatch.match_type || 'FIXTURE').toUpperCase()}`,
            image_url: newMatch.match_flyer_url || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
            cta_label: 'Match Preview & Details',
            cta_link: `/${c.slug}/match/${newMatch.id}`,
            is_active: true,
            order: 1,
          };
          const filtered = existingPins.filter(p => p.target_id !== newMatch.id && p.id !== pinId);
          return {
            ...c,
            hero_pinned_items: [newPin, ...filtered.map((item, idx) => ({ ...item, order: idx + 2 }))],
            updated_at: new Date().toISOString(),
          };
        }
        return c;
      }));
    }

    return newMatch;
  }, []);

  const deleteMatch = useCallback((matchId: string) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setMatchEvents(prev => prev.filter(e => e.match_id !== matchId));

    // Also remove from hero slider pinned items if present
    setClubs(prevClubs => prevClubs.map(c => ({
      ...c,
      hero_pinned_items: (c.hero_pinned_items || []).filter(p => p.target_id !== matchId && p.id !== `pin-fixture-${matchId}`)
    })));
  }, []);

  // 3. Update Match
  const updateMatch = useCallback((matchId: string, updates: Partial<Match>) => {
    setMatches(prev =>
      prev.map(m => {
        if (m.id === matchId) {
          const updated = { ...m, ...updates };
          // Any change to the period / status / minute restarts the shared match clock
          if (
            updates.period_started_at === undefined &&
            (updates.period !== undefined || updates.status !== undefined || updates.current_minute !== undefined)
          ) {
            updated.period_started_at = new Date().toISOString();
          }
          if (updated.door_qr_checkin_enabled && !updated.door_qr_code) {
            updated.door_qr_code = secureToken('door-match');
          }
          return updated;
        }
        return m;
      })
    );

    // Sync hero slider if featured_on_hero was updated
    if (updates.featured_on_hero !== undefined) {
      setMatches(currentMatches => {
        const targetMatch = currentMatches.find(m => m.id === matchId);
        if (targetMatch) {
          const clubId = targetMatch.club_id;
          setClubs(prevClubs => prevClubs.map(c => {
            if (c.id === clubId) {
              const existingPins = c.hero_pinned_items || [];
              const pinId = `pin-fixture-${matchId}`;
              if (updates.featured_on_hero) {
                const newPin: HeroSliderPinnedItem = {
                  id: pinId,
                  type: 'fixture',
                  target_id: matchId,
                  title: updates.title || targetMatch.title || `${targetMatch.home_team_name} vs ${targetMatch.away_team_name}`,
                  subtitle: `${(updates.match_type || targetMatch.match_type) ? (updates.match_type || targetMatch.match_type)!.toUpperCase() + ' • ' : ''}${updates.venue || targetMatch.venue}`,
                  badge: `FEATURED MATCH • ${(updates.match_type || targetMatch.match_type || 'FIXTURE').toUpperCase()}`,
                  image_url: updates.match_flyer_url || targetMatch.match_flyer_url || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
                  cta_label: 'Match Preview & Details',
                  cta_link: `/${c.slug}/match/${matchId}`,
                  is_active: true,
                  order: 1,
                };
                const filtered = existingPins.filter(p => p.target_id !== matchId && p.id !== pinId);
                return {
                  ...c,
                  hero_pinned_items: [newPin, ...filtered.map((item, idx) => ({ ...item, order: idx + 2 }))],
                  updated_at: new Date().toISOString(),
                };
              } else {
                return {
                  ...c,
                  hero_pinned_items: existingPins.filter(p => p.target_id !== matchId && p.id !== pinId),
                  updated_at: new Date().toISOString(),
                };
              }
            }
            return c;
          }));
        }
        return currentMatches;
      });
    }

    // Cross-tab broadcast for live match centre and public screens
    broadcastLiveMatchdayEvent({
      type: 'MATCH_UPDATED',
      matchId,
      updates,
      timestamp: Date.now(),
    });
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
          id: existing?.id || newId(),
          club_id: member.club_id,
          member_id: memberId,
          season: existing?.season || seasonLabelFor(member.club_id),
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
          id: newId(),
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
        ...(prev[clubId] || getDefaultClubScoreRules(clubId)),
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
      id: newId(),
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

    // Broadcast live event to public match centres and scoreboards
    broadcastLiveMatchdayEvent({
      type: 'MATCH_EVENT_ADDED',
      matchId: eventData.match_id,
      event: newEvent,
      timestamp: Date.now(),
    });
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

      broadcastLiveMatchdayEvent({
        type: 'MATCH_EVENT_DELETED',
        eventId,
        matchId: target?.match_id,
        timestamp: Date.now(),
      });

      return prev.filter(e => e.id !== eventId);
    });
  }, []);

  // 5. Events Management
  const addEvent = useCallback((eventData: Omit<ClubEvent, 'id' | 'created_at'>) => {
    const newEvt: ClubEvent = {
      ...eventData,
      id: newId(),
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
      id: newId(),
      qr_code_token: memberData.qr_code_token || secureToken('pass'),
      created_at: new Date().toISOString(),
    };
    setMembers(prev => [...prev, newMem]);

    // Initialize stats
    const newStats: PlayerStats = {
      id: stableId(`stat-${newMem.id}-${new Date().getFullYear()}`),
      club_id: newMem.club_id,
      member_id: newMem.id,
      season: seasonLabelFor(newMem.club_id),
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

  const bulkAddMembers = useCallback(
    (
      membersData: Omit<ClubMember, 'id' | 'created_at'>[],
      options?: { updateDuplicates?: boolean }
    ): { added: number; updated: number } => {
      let added = 0;
      let updated = 0;
      const updateDuplicates = options?.updateDuplicates ?? true;

      setMembers(prev => {
        const nextMembers = [...prev];
        const newStats: PlayerStats[] = [];

        membersData.forEach((memData, idx) => {
          const emailLower = memData.email?.trim().toLowerCase();
          const existingIdx = emailLower
            ? nextMembers.findIndex(
                m => m.club_id === memData.club_id && m.email?.trim().toLowerCase() === emailLower
              )
            : -1;

          if (existingIdx !== -1 && updateDuplicates) {
            nextMembers[existingIdx] = {
              ...nextMembers[existingIdx],
              ...memData,
              updated_at: new Date().toISOString(),
            };
            updated++;
          } else if (existingIdx === -1) {
            const newMem: ClubMember = {
              ...memData,
              id: newId(),
              qr_code_token:
                memData.qr_code_token ||
                secureToken('pass'),
              created_at: new Date().toISOString(),
            };
            nextMembers.push(newMem);
            added++;

            newStats.push({
              id: stableId(`stat-${newMem.id}-${new Date().getFullYear()}`),
              club_id: newMem.club_id,
              member_id: newMem.id,
              season: seasonLabelFor(newMem.club_id),
              appearances: 0,
              minutes_played: 0,
              goals: 0,
              assists: 0,
              clean_sheets: 0,
              yellow_cards: 0,
              red_cards: 0,
              motm_awards: 0,
            });
          }
        });

        if (newStats.length > 0) {
          setPlayerStats(statPrev => [...statPrev, ...newStats]);
        }

        return nextMembers;
      });

      return { added, updated };
    },
    []
  );

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
    const clubId = members.find(m => m.id === memberId)?.club_id;
    const label = clubId ? seasonLabelFor(clubId) : undefined;
    setPlayerStats(prev => {
      const rows = prev.filter(s => s.member_id === memberId);
      // Edit only the current season's row; older seasons keep their history
      const target = rows.find(s => s.season === label) || (rows.length === 1 ? rows[0] : undefined);
      if (!target) return prev;
      return prev.map(s => (s.id === target.id ? { ...s, ...stats, id: s.id, member_id: s.member_id, season: s.season } : s));
    });
  }, [members, seasonLabelFor]);

  // 7. Sponsors
  const addSponsor = useCallback((sponsorData: Omit<Sponsor, 'id'>) => {
    const newSpon: Sponsor = {
      ...sponsorData,
      id: newId(),
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
      id: newId(),
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
      id: newId(),
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
  const submitInquiry = useCallback(async (
    inquiryData: Omit<ContactInquiry, 'id' | 'created_at' | 'status'>
  ): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Messages cannot be sent right now. Please try again later.' };

    const message = sanitizeText(inquiryData.message);
    const name = sanitizeText(inquiryData.sender_name);
    const email = sanitizeText(inquiryData.sender_email);
    if (!name || !email || !message) return { success: false, error: 'Please fill in your name, email and message.' };
    if (message.length > 4000) return { success: false, error: 'Your message is too long (4000 characters maximum).' };

    // Straight to the database (visitors have no local copy); club admins read it in their inbox
    const { error } = await client.from('contact_inquiries').insert({
      id: newId(),
      club_id: inquiryData.club_id,
      sender_name: name,
      sender_email: email,
      sender_phone: inquiryData.sender_phone ? sanitizeText(inquiryData.sender_phone) : null,
      inquiry_type: inquiryData.inquiry_type,
      message,
      status: 'unread',
    });
    if (error) return { success: false, error: 'Your message could not be sent. Please try again in a moment.' };
    return { success: true };
  }, []);

  const updateInquiryStatus = useCallback((inquiryId: string, status: ContactInquiry['status']) => {
    setInquiries(prev => prev.map(i => (i.id === inquiryId ? { ...i, status } : i)));
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
        id: newId(),
        club_id: matches.find(m => m.id === matchId)?.club_id || members.find(m => m.id === memberId)?.club_id || '',
        match_id: matchId,
        member_id: memberId,
        status,
        note: note ? sanitizeText(note) : undefined,
        response_token: secureToken('rsvp'),
        responded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [...prev, newAvail];
    });
  }, [matches, members]);

  const getMatchAvailabilities = useCallback((matchId: string): PlayerAvailability[] => {
    return availabilities.filter(a => a.match_id === matchId);
  }, [availabilities]);

  const ensureAvailability = useCallback((matchId: string, memberId: string): PlayerAvailability | undefined => {
    const existing = availabilities.find(a => a.match_id === matchId && a.member_id === memberId);
    if (existing) return existing;
    const match = matches.find(m => m.id === matchId);
    if (!match) return undefined;
    const created: PlayerAvailability = {
      id: newId(),
      club_id: match.club_id,
      match_id: matchId,
      member_id: memberId,
      status: 'pending',
      response_token: secureToken('rsvp'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAvailabilities(prev =>
      prev.some(a => a.match_id === matchId && a.member_id === memberId) ? prev : [...prev, created]
    );
    return created;
  }, [availabilities, matches]);

  const resolveAvailabilityToken = useCallback(async (token: string) => {
    const client = getSupabaseClient();
    if (!client || !token) return null;
    const { data, error } = await client.rpc('get_availability_by_token', { p_token: token });
    const availability = Array.isArray(data) ? (data[0] as PlayerAvailability | undefined) : undefined;
    if (error || !availability) return null;
    return {
      availability,
      member: members.find(m => m.id === availability.member_id),
      match: matches.find(m => m.id === availability.match_id),
      event: events.find(e => e.id === availability.event_id),
    };
  }, [members, matches, events]);

  const respondToAvailabilityToken = useCallback(async (token: string, status: AvailabilityStatus, note?: string) => {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Responses cannot be saved right now.' };
    const { data, error } = await client.rpc('respond_availability', {
      p_token: token,
      p_status: status,
      p_note: note ? sanitizeText(note) : null,
    });
    if (error || !Array.isArray(data) || data.length === 0) {
      return { success: false, error: 'This link is no longer valid. Please ask your club for a new one.' };
    }
    return { success: true };
  }, []);

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
        id: newId(),
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
    const rules = clubScoreRules[targetMatch.club_id] || getDefaultClubScoreRules(targetMatch.club_id);

    // 1. Process and award Clean Sheet points to GK & Defenders
    payload.clean_sheet_member_ids.forEach((memId: string) => {
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
    payload.audited_events.forEach((evt: MatchAuditItem) => {
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
    payload.appearance_member_ids.forEach((memId: string) => {
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

  // 18. Live Analytics & Operations Tracking
  const trackPageView = useCallback((clubId: string, path: string) => {
    if (typeof window === 'undefined') return;
    const client = getSupabaseClient();
    if (!client || !isUuid(clubId)) return;

    try {
      // One count per page per 30 minutes for the same browser
      const key = `itsfootball_pv_${clubId}_${path}`;
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // storage unavailable: count it anyway
    }

    let device = 'Desktop';
    const ua = navigator.userAgent || '';
    if (/tablet|ipad/i.test(ua) || (window.innerWidth >= 768 && window.innerWidth <= 1024)) {
      device = 'Tablet';
    } else if (/mobile|iphone|android|phone/i.test(ua) || window.innerWidth < 768) {
      device = 'Mobile';
    }

    // Anonymous, stable per browser so unique visitors can be counted
    let visitor = '';
    try {
      visitor = localStorage.getItem('itsfootball_vid') || '';
      if (!visitor) {
        visitor = secureToken('v').slice(0, 24);
        localStorage.setItem('itsfootball_vid', visitor);
      }
    } catch {
      visitor = 'anon';
    }

    client
      .from('club_analytics')
      .insert({
        id: newId(),
        club_id: clubId,
        event_type: 'page_view',
        page_path: path.slice(0, 255),
        visitor_hash: visitor,
        referrer: document.referrer || null,
        metadata: { device, screenWidth: window.innerWidth },
      })
      .then(({ error }) => {
        if (error) console.warn('Could not record page view:', error.message);
      });
  }, []);

  // Admin dashboards read the last 90 days of visits straight from the database
  const loadClubAnalytics = useCallback(async (clubId: string) => {
    const client = getSupabaseClient();
    if (!client || !isUuid(clubId)) return;
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await client
      .from('club_analytics')
      .select('*')
      .eq('club_id', clubId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) {
      console.warn('Could not load analytics:', error.message);
      return;
    }
    setAnalyticsEvents(prev => [
      ...(data as ClubAnalytics[]),
      ...prev.filter(e => e.club_id !== clubId),
    ]);
  }, []);

  const recordGateScan = useCallback((scan: Omit<GateScanRecord, 'id' | 'scanned_at'>) => {
    const newScan: GateScanRecord = {
      ...scan,
      id: newId(),
      scanned_at: new Date().toISOString(),
    };

    setGateScans(prev => [newScan, ...prev.slice(0, 499)]);
  }, []);

  const selfCheckInMatch = useCallback((
    matchId: string,
    attendee: { name?: string; email?: string; token?: string }
  ) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) {
      return { success: false, message: 'Match fixture not found.' };
    }
    if (!match.door_qr_checkin_enabled) {
      return { success: false, message: 'Door QR self check-in is not active for this fixture.' };
    }

    let attendeeName = (attendee.name || '').trim();
    let memberId: string | undefined = undefined;

    // If member pass token provided, verify member
    if (attendee.token) {
      const token = attendee.token.trim().toLowerCase();
      const member = members.find(m =>
        m.club_id === match.club_id &&
        (m.qr_code_token?.toLowerCase() === token || m.id.toLowerCase() === token)
      );
      if (member) {
        attendeeName = member.full_name;
        memberId = member.id;
        // Award attendance points
        awardClubScorePoints(
          member.id,
          15,
          'match_appearance',
          `Matchday Turnstile Check-in: ${match.title || match.home_team_name + ' vs ' + match.away_team_name}`,
          match.id
        );
      } else if (!attendeeName) {
        return { success: false, message: 'Invalid member pass token provided.' };
      }
    }

    if (!attendeeName) {
      attendeeName = 'General Supporter';
    }

    // Increment checkin count on match
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, checkin_count: (m.checkin_count || 0) + 1 } : m));

    // Record gate scan
    recordGateScan({
      club_id: match.club_id,
      scan_type: 'match_checkin',
      token: attendee.token || `door-guest-${Date.now()}`,
      member_id: memberId,
      member_name: attendeeName,
      match_id: match.id,
      match_title: match.title || `${match.home_team_name} vs ${match.away_team_name}`,
      valid: true,
    });

    broadcastLiveMatchdayEvent({
      type: 'MATCH_CHECKIN',
      matchId,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: `Welcome to ${match.venue}! Entry check-in confirmed.`,
      attendeeName
    };
  }, [matches, members, awardClubScorePoints, recordGateScan]);

  const verifyMemberPassPublic = useCallback(async (token: string): Promise<{ valid: boolean; member?: ClubMember; message: string }> => {
    // A scanned QR may carry a whole link (".../verify?token=abc"); pull the token out of it
    let cleaned = token.trim();
    try {
      const fromUrl = new URL(cleaned).searchParams.get('token');
      if (fromUrl) cleaned = fromUrl.trim();
    } catch {
      // not a URL: use as typed
    }
    if (!cleaned) return { valid: false, message: 'Please enter a pass token.' };

    const client = getSupabaseClient();
    if (!client) return { valid: false, message: 'Pass verification is unavailable right now.' };

    const { data, error } = await client.rpc('verify_member_pass', { p_token: cleaned });
    if (error) return { valid: false, message: 'Pass verification is unavailable right now. Please try again.' };

    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row) return { valid: false, message: 'Invalid pass: No matching club member found for this QR token.' };

    const member = {
      id: row.id,
      club_id: row.club_id,
      full_name: row.full_name,
      email: '',
      role: row.role,
      player_position: row.player_position || undefined,
      jersey_number: row.jersey_number ?? undefined,
      photo_url: row.photo_url || undefined,
      status: row.status,
      qr_code_token: '',
      membership_tier: row.membership_tier,
      membership_expires_at: row.membership_expires_at,
      is_executive: row.is_executive,
      executive_title: row.executive_title || undefined,
      created_at: '',
    } as ClubMember;

    if (row.membership_status !== 'approved') {
      return { valid: false, member, message: 'Pass not active: this membership has not been approved.' };
    }
    if (row.status === 'suspended') {
      return { valid: false, member, message: 'Pass suspended: This member is currently suspended from club activities.' };
    }
    if (row.membership_expires_at && new Date(row.membership_expires_at) < new Date()) {
      return { valid: false, member, message: `Pass expired: Membership expired on ${row.membership_expires_at}.` };
    }
    return { valid: true, member, message: 'Valid pass: this member is accredited and active.' };
  }, []);

  const publicMatchCheckin = useCallback(async (
    matchId: string,
    attendee: { name?: string; email?: string; token?: string }
  ): Promise<{ success: boolean; message: string; attendeeName?: string }> => {
    const client = getSupabaseClient();
    if (!client) return { success: false, message: 'Check-in is unavailable right now. Please try again.' };

    const { data, error } = await client.rpc('public_match_checkin', {
      p_match_id: matchId,
      p_token: attendee.token || null,
      p_name: attendee.name ? sanitizeText(attendee.name) : null,
      p_email: attendee.email ? sanitizeText(attendee.email) : null,
    });
    if (error) return { success: false, message: 'Check-in failed. Please try again or ask a steward for help.' };

    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row) return { success: false, message: 'Check-in failed. Please try again.' };
    return { success: row.success, message: row.message, attendeeName: row.attendee_name || undefined };
  }, []);

  const getClubAnalytics = useCallback((clubId: string): ClubAnalyticsSummary => {
    const clubViews = analyticsEvents.filter(e => e.club_id === clubId);
    const clubScans = gateScans.filter(s => s.club_id === clubId);

    const totalVisits = clubViews.length;

    // Day of week buckets (Mon -> Sun)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat (Matchday)', 'Sun'];
    const weeklyVisits = [0, 0, 0, 0, 0, 0, 0];

    // Add real views into corresponding days
    clubViews.forEach(v => {
      const dayIdx = new Date(v.created_at).getDay(); // 0 is Sun, 1 is Mon...
      const mappedIdx = dayIdx === 0 ? 6 : dayIdx - 1; // map to 0=Mon, ..., 6=Sun
      weeklyVisits[mappedIdx] = (weeklyVisits[mappedIdx] || 0) + 1;
    });

    // Gate Scans
    const gateScansCount = clubScans.length;

    // Match Center peak viewers
    const liveMatch = matches.find(m => m.club_id === clubId && m.status === 'live');
    const matchViews = clubViews.filter(v => v.page_path.includes('/match') || v.page_path.includes('match-center')).length;
    const matchCenterFans = liveMatch ? matchViews : 0;

    // Device breakdown
    const mobileCount = clubViews.filter(v => (v.metadata as any)?.device === 'Mobile').length;
    const desktopCount = clubViews.filter(v => (v.metadata as any)?.device === 'Desktop').length;
    const tabletCount = clubViews.filter(v => (v.metadata as any)?.device === 'Tablet').length;
    const totalRecorded = clubViews.length || 1;
    const mobilePct = Math.round((mobileCount / totalRecorded) * 100);
    const desktopPct = Math.round((desktopCount / totalRecorded) * 100);
    const tabletPct = Math.round((tabletCount / totalRecorded) * 100);

    // Section breakdown
    const sectionHits: Record<string, number> = {
      'Live Match-Day Center': clubViews.filter(v => v.page_path.includes('/match')).length * 5,
      'First Team Squad & Stats': clubViews.filter(v => v.page_path.includes('/squad') || v.page_path.includes('#squad')).length * 5,
      'Fixtures & Results': clubViews.filter(v => v.page_path.includes('/events') || v.page_path.includes('#fixtures')).length * 5,
      'Digital Member Pass Portal': clubViews.filter(v => v.page_path.includes('/member')).length * 5,
      'Home Ground & Stadium Guide': clubViews.filter(v => v.page_path.includes('/branding') || v.page_path.includes('stadium')).length * 5,
    };
    const totalSectionHits = Object.values(sectionHits).reduce((a, b) => a + b, 0) || 1;

    const colors: Record<string, string> = {
      'Live Match-Day Center': '#EF4444',
      'First Team Squad & Stats': 'var(--club-primary)',
      'Fixtures & Results': '#3B82F6',
      'Digital Member Pass Portal': '#F59E0B',
      'Home Ground & Stadium Guide': '#A855F7',
    };

    const topSections = Object.entries(sectionHits).map(([name, count]) => ({
      name,
      count,
      views: `${Math.round((count / totalSectionHits) * 1000) / 10}%`,
      color: colors[name] || '#10B981',
    }));

    return {
      totalVisits,
      weeklyVisits,
      weeklyDays: days,
      matchCenterFans,
      gateScansCount,
      avgDuration: '—',
      topSections,
      deviceBreakdown: [
        { name: 'Mobile Phones (Smartphones)', percentage: `${mobilePct}%`, color: '#10B981' },
        { name: 'Desktop & Laptops', percentage: `${desktopPct}%`, color: '#3B82F6' },
        { name: 'Tablets & Consoles', percentage: `${tabletPct}%`, color: '#F59E0B' },
      ],
      recentGateScans: clubScans.slice(0, 10),
    };
  }, [analyticsEvents, gateScans, matches]);

  // 17. Member Portal Workflow, Applications, Magic Links & Admin Messaging
  const applyForMembership = useCallback((clubId: string, input: MemberApplicationInput): { success: boolean; member?: ClubMember; message: string; error?: string } => {
    const cleanEmail = input.email.toLowerCase().trim();
    const cleanName = sanitizeText(input.full_name.trim());
    
    if (!cleanEmail || !cleanName) {
      return { success: false, message: 'Please provide full name and valid email address.', error: 'Missing required fields' };
    }

    const existing = members.find(m => m.club_id === clubId && m.email.toLowerCase() === cleanEmail);
    if (existing) {
      if (existing.membership_status === 'pending') {
        return {
          success: false,
          member: existing,
          message: 'You already have an active application under committee review. Club administrators will process your membership shortly.',
          error: 'Application already pending'
        };
      } else if (existing.membership_status === 'approved') {
        return {
          success: false,
          member: existing,
          message: 'An active membership already exists for this email address. Please proceed to sign in with your email or magic link.',
          error: 'Member already approved'
        };
      }
    }

    const role: ClubRole = input.membership_tier.toLowerCase().includes('supporter') ? 'supporter' : 'player';
    const newMemberId = newId();
    const pendingToken = secureToken('pass-pending');

    const newMem: ClubMember = {
      id: newMemberId,
      club_id: clubId,
      full_name: cleanName,
      email: cleanEmail,
      phone: input.phone ? sanitizeText(input.phone.trim()) : undefined,
      role,
      player_position: input.player_position,
      jersey_number: input.jersey_number,
      status: 'active',
      membership_status: 'pending',
      membership_tier: input.membership_tier || 'Supporter Season Pass',
      membership_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      qr_code_token: pendingToken,
      is_executive: false,
      applied_at: new Date().toISOString(),
      application_notes: input.application_notes ? sanitizeText(input.application_notes) : undefined,
      emergency_contact: input.emergency_contact ? sanitizeText(input.emergency_contact) : undefined,
      created_at: new Date().toISOString(),
    };

    setMembers(prev => [...prev, newMem]);

    // Initialize stats
    const newStats: PlayerStats = {
      id: stableId(`stat-${newMem.id}-${new Date().getFullYear()}`),
      club_id: clubId,
      member_id: newMem.id,
      season: seasonLabelFor(clubId),
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

    return {
      success: true,
      member: newMem,
      message: 'Membership application submitted successfully! Your application is in the committee queue for approval.'
    };
  }, [members]);

  const approveMemberApplication = useCallback((memberId: string, adminName: string = 'Club Committee'): { success: boolean; member?: ClubMember; message: string } => {
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return { success: false, message: 'Member record not found.' };
    }

    const activeToken = secureToken('pass');

    const updatedMember: ClubMember = {
      ...member,
      membership_status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminName,
      qr_code_token: activeToken,
      updated_at: new Date().toISOString(),
    };

    setMembers(prev => prev.map(m => (m.id === memberId ? updatedMember : m)));

    // Award welcome points
    awardClubScorePoints(memberId, 50, 'social_checkin', 'Membership Application Approved & Welcome Pack', member.club_id);

    // Automated welcome message
    const welcomeMsg: MemberMessage = {
      id: newId(),
      club_id: member.club_id,
      member_id: member.id,
      sender_type: 'admin',
      sender_name: `${adminName} (Administration)`,
      subject: 'Official Membership Approved & Digital Pass Active',
      category: 'Committee',
      content: `Welcome ${member.full_name}! Your application for ${member.membership_tier} has been officially approved. Your digital turnstile pass is now active for stadium gate access and team matchdays.`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMemberMessages(prev => [...prev, welcomeMsg]);

    return {
      success: true,
      member: updatedMember,
      message: `Approved ${member.full_name}'s membership application!`
    };
  }, [members, awardClubScorePoints]);

  const rejectMemberApplication = useCallback((memberId: string, reason: string, adminName: string = 'Club Committee'): { success: boolean; member?: ClubMember; message: string } => {
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return { success: false, message: 'Member record not found.' };
    }

    const updatedMember: ClubMember = {
      ...member,
      membership_status: 'rejected',
      rejection_reason: sanitizeText(reason || 'Application not approved for current season.'),
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminName,
      updated_at: new Date().toISOString(),
    };

    setMembers(prev => prev.map(m => (m.id === memberId ? updatedMember : m)));

    return {
      success: true,
      member: updatedMember,
      message: `Application for ${member.full_name} marked as rejected.`
    };
  }, [members]);

  const sendMemberMessage = useCallback((messageData: Omit<MemberMessage, 'id' | 'created_at' | 'is_read'>): MemberMessage => {
    const newMsg: MemberMessage = {
      ...messageData,
      id: newId(),
      subject: messageData.subject ? sanitizeText(messageData.subject) : 'Member Inquiry',
      content: sanitizeText(messageData.content),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMemberMessages(prev => [...prev, newMsg]);
    return newMsg;
  }, []);

  const replyToMemberMessage = useCallback((originalMessageId: string, replyContent: string, adminName: string = 'Club Administrator'): { success: boolean; message?: MemberMessage } => {
    const original = memberMessages.find(m => m.id === originalMessageId);
    if (!original) {
      return { success: false };
    }

    const replyMsg: MemberMessage = {
      id: newId(),
      club_id: original.club_id,
      member_id: original.member_id,
      sender_type: 'admin',
      sender_name: adminName,
      subject: original.subject ? `Re: ${original.subject}` : 'Club Committee Response',
      category: original.category,
      content: sanitizeText(replyContent),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMemberMessages(prev => [...prev.map(m => (m.id === originalMessageId ? { ...m, is_read: true } : m)), replyMsg]);

    return { success: true, message: replyMsg };
  }, [memberMessages]);

  const getMemberMessages = useCallback((clubId: string, memberId: string): MemberMessage[] => {
    return memberMessages
      .filter(m => m.club_id === clubId && m.member_id === memberId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [memberMessages]);

  const getClubMemberMessages = useCallback((clubId: string): MemberMessage[] => {
    return memberMessages
      .filter(m => m.club_id === clubId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [memberMessages]);

  const getClubSeasonStats = useCallback((clubId: string): ClubSeasonStatsSummary => {
    const clubMatches = matches.filter(m => m.club_id === clubId && m.status === 'completed');
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let cleanSheets = 0;

    const form: ('W' | 'D' | 'L')[] = [];

    const sorted = [...clubMatches].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());

    sorted.forEach(m => {
      const isHome = m.is_club_home;
      const clubScore = isHome ? m.home_score : m.away_score;
      const oppScore = isHome ? m.away_score : m.home_score;

      goalsFor += clubScore;
      goalsAgainst += oppScore;
      if (oppScore === 0) cleanSheets++;

      if (clubScore > oppScore) {
        wins++;
        form.push('W');
      } else if (clubScore === oppScore) {
        draws++;
        form.push('D');
      } else {
        losses++;
        form.push('L');
      }
    });

    const finalWins = clubMatches.length > 0 ? wins : 14;
    const finalDraws = clubMatches.length > 0 ? draws : 5;
    const finalLosses = clubMatches.length > 0 ? losses : 3;
    const finalGF = clubMatches.length > 0 ? goalsFor : 48;
    const finalGA = clubMatches.length > 0 ? goalsAgainst : 19;
    const finalCS = clubMatches.length > 0 ? cleanSheets : 10;
    const finalForm: ('W' | 'D' | 'L')[] = form.length > 0 ? form.slice(-5) : ['W', 'W', 'D', 'W', 'W'];

    const clubStats = playerStats.filter(s => s.club_id === clubId);
    const sortedStats = [...clubStats].sort((a, b) => b.goals - a.goals);
    const topPlayer = sortedStats[0];
    const topMember = topPlayer ? members.find(m => m.id === topPlayer.member_id) : undefined;

    return {
      matchesPlayed: clubMatches.length > 0 ? clubMatches.length : 22,
      wins: finalWins,
      draws: finalDraws,
      losses: finalLosses,
      goalsFor: finalGF,
      goalsAgainst: finalGA,
      goalDifference: finalGF - finalGA,
      points: finalWins * 3 + finalDraws,
      winRate: Math.round((finalWins / (clubMatches.length || 22)) * 100),
      cleanSheets: finalCS,
      form: finalForm,
      topScorer: topMember ? { name: topMember.full_name, goals: topPlayer.goals } : { name: 'Dante Moreno', goals: 19 }
    };
  }, [matches, playerStats, members]);

  // ==============================================================================
  // TOURNAMENTS & INTERNAL TEAMS ENGINE (Challonge for Football)
  // ==============================================================================

  const createInternalTeam = useCallback((teamData: Omit<InternalTeam, 'id' | 'created_at' | 'updated_at'>) => {
    const newTeam: InternalTeam = {
      ...teamData,
      id: newId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setInternalTeams(prev => [newTeam, ...prev]);
    return newTeam;
  }, []);

  const updateInternalTeam = useCallback((teamId: string, updates: Partial<InternalTeam>) => {
    setInternalTeams(prev => prev.map(t => t.id === teamId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
  }, []);

  const deleteInternalTeam = useCallback((teamId: string) => {
    setInternalTeams(prev => prev.filter(t => t.id !== teamId));
  }, []);

  const createTournament = useCallback((
    tournamentData: Omit<Tournament, 'id' | 'created_at' | 'updated_at'>,
    participantInputs?: Omit<TournamentParticipant, 'id' | 'tournament_id'>[]
  ) => {
    const tournId = newId();
    const newTournament: Tournament = {
      ...tournamentData,
      id: tournId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTournaments(prev => [newTournament, ...prev]);

    if (participantInputs && participantInputs.length > 0) {
      const newParticipants: TournamentParticipant[] = participantInputs.map((p, idx) => ({
        ...p,
        id: newId(),
        tournament_id: tournId,
      }));
      setTournamentParticipants(prev => [...prev, ...newParticipants]);
    }

    return newTournament;
  }, []);

  const updateTournament = useCallback((tournamentId: string, updates: Partial<Tournament>) => {
    setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
  }, []);

  const deleteTournament = useCallback((tournamentId: string) => {
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
    setTournamentParticipants(prev => prev.filter(p => p.tournament_id !== tournamentId));
    setMatches(prev => prev.filter(m => m.tournament_id !== tournamentId));
  }, []);

  const addTournamentParticipant = useCallback((participantData: Omit<TournamentParticipant, 'id'>) => {
    const newParticipant: TournamentParticipant = {
      ...participantData,
      id: newId(),
    };
    setTournamentParticipants(prev => [...prev, newParticipant]);
    return newParticipant;
  }, []);

  const deleteTournamentParticipant = useCallback((participantId: string) => {
    setTournamentParticipants(prev => prev.filter(p => p.id !== participantId));
  }, []);

  const generateTournamentTiesheet = useCallback((tournamentId: string, options?: { shuffle?: boolean }) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return [];

    const participants = tournamentParticipants.filter(p => p.tournament_id === tournamentId);
    if (participants.length < 2) return [];

    let generatedMatches: Match[] = [];

    if (tournament.format === 'knockout') {
      generatedMatches = generateKnockoutBracket(tournament, participants, options);
    } else if (tournament.format === 'league') {
      generatedMatches = generateRoundRobinSchedule(tournament, participants, options);
    } else if (tournament.format === 'group_knockout') {
      const res = generateGroupKnockoutSchedule(tournament, participants, options);
      generatedMatches = res.matches;
      // Update group assignments on participants
      setTournamentParticipants(prev => {
        const others = prev.filter(p => p.tournament_id !== tournamentId);
        return [...others, ...res.updatedParticipants];
      });
    }

    // Replace old matches for this tournament with new ones
    setMatches(prev => {
      const nonTournament = prev.filter(m => m.tournament_id !== tournamentId);
      return [...nonTournament, ...generatedMatches];
    });

    // Mark tournament as ongoing if draft
    if (tournament.status === 'draft') {
      updateTournament(tournamentId, { status: 'ongoing' });
    }

    return generatedMatches;
  }, [tournaments, tournamentParticipants, updateTournament]);

  const updateTournamentMatchScore = useCallback((
    matchId: string,
    homeScore: number,
    awayScore: number,
    homePens?: number,
    awayPens?: number,
    isCompleted = true
  ) => {
    setMatches(prevMatches => {
      const targetMatch = prevMatches.find(m => m.id === matchId);
      if (!targetMatch) return prevMatches;

      const updated: Match = {
        ...targetMatch,
        home_score: homeScore,
        away_score: awayScore,
        home_penalty_score: homePens,
        away_penalty_score: awayPens,
        status: isCompleted ? 'completed' : 'live',
        period: isCompleted ? (homePens !== undefined ? 'penalties' : 'full_time') : 'second_half',
      };

      // Progress knockout bracket if this match has downstream linkage
      let finalMatches = prevMatches.map(m => m.id === matchId ? updated : m);

      if (updated.tournament_id && updated.tournament_stage && updated.tournament_stage !== 'group') {
        finalMatches = progressKnockoutMatch(finalMatches, updated);
      }

      // If this was a group match, check if group stage is ready to seed knockouts
      if (updated.tournament_id && updated.tournament_stage === 'group') {
        const tourney = tournaments.find(t => t.id === updated.tournament_id);
        if (tourney && tourney.format === 'group_knockout') {
          const participants = tournamentParticipants.filter(p => p.tournament_id === tourney.id);
          const standingsByGroup: Record<string, TournamentStanding[]> = {};
          const groupCount = tourney.group_count ?? 1;
          const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].slice(0, groupCount);
          groupLetters.forEach(letter => {
            standingsByGroup[letter] = computeStandings(finalMatches, participants, {
              group: letter,
              pointsWin: tourney.points_win,
              pointsDraw: tourney.points_draw,
              pointsLoss: tourney.points_loss,
            });
          });
          finalMatches = seedKnockoutFromGroups(finalMatches, standingsByGroup);
        }
      }

      return finalMatches;
    });

    broadcastLiveMatchdayEvent({
      type: 'MATCH_UPDATED',
      matchId,
      updates: {
        home_score: homeScore,
        away_score: awayScore,
        home_penalty_score: homePens,
        away_penalty_score: awayPens,
        status: isCompleted ? 'completed' : 'live',
        period: isCompleted ? (homePens !== undefined ? 'penalties' : 'full_time') : 'second_half',
      },
      timestamp: Date.now(),
    });
  }, [tournaments, tournamentParticipants]);

  const progressKnockoutStage = useCallback((tournamentId: string) => {
    setMatches(prevMatches => {
      const tourneyMatches = prevMatches.filter(m => m.tournament_id === tournamentId);
      let updatedList = [...prevMatches];
      tourneyMatches.forEach(m => {
        if (m.status === 'completed' && m.next_match_id) {
          updatedList = progressKnockoutMatch(updatedList, m);
        }
      });
      return updatedList;
    });
  }, []);

  const getTournamentStandings = useCallback((tournamentId: string, group?: string) => {
    const tourney = tournaments.find(t => t.id === tournamentId);
    const tourneyMatches = matches.filter(m => m.tournament_id === tournamentId);
    const participants = tournamentParticipants.filter(p => p.tournament_id === tournamentId);
    return computeStandings(tourneyMatches, participants, {
      group,
      pointsWin: tourney?.points_win ?? 3,
      pointsDraw: tourney?.points_draw ?? 1,
      pointsLoss: tourney?.points_loss ?? 0,
    });
  }, [tournaments, matches, tournamentParticipants]);

  const getTournamentMatches = useCallback((tournamentId: string) => {
    return matches.filter(m => m.tournament_id === tournamentId);
  }, [matches]);

  return (
    <ClubContext.Provider
      value={{
        clubs,
        isHydrated,
        syncStatus,
        retrySync,
        reloadFromServer,
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
        analyticsEvents,
        gateScans,
        inquiries,
        updateInquiryStatus,
        loadClubAnalytics,
        resolveAvailabilityToken,
        respondToAvailabilityToken,
        ensureAvailability,
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
        selfCheckInMatch,
        addMatchEvent,
        deleteMatchEvent,
        addEvent,
        updateEvent,
        deleteEvent,
        addMember,
        bulkAddMembers,
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
        verifyMemberPassPublic,
        publicMatchCheckin,
        checkInMemberToEvent,
        submitInquiry,
        setPlayerAvailability,
        getMatchAvailabilities,
        getAvailabilityByToken,
        saveDraftLineup,
        getDraftLineup,
        publishDraftLineup,
        auditAndBakeMatchStats,
        trackPageView,
        recordGateScan,
        getClubAnalytics,
        memberMessages,
        applyForMembership,
        approveMemberApplication,
        rejectMemberApplication,
        sendMemberMessage,
        replyToMemberMessage,
        getMemberMessages,
        getClubMemberMessages,
        getClubSeasonStats,
        // Tournaments & Internal Teams
        internalTeams,
        tournaments,
        tournamentParticipants,
        createInternalTeam,
        updateInternalTeam,
        deleteInternalTeam,
        createTournament,
        updateTournament,
        deleteTournament,
        addTournamentParticipant,
        deleteTournamentParticipant,
        generateTournamentTiesheet,
        updateTournamentMatchScore,
        progressKnockoutStage,
        getTournamentStandings,
        getTournamentMatches,
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
