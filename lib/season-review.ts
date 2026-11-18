// The Season review: a club's season for members, parents and sponsors, shared by link and printed
// like the cup report. Everything is worked out from records the app already keeps, except the
// season awards and the extra names to thank, which the committee adds (migration 20261179).
// Pure, so the numbers can be checked without a browser (lib/season-review.check.ts).
//
// The rules the public site follows carry over: teams that hide their scores (junior rules) show
// no scores, scorers or results here either, and juniors are named "Sam T.". Sections with nothing
// in them are left out rather than shown as zeros.
import type {
  ClubEvent, ClubMember, ClubScoreProfile, ClubTeam, ClubTeamMember, EventAttendee, Match, MediaGalleryItem,
  NewsArticle, PlayerAvailability, PlayerStats, Sponsor,
} from '@/lib/supabase/types';
import { countsTowardClubRecord, isPlayerMember } from '@/lib/supabase/types';
import type { MatchStatLine } from '@/lib/match-stats';
import { clubResult } from '@/lib/fixtures';
import { isCountedMember } from '@/lib/people';
import { juniorPublicName, STAFF_ROLES, teamLabel, teamOfMatch, TEAM_ROLE_LABELS } from '@/lib/teams';
import { leadsWithCleanSheets } from '@/lib/top-players';
import { sponsorLabel, sortSponsorsByTier } from '@/lib/sponsors';
import { agmMoney, type AgmExpense, type AgmPayment, type MoneyLine } from '@/lib/agm-report';
import { monthTotals, pieSlices, siteDay } from '@/lib/budget';

export const CLUB = '';

// ---------------------------------------------------------------------------
// What the review holds. Plain JSON, so the shared copy can be saved as it is.
// ---------------------------------------------------------------------------

export interface ReviewFigure { label: string; value: string }
export interface ReviewTeam { id: string; name: string; sub: string; scoresHidden: boolean }
export interface ReviewAward { award: string; winner: string; team: string; teamName: string; note?: string }
export interface TeamRecord { team: string; name: string; sub: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; hidden: boolean }
export interface Moment { label: string; value: string; line: string }
export interface LeaderBoard { title: string; rows: { name: string; team: string; n: number }[] }
export interface CupLine { place: string; name: string; who: string; result: string; won: boolean; href?: string }

/** Everything that can be seen for the whole club or for one team */
export interface PitchView {
  opening: string;
  figures: ReviewFigure[];
  records: TeamRecord[];
  moments: Moment[];
  leaders: LeaderBoard[];
  everPresent: { name: string; line: string }[];
  milestones: { text: string; team: string }[];
  cards: { team: string; yellow: number; red: number }[];
  cardsNote: string;
  cups: CupLine[];
  training: { team: string; sessions: number; avgIn: number; squad: number }[];
  trainingSessions: number;
  replies: { team: string; percent: number; usual: string }[];
  /** The story card's four figures, its cup line and its award line */
  card: { figures: [string, string][]; cup?: string; cupSub?: string; award?: string; awardSub?: string };
}

export interface SeasonMoney {
  currency: string;
  previous: string | null;
  income: number; expenses: number; surplus: number;
  previousIncome: number; previousExpenses: number; previousSurplus: number;
  incomeSlices: { key: string; label: string; cents: number; percent: number }[];
  expenseSlices: { key: string; label: string; cents: number; percent: number }[];
  months: { month: string; label: string; inCents: number; outCents: number }[];
  /** Worked out from the saved opening balance and the ledger, month by month */
  balance: { label: string; cents: number }[] | null;
  balanceFrom: string | null;
  fees: { asked: number; collected: number; unpaid: number; unpaidCount: number } | null;
}

export interface SeasonReview {
  kind: 'season-review';
  v: 1;
  club: string;
  season: string;
  dates: string;
  madeAt: string;
  /** The committee's version has the notes from event reviews */
  committee: boolean;
  teams: ReviewTeam[];
  awards: ReviewAward[];
  views: Record<string, PitchView>;
  clubScore: { name: string; sub: string; points: number }[];
  events: {
    held: number;
    types: { label: string; n: number }[];
    turnout: { title: string; date: string; said: number; came: number }[];
    tickets: { title: string; cents: number }[];
    ticketCents: number;
    notes: { went: string[]; next: string[]; from: string }[];
  } | null;
  members: {
    counted: number; players: number; others: number; joined: number | null;
    tiers: { label: string; n: number }[];
    joins: { label: string; n: number }[];
    renewed: number; lapsed: number;
    committee: { title: string; name: string }[];
  } | null;
  thanks: { group: string; people: { name: string; role: string }[] }[];
  sponsors: {
    cents: number | null; count: number; views: number; clicks: number; scans: number;
    wall: { name: string; label: string; logo: string; views: number; clicks: number; scans: number; top: boolean }[];
  } | null;
  money: SeasonMoney | null;
  posts: { articles: number; photos: number; gallery: { url: string; title: string }[] } | null;
  photos: { url: string; caption: string }[];
  next: { when: string; what: string }[];
  currency: string;
}

export const isSeasonReview = (x: unknown): x is SeasonReview =>
  !!x && typeof x === 'object' && (x as SeasonReview).kind === 'season-review' && typeof (x as SeasonReview).views === 'object';

/** The copy behind a share link: no committee notes, and the money and replies only if the committee left them in */
export function sharedCopy(r: SeasonReview, opts: { hideMoney: boolean; hideReplies: boolean }): SeasonReview {
  const views = Object.fromEntries(Object.entries(r.views).map(([k, v]) => [k, opts.hideReplies ? { ...v, replies: [] } : v]));
  return { ...r, committee: false, views, money: opts.hideMoney ? null : r.money, events: r.events ? { ...r.events, notes: [] } : null };
}

// ---------------------------------------------------------------------------
// Saved by the committee (season_reviews)
// ---------------------------------------------------------------------------

export interface SavedAward { award: string; member_id?: string | null; name: string; team_id?: string | null; note?: string }
export interface SavedThanks { name: string; role: string }
export interface SeasonExtras { awards: SavedAward[]; thanks: SavedThanks[]; hide_money: boolean; hide_replies: boolean }
export const emptyExtras = (): SeasonExtras => ({ awards: [], thanks: [], hide_money: false, hide_replies: false });

export const AWARD_SUGGESTIONS = ['Best and Fairest', "Coach's award", "Players' player", 'Most improved', 'Clubperson of the year', 'Every player award'];
export const MAX_AWARDS = 60;
export const MAX_THANKS = 300;

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Whatever came back from the database, as lists the page can use. Bad rows are dropped. */
export function readExtras(row: { awards?: unknown; thanks?: unknown; hide_money?: unknown; hide_replies?: unknown } | null | undefined): SeasonExtras {
  if (!row) return emptyExtras();
  const awards = (Array.isArray(row.awards) ? row.awards : []).flatMap((a): SavedAward[] => {
    const award = clean(a?.award, 60), name = clean(a?.name, 80);
    return award && name ? [{ award, name, member_id: typeof a.member_id === 'string' ? a.member_id : null, team_id: typeof a.team_id === 'string' ? a.team_id : null, note: clean(a.note, 160) || undefined }] : [];
  }).slice(0, MAX_AWARDS);
  const thanks = (Array.isArray(row.thanks) ? row.thanks : []).flatMap((t): SavedThanks[] => {
    const name = clean(t?.name, 80);
    return name ? [{ name, role: clean(t.role, 60) }] : [];
  }).slice(0, MAX_THANKS);
  return { awards, thanks, hide_money: row.hide_money === true, hide_replies: row.hide_replies === true };
}

// ---------------------------------------------------------------------------
// Building it
// ---------------------------------------------------------------------------

export interface SeasonReviewInput {
  club: { id: string; name: string; slug: string };
  season: { name: string; start_date?: string; end_date?: string };
  /** The club's seasons, oldest first: milestones count games from every season up to this one */
  seasonNames: string[];
  teams: ClubTeam[];
  teamMembers: ClubTeamMember[];
  members: ClubMember[];
  juniorIds: Set<string>;
  matches: Match[];
  /** Saved player stats for each game (match_player_stats), by match id */
  statLines: Record<string, MatchStatLine[]>;
  playerStats: PlayerStats[];
  events: ClubEvent[];
  attendees: EventAttendee[] | null;
  /** Ticket payments by id, to add up ticket money per event */
  ticketPayments: Map<string, { amount_cents: number; status: string }> | null;
  clubScore: ClubScoreProfile[];
  sponsors: Sponsor[];
  sponsorCounts: Record<string, { views: number; clicks: number; scans: number }> | null;
  sponsorCents: number | null;
  availabilities: PlayerAvailability[];
  eventNotes: { eventId: string; went_well: string; next_time: string }[] | null;
  news: NewsArticle[];
  gallery: MediaGalleryItem[];
  money: SeasonMoney | null;
  extras: SeasonExtras;
  next: { season: string | null; events: ClubEvent[]; matches: Match[]; budgetCents: number | null };
  committee: boolean;
  currency: string;
  now: number;
}

const DAY = 86400000;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-AU')} ${n === 1 ? one : many}`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const longDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
const formatFormat = (f: string | undefined) => (f && /^\d+v\d+$/.test(f) ? `${f.split('v')[0]}-a-side` : '');

/** The season's span, for events and joins that aren't filed under a season name */
export function seasonSpan(season: { start_date?: string; end_date?: string }): { from: number; to: number } | null {
  if (!season.start_date || !season.end_date) return null;
  return { from: new Date(`${season.start_date}T00:00:00`).getTime(), to: new Date(`${season.end_date}T23:59:59`).getTime() };
}

export function buildSeasonReview(i: SeasonReviewInput): SeasonReview {
  const span = seasonSpan(i.season);
  const inSeason = (iso: string | null | undefined) => {
    if (!iso || !span) return false;
    const t = new Date(iso).getTime();
    return t >= span.from && t <= span.to;
  };
  const memberById = new Map(i.members.map(m => [m.id, m]));
  const nameOf = (id: string | null | undefined, fallback = '') => {
    const m = id ? memberById.get(id) : undefined;
    const full = m?.full_name || fallback;
    return id && i.juniorIds.has(id) ? juniorPublicName(full) : full;
  };
  const teams = i.teams.filter(t => t.club_id === i.club.id && t.is_active).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const many = teams.length > 1;
  const teamName = (id: string) => (id === CLUB ? i.club.name : teamLabel(teams.find(t => t.id === id) || { name: 'Team' }));

  // Club games filed under this season, each with its team ('' when the club has one team)
  const games = i.matches.filter(m => m.club_id === i.club.id && m.season === i.season.name && countsTowardClubRecord(m));
  const teamOf = (m: Match) => teamOfMatch(m, teams)?.id || (teams.length === 1 ? teams[0].id : CLUB);
  const hidden = (teamId: string) => !!teams.find(t => t.id === teamId)?.hide_public_scores;
  const done = games.filter(m => m.status === 'completed' && clubResult(m).outcome).sort((a, b) => a.match_date.localeCompare(b.match_date));

  // Who plays for which team: their saved games first, else the squad lists
  const playsFor = new Map<string, Set<string>>();
  const addPlays = (member: string, team: string) => { if (!playsFor.has(member)) playsFor.set(member, new Set()); playsFor.get(member)!.add(team); };
  for (const m of done) for (const l of i.statLines[m.id] || []) if (l.played) addPlays(l.member_id, teamOf(m));
  for (const r of i.teamMembers) if (r.team_role === 'player' && r.is_active !== false && teams.some(t => t.id === r.team_id) && !playsFor.has(r.member_id)) addPlays(r.member_id, r.team_id);
  const mainTeam = (member: string) => [...(playsFor.get(member) || [])][0] || CLUB;
  const onlyHidden = (member: string) => { const s = playsFor.get(member); return !!s && s.size > 0 && [...s].every(hidden); };

  const awards: ReviewAward[] = i.extras.awards.map(a => ({
    award: a.award,
    winner: a.member_id ? nameOf(a.member_id, a.name) : a.name,
    team: a.team_id && teams.some(t => t.id === a.team_id) ? a.team_id : CLUB,
    teamName: a.team_id && teams.some(t => t.id === a.team_id) ? teamName(a.team_id) : 'Whole club',
    note: a.note,
  }));

  // ------------------------------------------------------------- P1-P7, E4, E5, X4: per view
  const seasonEvents = i.events.filter(e => e.club_id === i.club.id && (e.season ? e.season === i.season.name : inSeason(e.start_time)) && new Date(e.start_time).getTime() <= i.now);
  const cupEvents = seasonEvents.filter(e => e.category === 'tournament' || i.matches.some(m => m.event_id === e.id));
  const trainings = seasonEvents.filter(e => e.category === 'training');

  const view = (ids: string[]): PitchView => {
    const one = ids.length === 1 && ids[0] !== CLUB ? ids[0] : null;
    const scope = (teamId: string) => ids.includes(teamId) || (!one && teamId === CLUB);
    const myGames = done.filter(m => scope(teamOf(m)));
    const scored = myGames.filter(m => !hidden(teamOf(m)));
    const lines = myGames.flatMap(m => (i.statLines[m.id] || []).map(l => ({ ...l, match: m, team: teamOf(m) })));
    const haveLines = lines.length > 0;

    // P1
    const recordTeams = one ? [one] : [...new Set([...teams.map(t => t.id), ...done.map(teamOf)])].filter(id => done.some(m => teamOf(m) === id) || teams.some(t => t.id === id));
    const records: TeamRecord[] = recordTeams.map(id => {
      const ms = done.filter(m => teamOf(m) === id);
      const r = { played: ms.length, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
      for (const m of ms) {
        const res = clubResult(m);
        r.goalsFor += res.us; r.goalsAgainst += res.them;
        if (res.outcome === 'W') r.won += 1; else if (res.outcome === 'D') r.drawn += 1; else r.lost += 1;
      }
      const t = teams.find(x => x.id === id);
      return { team: id, name: teamName(id), sub: [formatFormat(t?.match_format), plural(r.played, 'game')].filter(Boolean).join(' · '), ...r, hidden: hidden(id) };
    }).filter(r => r.played > 0);

    // P4: best moments, from teams that show their scores
    const moments: Moment[] = [];
    const who = (m: Match) => (one || !many ? '' : `${teamName(teamOf(m))} `);
    const opp = (m: Match) => (m.is_club_home !== false ? m.away_team_name : m.home_team_name) || 'the opposition';
    if (scored.length) {
      const big = [...scored].sort((a, b) => { const x = clubResult(a), y = clubResult(b); return (y.us - y.them) - (x.us - x.them) || y.us - x.us; })[0];
      const b = clubResult(big);
      if (b.us > b.them) moments.push({ label: 'Biggest win', value: `${b.us}-${b.them}`, line: `${who(big)}against ${opp(big)}, ${longDate(big.match_date)}`.replace(/^against/, 'Against') });
      let best = { n: 0, from: '', to: '', team: '' };
      for (const id of new Set(scored.map(teamOf))) {
        let run = 0, start = '';
        for (const m of scored.filter(x => teamOf(x) === id)) {
          if (clubResult(m).outcome === 'L') { run = 0; continue; }
          if (!run) start = m.match_date;
          run += 1;
          if (run > best.n) best = { n: run, from: start, to: m.match_date, team: id };
        }
      }
      if (best.n >= 3) moments.push({ label: 'Longest unbeaten run', value: plural(best.n, 'game'), line: `${!one && many ? `${teamName(best.team)}, ` : ''}${longDate(best.from)} to ${longDate(best.to)}` });
      const most = [...scored].sort((a, b) => { const x = clubResult(a), y = clubResult(b); return (y.us + y.them) - (x.us + x.them); })[0];
      const g = clubResult(most);
      if (g.us + g.them >= 4) moments.push({ label: 'Most goals in a game', value: String(g.us + g.them), line: `${who(most)}${g.outcome === 'W' ? 'won' : g.outcome === 'L' ? 'lost' : 'drew'} ${g.us}-${g.them} against ${opp(most)}, ${longDate(most.match_date)}`.replace(/^(won|lost|drew)/, s => s[0].toUpperCase() + s.slice(1)) });
    }

    // P2: season leaders. Per-game stats when the club saves them (so each team gets its own),
    // else the season totals Top Players uses (whole club only). Goals and assists skip teams
    // that hide their scores.
    type Tot = { goals: number; assists: number; motm: number; apps: number; sheets: number; yellow: number; red: number };
    const tots = new Map<string, Tot>();
    const tot = (id: string) => { if (!tots.has(id)) tots.set(id, { goals: 0, assists: 0, motm: 0, apps: 0, sheets: 0, yellow: 0, red: 0 }); return tots.get(id)!; };
    if (haveLines) {
      for (const l of lines) {
        const t = tot(l.member_id);
        const open = !hidden(l.team);
        if (l.played) t.apps += 1;
        if (open) { t.goals += l.goals; t.assists += l.assists; if (l.clean_sheet) t.sheets += 1; }
        if (l.motm) t.motm += 1;
        t.yellow += l.yellow_cards; t.red += l.red_cards;
      }
    } else if (!one) {
      for (const s of i.playerStats.filter(p => p.club_id === i.club.id && p.season === i.season.name)) {
        const t = tot(s.member_id);
        const open = !onlyHidden(s.member_id);
        t.apps += s.appearances; t.motm += s.motm_awards; t.yellow += s.yellow_cards; t.red += s.red_cards;
        if (open) { t.goals += s.goals; t.assists += s.assists; t.sheets += s.clean_sheets; }
      }
    }
    const board = (title: string, key: keyof Tot, keep: (id: string) => boolean = () => true): LeaderBoard | null => {
      const rows = [...tots].filter(([id, t]) => t[key] > 0 && keep(id) && memberById.has(id))
        .sort((a, b) => b[1][key] - a[1][key] || nameOf(a[0]).localeCompare(nameOf(b[0]))).slice(0, 3)
        .map(([id, t]) => ({ name: nameOf(id), team: one || !many || mainTeam(id) === CLUB ? '' : teamName(mainTeam(id)), n: t[key] }));
      return rows.length ? { title, rows } : null;
    };
    const pos = (id: string) => memberById.get(id)?.player_position;
    const leaders = [
      board('Goals', 'goals'), board('Assists', 'assists'), board('Player of the Match', 'motm'), board('Appearances', 'apps'),
      board('Clean sheets, goalkeepers', 'sheets', id => pos(id) === 'GK'),
      board('Clean sheets, defenders', 'sheets', id => leadsWithCleanSheets(pos(id)) && pos(id) !== 'GK'),
    ].filter((b): b is LeaderBoard => !!b);

    // P5: played every game of their team (three games or more)
    const everPresent: PitchView['everPresent'] = [];
    if (haveLines) {
      for (const id of new Set(myGames.map(teamOf))) {
        const ms = myGames.filter(m => teamOf(m) === id);
        if (ms.length < 3) continue;
        const count = new Map<string, number>();
        for (const m of ms) for (const l of i.statLines[m.id] || []) if (l.played) count.set(l.member_id, (count.get(l.member_id) || 0) + 1);
        for (const [mid, n] of count) if (n === ms.length && memberById.has(mid)) everPresent.push({ name: nameOf(mid), line: `${one || !many ? '' : `${teamName(id)}, `}${n} of ${ms.length}` });
      }
      everPresent.sort((a, b) => a.name.localeCompare(b.name));
    }

    // P6: milestones across every season up to this one
    const milestones: PitchView['milestones'] = [];
    const order = i.seasonNames.indexOf(i.season.name);
    const before = (s: string) => { const k = i.seasonNames.indexOf(s); return k >= 0 && order >= 0 ? k < order : s < i.season.name; };
    const byMember = new Map<string, { now: PlayerStats | null; apps: number; goals: number }>();
    for (const s of i.playerStats.filter(p => p.club_id === i.club.id)) {
      const e = byMember.get(s.member_id) || { now: null, apps: 0, goals: 0 };
      if (s.season === i.season.name) e.now = s; else if (before(s.season)) { e.apps += s.appearances; e.goals += s.goals; }
      byMember.set(s.member_id, e);
    }
    for (const [mid, e] of byMember) {
      if (!e.now || !memberById.has(mid)) continue;
      const team = mainTeam(mid);
      if (one && !(playsFor.get(mid)?.has(one))) continue;
      const after = e.apps + e.now.appearances;
      const mark = [300, 250, 200, 150, 100, 50].find(n => e.apps < n && after >= n);
      if (mark) milestones.push({ text: `${nameOf(mid)} played their ${mark}th game for the club`, team: many && team !== CLUB ? teamName(team) : "" });
      if (e.goals === 0 && e.now.goals > 0 && !onlyHidden(mid)) milestones.push({ text: `${nameOf(mid)} scored their first goal for the club`, team: many && team !== CLUB ? teamName(team) : "" });
    }
    milestones.sort((a, b) => a.text.localeCompare(b.text));

    // P7: cards per team
    const cards: PitchView['cards'] = [];
    let carded = 0, playedAny = 0;
    if (haveLines) {
      const per = new Map<string, { yellow: number; red: number }>();
      for (const l of lines) {
        const p = per.get(l.team) || { yellow: 0, red: 0 };
        p.yellow += l.yellow_cards; p.red += l.red_cards;
        per.set(l.team, p);
      }
      for (const [team, p] of per) cards.push({ team: teamName(team), ...p });
      for (const [, t] of tots) if (t.apps > 0) { playedAny += 1; if (t.yellow + t.red > 0) carded += 1; }
    }
    const cleanest = cards.length > 1 ? [...cards].sort((a, b) => (a.yellow + a.red * 3) - (b.yellow + b.red * 3))[0] : null;
    const cardsNote = playedAny
      ? `${playedAny - carded} of the ${plural(playedAny, 'player')} who played had no cards at all.${cleanest && !one ? ` The ${cleanest.team} had the cleanest season.` : ''}`
      : '';

    // E4: cups and tournaments
    const cups: CupLine[] = [];
    for (const e of cupEvents) {
      const ms = i.matches.filter(m => m.event_id === e.id && m.club_id === i.club.id && m.status === 'completed');
      const keys = new Set<string>([...Object.keys(e.cup_finish || {}), ...ms.map(m => teamOfMatch(m, teams)?.id || 'club')]);
      for (const key of keys) {
        const teamId = key === 'club' ? (teams.length === 1 ? teams[0].id : CLUB) : key;
        if (one && teamId !== one) continue;
        const f = e.cup_finish?.[key];
        const mine = ms.filter(m => (teamOfMatch(m, teams)?.id || 'club') === key);
        const res = mine.map(m => clubResult(m)).filter(r => r.outcome);
        const w = res.filter(r => r.outcome === 'W').length, l = res.filter(r => r.outcome === 'L').length, d = res.length - w - l;
        const quiet = hidden(teamId);
        const record = res.length && !quiet ? `Won ${w}${d ? `, drew ${d}` : ''}, lost ${l}` : mine.length ? plural(mine.length, 'game') : '';
        const place = f ? ({ won: '1st', final: '2nd', semi: 'SF', quarter: 'QF', group: f.place ? `${f.place}${['th', 'st', 'nd', 'rd'][f.place % 10 > 3 || [11, 12, 13].includes(f.place % 100) ? 0 : f.place % 10]}` : 'Grp' } as const)[f.stage] : '';
        const finish = f ? ({ won: 'Won the cup', final: 'Runners-up', semi: 'Reached the semi-finals', quarter: 'Reached the quarter-finals', group: f.place ? `Finished ${place} in the group` : 'Played in the group stage' } as const)[f.stage] : '';
        if (!finish && !record) continue;
        cups.push({
          place: place || '·', name: e.title,
          who: [many && teamId !== CLUB ? teamName(teamId) : '', longDate(e.start_time)].filter(Boolean).join(' · '),
          result: [finish, record].filter(Boolean).join('. '), won: f?.stage === 'won',
          href: `/${i.club.slug}/events/${e.id}`,
        });
      }
    }
    cups.sort((a, b) => Number(b.won) - Number(a.won));

    // E5 and X4: training "In" replies and availability replies, by team
    const squadOf = (teamId: string) => i.teamMembers.filter(r => r.team_id === teamId && r.team_role === 'player' && r.is_active !== false).map(r => r.member_id);
    const viewTeams = one ? [one] : teams.map(t => t.id);
    const trainingIds = new Set(trainings.map(e => e.id));
    const training = trainings.length ? viewTeams.map(id => {
      const squad = new Set(squadOf(id));
      const said = i.availabilities.filter(a => a.event_id && trainingIds.has(a.event_id) && squad.has(a.member_id) && a.status === 'available').length;
      return { team: teamName(id), sessions: trainings.length, avgIn: Math.round((said / trainings.length) * 10) / 10, squad: squad.size };
    }).filter(t => t.squad > 0 && t.avgIn > 0) : [];
    const gameIds = new Map(games.map(m => [m.id, teamOf(m)]));
    const replies = viewTeams.map(id => {
      const asked = i.availabilities.filter(a => a.match_id && gameIds.get(a.match_id) === id);
      const answered = asked.filter(a => a.status !== 'pending' && a.responded_at);
      const waits = answered.map(a => new Date(a.responded_at!).getTime() - new Date(a.created_at || a.responded_at!).getTime()).filter(ms => ms >= 0).sort((a, b) => a - b);
      const mid = waits.length ? waits[Math.floor(waits.length / 2)] : null;
      const usual = mid === null ? '' : mid < 3600000 ? `${Math.max(1, Math.round(mid / 60000))} min` : mid < 2 * DAY ? `${Math.round(mid / 3600000)} hours` : `${Math.round(mid / DAY)} days`;
      // Ten requests or more, so one late reply doesn't make a team look slow
      return asked.length >= 10 ? [{ team: teamName(id), percent: Math.round((answered.length / asked.length) * 100), usual }] : [];
    }).flat();

    // Headline figures and the opening line
    const rec = records.filter(r => !r.hidden);
    const played = sum(records.map(r => r.played));
    const goals = sum(rec.map(r => r.goalsFor));
    const wins = sum(rec.map(r => r.won));
    const cupsWon = cups.filter(c => c.won).length;
    const figures: ReviewFigure[] = [];
    const counted = i.members.filter(m => m.club_id === i.club.id && isCountedMember(m)).length;
    let opening: string;
    if (one) {
      const r = records[0];
      const t = teams.find(x => x.id === one);
      if (!r) opening = `${teamName(one)} had no finished games filed under ${i.season.name}.`;
      else if (r.hidden) opening = `${teamName(one)} played ${plural(r.played, 'game')}. ${t?.is_junior ? 'Junior teams don\'t keep scores, so this is about who turned up and had a go.' : 'The team keeps its scores private.'}`;
      else opening = `${teamName(one)} played ${plural(r.played, 'game')}: won ${r.won}, drew ${r.drawn} and lost ${r.lost}. We scored ${r.goalsFor} and let in ${r.goalsAgainst}.`;
      if (r && !r.hidden) figures.push({ label: 'Games', value: String(r.played) }, { label: 'Wins', value: String(r.won) }, { label: 'Draws', value: String(r.drawn) }, { label: 'Losses', value: String(r.lost) }, { label: 'Goals for', value: String(r.goalsFor) }, { label: 'Goals against', value: String(r.goalsAgainst) });
      else if (r) figures.push({ label: 'Games', value: String(r.played) }, { label: 'Players', value: String(squadOf(one).length) });
    } else {
      const parts = [
        played ? `${many ? `${plural(records.length, 'team')} played` : 'We played'} ${plural(played, 'game')}${goals ? ` and scored ${plural(goals, 'goal')}` : ''}` : '',
        cupsWon ? `won ${plural(cupsWon, 'cup')}` : '',
        counted ? `${counted.toLocaleString('en-AU')} people were members` : '',
        seasonEvents.length ? `we held ${plural(seasonEvents.filter(e => e.category !== 'training').length, 'event')}` : '',
      ].filter(Boolean);
      opening = parts.length ? `${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}. Thank you to everyone who played, coached, helped and cheered.` : `Here's ${i.club.name}'s ${i.season.name} season.`;
      opening = opening.charAt(0).toUpperCase() + opening.slice(1);
      if (played) figures.push({ label: 'Games', value: String(played) });
      if (rec.length) figures.push({ label: 'Wins', value: String(wins) }, { label: 'Goals', value: String(goals) });
      if (cupsWon) figures.push({ label: cupsWon === 1 ? 'Cup won' : 'Cups won', value: String(cupsWon) });
      if (counted) figures.push({ label: 'Members', value: counted.toLocaleString('en-AU') });
      const held = seasonEvents.filter(e => e.category !== 'training').length;
      if (held) figures.push({ label: 'Events', value: String(held) });
    }

    // The story card: four figures, the best cup line and the first award for this view
    const cardFigs: [string, string][] = figures.slice(0, 4).map(f => [f.value, f.label.toLowerCase()]);
    const cup = cups[0];
    const award = awards.find(a => (one ? a.team === one : true));
    return {
      opening, figures, records, moments, leaders, everPresent, milestones, cards, cardsNote, cups, training,
      trainingSessions: trainings.length, replies,
      card: {
        figures: cardFigs,
        cup: cup ? (cup.won ? `${cup.name} winners` : `${cup.name}: ${cup.result.split('.')[0].toLowerCase()}`) : undefined,
        cupSub: cup?.who.split(' · ')[0],
        award: award?.winner, awardSub: award ? `${award.teamName === 'Whole club' ? '' : `${award.teamName} `}${award.award}` : undefined,
      },
    };
  };

  const views: Record<string, PitchView> = { [CLUB]: view([CLUB, ...teams.map(t => t.id)]) };
  if (many) for (const t of teams) views[t.id] = view([t.id]);

  // ------------------------------------------------------------- P3 ClubScore
  const clubScore = i.clubScore
    .filter(p => p.club_id === i.club.id && p.season === i.season.name && p.total_points > 0 && memberById.has(p.member_id))
    .sort((a, b) => b.total_points - a.total_points).slice(0, 5)
    .map(p => {
      const m = memberById.get(p.member_id)!;
      const role = m.is_executive && m.executive_title ? m.executive_title : many ? (playsFor.has(m.id) ? teamName(mainTeam(m.id)) : '') : '';
      return { name: nameOf(m.id), sub: role, points: p.total_points };
    });

  // ------------------------------------------------------------- E1-E3, E6
  const social = seasonEvents.filter(e => e.category !== 'training' && e.category !== 'match');
  const TYPE: Record<string, string> = { social: 'Social', agm: 'AGM', trial: 'Trials', tournament: 'Tournaments', match: 'Matches' };
  const typeCounts = new Map<string, number>();
  for (const e of social) typeCounts.set(TYPE[e.category] || e.category, (typeCounts.get(TYPE[e.category] || e.category) || 0) + 1);
  const att = (i.attendees || []).filter(a => a.checkin_status !== 'cancelled');
  const turnout = i.attendees ? social.map(e => {
    const rows = att.filter(a => a.event_id === e.id);
    return { title: e.title, date: longDate(e.start_time), said: Math.max(rows.length, e.rsvp_count || 0), came: rows.filter(a => a.checkin_status === 'checked_in' || a.checked_in_at).length };
  }).filter(t => t.said > 0).sort((a, b) => b.came - a.came || b.said - a.said).slice(0, 5) : [];
  const tickets = i.attendees && i.ticketPayments ? social.map(e => {
    const paid = new Set(att.filter(a => a.event_id === e.id && a.payment_id).map(a => a.payment_id!));
    return { title: e.title, cents: sum([...paid].map(id => i.ticketPayments!.get(id)).filter(p => p?.status === 'paid').map(p => p!.amount_cents)) };
  }).filter(t => t.cents > 0).sort((a, b) => b.cents - a.cents) : [];
  const notes = i.committee && i.eventNotes ? i.eventNotes.flatMap(n => {
    const e = seasonEvents.find(x => x.id === n.eventId);
    const split = (s: string) => s.split('\n').map(x => x.replace(/^[-•*\s]+/, '').trim()).filter(Boolean);
    return e && (n.went_well.trim() || n.next_time.trim()) ? [{ went: split(n.went_well), next: split(n.next_time), from: e.title }] : [];
  }) : [];
  const events = social.length ? {
    held: social.length,
    types: [...typeCounts].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    turnout, tickets, ticketCents: sum(tickets.map(t => t.cents)), notes,
  } : null;

  // ------------------------------------------------------------- S1-S5
  const clubMembers = i.members.filter(m => m.club_id === i.club.id);
  const counted = clubMembers.filter(isCountedMember);
  const started = (m: ClubMember) => m.membership_starts_at || m.applied_at || null;
  const joinedThis = span ? counted.filter(m => inSeason(started(m))) : [];
  const tierMap = new Map<string, number>();
  for (const m of counted) { const t = m.membership_tier?.trim() || 'No membership type'; tierMap.set(t, (tierMap.get(t) || 0) + 1); }
  const joins: { label: string; n: number }[] = [];
  if (span) {
    const d = new Date(span.from);
    for (let k = 0; k < 24; k += 1) {
      const a = new Date(d.getFullYear(), d.getMonth() + k, 1), b = new Date(d.getFullYear(), d.getMonth() + k + 1, 1);
      if (a.getTime() > Math.min(span.to, i.now)) break;
      joins.push({ label: a.toLocaleDateString('en-AU', { month: 'short' }), n: joinedThis.filter(m => { const t = new Date(started(m)!).getTime(); return t >= a.getTime() && t < b.getTime(); }).length });
    }
  }
  // Renewed: memberships that ran out during the season and run on now; lapsed: ran out and didn't
  const due = clubMembers.filter(m => m.membership_status === 'approved');
  let renewed = 0, lapsed = 0;
  for (const m of due) {
    if (!m.membership_expires_at) continue;
    const exp = new Date(m.membership_expires_at).getTime();
    if (inSeason(m.membership_expires_at) && exp < i.now) lapsed += 1;
    else if (span && inSeason(m.membership_starts_at) && m.created_at && new Date(m.created_at).getTime() < span.from) renewed += 1;
  }
  const committee = clubMembers
    .filter(m => m.is_executive && (m.executive_season ? m.executive_season === i.season.name : true))
    .sort((a, b) => (a.executive_order ?? 99) - (b.executive_order ?? 99))
    .map(m => ({ title: m.executive_title || 'Committee', name: nameOf(m.id) }));
  const members = counted.length ? {
    counted: counted.length,
    players: counted.filter(isPlayerMember).length,
    others: counted.length - counted.filter(isPlayerMember).length,
    joined: span ? joinedThis.length : null,
    tiers: [...tierMap].map(([label, n]) => ({ label, n })).sort((a, b) => Number(a.label === 'No membership type') - Number(b.label === 'No membership type') || b.n - a.n),
    joins: joins.some(j => j.n > 0) ? joins : [],
    renewed, lapsed, committee,
  } : null;

  // ------------------------------------------------------------- Volunteers: staff from team roles, then the committee's own list
  const staff = new Map<string, string[]>();
  for (const r of i.teamMembers) {
    if (!STAFF_ROLES.includes(r.team_role) || r.is_active === false || !teams.some(t => t.id === r.team_id) || !memberById.has(r.member_id)) continue;
    const line = `${many ? `${teamName(r.team_id)} ` : ''}${TEAM_ROLE_LABELS[r.team_role].toLowerCase()}`;
    staff.set(r.member_id, [...(staff.get(r.member_id) || []), line]);
  }
  const thanks: SeasonReview['thanks'] = [];
  const coaches = [...staff].map(([id, roles]) => ({ name: nameOf(id), role: roles.join(', ') })).sort((a, b) => a.name.localeCompare(b.name));
  if (coaches.length) thanks.push({ group: 'Coaches and team staff', people: coaches });
  if (i.extras.thanks.length) thanks.push({ group: 'Volunteers and helpers', people: i.extras.thanks.map(t => ({ name: t.name, role: t.role })) });

  // ------------------------------------------------------------- X1, M6
  const shown = sortSponsorsByTier(i.sponsors.filter(s => s.club_id === i.club.id && !s.event_id && (s.is_active || (s.season === i.season.name))))
    .filter(s => s.package_status !== 'cancelled' && s.package_status !== 'prospect');
  const sc = (id: string) => i.sponsorCounts?.[id] || { views: 0, clicks: 0, scans: 0 };
  const sponsors = shown.length ? {
    cents: i.sponsorCents, count: shown.length,
    views: sum(shown.map(s => sc(s.id).views)), clicks: sum(shown.map(s => sc(s.id).clicks)), scans: sum(shown.map(s => sc(s.id).scans)),
    wall: shown.map(s => ({ name: s.name, label: sponsorLabel(s), logo: s.logo_url || '', ...sc(s.id), top: s.tier === 'platinum' || s.tier === 'gold' })),
  } : null;

  // ------------------------------------------------------------- X3 and the photos for each part
  const seasonNews = i.news.filter(n => n.club_id === i.club.id && inSeason(n.published_at));
  const seasonPhotos = i.gallery.filter(g => g.club_id === i.club.id && g.media_type === 'image' && inSeason(g.created_at));
  // One photo from each album, newest albums first, so the picks aren't six shots of one game
  const albums = new Map<string, MediaGalleryItem>();
  for (const g of [...seasonPhotos].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))) {
    const key = g.album_name || g.id;
    if (!albums.has(key) || g.is_album_cover) albums.set(key, g);
  }
  const picks = [...albums.values()].map(g => ({ url: g.thumbnail_url || g.media_url, title: g.album_name || g.title, full: g.media_url }));
  const posts = seasonNews.length || seasonPhotos.length ? { articles: seasonNews.length, photos: seasonPhotos.length, gallery: picks.slice(0, 6).map(p => ({ url: p.url, title: p.title })) } : null;
  const photos = picks.slice(0, 3).map(p => ({ url: p.full, caption: p.title }));

  // ------------------------------------------------------------- X5 next season
  const next: SeasonReview['next'] = [];
  const upcoming = [
    ...i.next.events.filter(e => e.club_id === i.club.id && new Date(e.start_time).getTime() > i.now && e.category !== 'training').map(e => ({ at: e.start_time, what: e.title })),
    ...i.next.matches.filter(m => m.club_id === i.club.id && m.status === 'upcoming' && new Date(m.match_date).getTime() > i.now && countsTowardClubRecord(m))
      .sort((a, b) => a.match_date.localeCompare(b.match_date)).slice(0, 1)
      .map(m => ({ at: m.match_date, what: `First game: ${many ? `${teamName(teamOf(m))} ` : ''}vs ${(m.is_club_home !== false ? m.away_team_name : m.home_team_name) || 'TBC'}` })),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 6);
  for (const u of upcoming) next.push({ when: new Date(u.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }), what: u.what });
  if (i.next.season && i.next.budgetCents !== null) {
    next.push({ when: 'Budget', what: i.next.budgetCents > 0 ? `The ${i.next.season} budget is set.` : `The ${i.next.season} budget isn't set yet.` });
  }

  return {
    kind: 'season-review', v: 1,
    club: i.club.name, season: i.season.name,
    dates: i.season.start_date && i.season.end_date ? `${new Date(`${i.season.start_date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} to ${new Date(`${i.season.end_date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` : '',
    madeAt: new Date(i.now).toISOString(),
    committee: i.committee,
    teams: many ? teams.map(t => ({ id: t.id, name: teamName(t.id), sub: formatFormat(t.match_format), scoresHidden: t.hide_public_scores })) : [],
    awards, views, clubScore, events, members, thanks, sponsors,
    money: i.money, posts, photos, next, currency: i.currency,
  };
}

// ---------------------------------------------------------------------------
// M1-M5: the money summary, by the AGM report's own rules (lib/agm-report.ts), so the two agree
// ---------------------------------------------------------------------------

export interface MoneyInput {
  /** Payments and expenses with `season` already set the Finance way (paymentSeason / expenseSeason) */
  payments: AgmPayment[];
  expenses: AgmExpense[];
  season: { name: string; start_date?: string; end_date?: string };
  previous: string | null;
  currency: string;
  /** Saved in Finance > Settings. Used only when it's dated on or before the season starts. */
  opening: { amount_cents: number; as_at: string } | null;
  today: string;
}

export function seasonMoney(i: MoneyInput): SeasonMoney | null {
  const m = agmMoney(i.payments, i.expenses, i.season.name, i.previous);
  if (!m.totalIncome && !m.totalExpenses) return null;
  const slices = (rows: MoneyLine[]) => pieSlices(rows.map(l => ({ category: l.key, label: l.label, actual: l.cents })));
  const start = i.season.start_date, end = i.season.end_date;
  const paidDay = (p: AgmPayment) => siteDay(p.paid_at || p.created_at || new Date().toISOString());
  let months: SeasonMoney['months'] = [];
  if (start && end) {
    const inn = monthTotals(i.payments.filter(p => p.status === 'paid' && p.season === i.season.name).map(p => ({ day: paidDay(p), cents: p.amount_cents })), start, end, i.today);
    const out = monthTotals(i.expenses.filter(e => e.season === i.season.name).map(e => ({ day: e.spent_on || start, cents: e.amount_cents })), start, end, i.today);
    months = inn.map((x, k) => ({ month: x.month, label: x.label, inCents: x.cents, outCents: out[k]?.cents ?? 0 }));
  }
  // M4: from the saved opening balance, everything paid in or out since it, month by month
  let balance: SeasonMoney['balance'] = null;
  if (start && i.opening && i.opening.as_at <= start && months.length > 1) {
    const between = (day: string) => day >= i.opening!.as_at && day < start;
    const before = sum(i.payments.filter(p => p.status === 'paid' && between(paidDay(p))).map(p => p.amount_cents))
      - sum(i.expenses.filter(e => e.spent_on && between(e.spent_on.slice(0, 10))).map(e => e.amount_cents));
    let running = i.opening.amount_cents + before;
    balance = [{ label: 'Start', cents: running }];
    for (const x of months) { running += x.inCents - x.outCents; balance.push({ label: x.label, cents: running }); }
  }
  // M5: fees the club asked for in the season, and what came in
  const fees = i.payments.filter(p => p.kind === 'fee_request' && (p.season === i.season.name || (!p.season && !!start && !!p.created_at && siteDay(p.created_at) >= start && (!end || siteDay(p.created_at) <= end))));
  const collected = sum(fees.filter(p => p.status === 'paid').map(p => p.amount_cents));
  const owing = fees.filter(p => p.status === 'pending' && p.due_on);
  return {
    currency: i.currency, previous: i.previous,
    income: m.totalIncome, expenses: m.totalExpenses, surplus: m.surplus,
    previousIncome: m.previousIncome, previousExpenses: m.previousExpenses, previousSurplus: m.previousSurplus,
    incomeSlices: slices(m.income), expenseSlices: slices(m.expenses),
    months: months.length > 1 && months.some(x => x.inCents || x.outCents) ? months : [],
    balance, balanceFrom: balance ? i.opening!.as_at : null,
    fees: collected + sum(owing.map(p => p.amount_cents)) > 0 ? { asked: collected + sum(owing.map(p => p.amount_cents)), collected, unpaid: sum(owing.map(p => p.amount_cents)), unpaidCount: owing.length } : null,
  };
}
