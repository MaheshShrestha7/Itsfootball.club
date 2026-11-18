import assert from 'node:assert/strict';
import { buildSeasonReview, CLUB, emptyExtras, readExtras, seasonMoney, sharedCopy, type SeasonReviewInput } from './season-review';
import type { ClubMember, ClubTeam, ClubTeamMember, Match } from './supabase/types';

const team = (id: string, name: string, extra: Partial<ClubTeam> = {}): ClubTeam => ({
  id, club_id: 'c1', name, slug: id, team_type: 'senior' as ClubTeam['team_type'], gender: 'mixed' as ClubTeam['gender'], is_junior: false, hide_public_scores: false,
  match_format: '11v11', sort_order: id === 'sen' ? 1 : 2, is_default: id === 'sen', is_active: true, ...extra,
});
const member = (id: string, full_name: string, extra: Partial<ClubMember> = {}) => ({
  id, club_id: 'c1', full_name, email: '', role: 'Player', status: 'active', membership_status: 'approved', qr_code_token: id, membership_tier: 'Senior player',
  membership_expires_at: '2027-01-01', is_executive: false, created_at: '2025-01-01', ...extra,
}) as ClubMember;
let n = 0;
const game = (teamId: string, us: number, them: number, date: string): Match => ({
  id: `m${++n}`, club_id: 'c1', team_id: teamId, competition: 'League', season: '2026', home_team_name: 'ANCC', away_team_name: `Opp ${n}`,
  home_team_logo: '', away_team_logo: '', is_club_home: true, match_date: `${date}T05:00:00Z`, venue: '', status: 'completed',
  home_score: us, away_score: them, current_minute: 90, added_time: 0, period: 'full_time' as Match['period'], match_type: 'league' as Match['match_type'],
}) as Match;
const row = (team_id: string, member_id: string, team_role: ClubTeamMember['team_role'] = 'player'): ClubTeamMember => ({ id: `${team_id}${member_id}`, club_id: 'c1', team_id, member_id, team_role });

const sen = [game('sen', 7, 0, '2026-06-14'), game('sen', 1, 1, '2026-06-21'), game('sen', 2, 1, '2026-06-28'), game('sen', 0, 2, '2026-07-05')];
const kids = [game('u9', 3, 2, '2026-06-14'), game('u9', 5, 0, '2026-06-21'), game('u9', 1, 0, '2026-06-28')];
const line = (member_id: string, extra = {}) => ({ member_id, played: true, minutes: 90, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, clean_sheet: false, motm: false, ...extra });

const base: SeasonReviewInput = {
  club: { id: 'c1', name: 'ANCC', slug: 'ancc' },
  season: { name: '2026', start_date: '2026-01-01', end_date: '2026-10-31' },
  seasonNames: ['2025', '2026'],
  teams: [team('sen', 'Seniors'), team('u9', 'Under 9s', { is_junior: true, hide_public_scores: true, match_format: '7v7' })],
  teamMembers: [row('sen', 'p1'), row('sen', 'p2'), row('u9', 'k1'), row('sen', 'coach1', 'coach')],
  members: [member('p1', 'Chris Nguyen', { player_position: 'ST' }), member('p2', 'Tom Wells', { player_position: 'GK' }), member('k1', 'Ruby Smith'), member('coach1', 'Kate Lin', { role: 'staff' }),
    member('pres', 'Linda Park', { role: 'member', is_executive: true, executive_title: 'President', executive_season: '2026' })],
  juniorIds: new Set(['k1']),
  matches: [...sen, ...kids],
  statLines: {
    [sen[0].id]: [line('p1', { goals: 4, motm: true }), line('p2', { clean_sheet: true })],
    [sen[1].id]: [line('p1', { goals: 1, yellow_cards: 1 }), line('p2')],
    [sen[2].id]: [line('p1', { goals: 2 }), line('p2')],
    [sen[3].id]: [line('p1'), line('p2')],
    [kids[0].id]: [line('k1', { goals: 3, motm: true })],
    [kids[1].id]: [line('k1', { goals: 5 })],
    [kids[2].id]: [line('k1', { goals: 1 })],
  },
  playerStats: [
    { id: 's1', club_id: 'c1', member_id: 'p1', season: '2025', appearances: 48, minutes_played: 0, goals: 0, assists: 0, clean_sheets: 0, yellow_cards: 0, red_cards: 0, motm_awards: 0 },
    { id: 's2', club_id: 'c1', member_id: 'p1', season: '2026', appearances: 4, minutes_played: 0, goals: 7, assists: 0, clean_sheets: 0, yellow_cards: 1, red_cards: 0, motm_awards: 1 },
  ],
  events: [], attendees: [], ticketPayments: new Map(), clubScore: [], sponsors: [], sponsorCounts: null, sponsorCents: null,
  availabilities: [], eventNotes: [{ eventId: 'e1', went_well: 'Good', next_time: 'Book early' }], news: [], gallery: [], money: null,
  extras: { ...emptyExtras(), awards: [{ award: 'Best and Fairest', name: 'Ruby Smith', member_id: 'k1', team_id: 'u9' }], thanks: [{ name: 'Mei Tan', role: 'canteen' }] },
  next: { season: null, events: [], matches: [], budgetCents: null },
  committee: true, currency: 'AUD', now: Date.parse('2026-11-18T00:00:00Z'),
};

const r = buildSeasonReview(base);
const club = r.views[CLUB];

// P1: every team's record, and the junior team's scores stay private
assert.deepEqual(club.records.map(x => [x.name, x.played, x.won, x.drawn, x.lost, x.hidden]), [['Seniors', 4, 2, 1, 1, false], ['Under 9s', 3, 3, 0, 0, true]]);
// Headline goals and wins leave out the team that hides its scores
assert.equal(club.figures.find(f => f.label === 'Goals')?.value, '10');
assert.equal(club.figures.find(f => f.label === 'Wins')?.value, '2');
assert.match(club.opening, /^2 teams played 7 games and scored 10 goals/);
// P2: goals from the junior team never show, so Ruby isn't a top scorer; Chris is
assert.deepEqual(club.leaders.find(b => b.title === 'Goals')?.rows.map(x => [x.name, x.n]), [['Chris Nguyen', 7]]);
// Player of the Match shows juniors by first name and initial
assert.ok(club.leaders.find(b => b.title === 'Player of the Match')?.rows.some(x => x.name === 'Ruby S.'));
assert.deepEqual(club.leaders.find(b => b.title === 'Clean sheets, goalkeepers')?.rows.map(x => x.name), ['Tom Wells']);
// P4: biggest win and most goals come only from teams that show scores
assert.equal(club.moments.find(m => m.label === 'Biggest win')?.value, '7-0');
assert.equal(club.moments.find(m => m.label === 'Longest unbeaten run')?.value, '3 games');
// P5: played every game
assert.deepEqual(club.everPresent.map(e => e.name), ['Chris Nguyen', 'Ruby S.', 'Tom Wells']);
// P6: 48 games before, 4 this season: the 50th game
assert.ok(club.milestones.some(m => m.text === 'Chris Nguyen played their 50th game for the club'));
assert.ok(club.milestones.some(m => m.text === 'Chris Nguyen scored their first goal for the club'));
// A team's own view
const u9 = r.views.u9;
assert.equal(u9.records.length, 1);
assert.ok(u9.leaders.every(b => b.title !== 'Goals'));
assert.match(u9.opening, /doesn't keep scores|don't keep scores/);
assert.equal(u9.card.award, 'Ruby S.');
// Awards and thanks: junior winners shortened, staff from team roles, typed helpers after
assert.equal(r.awards[0].winner, 'Ruby S.');
assert.deepEqual(r.thanks.map(g => [g.group, g.people.map(p => p.name)]), [['Coaches and team staff', ['Kate Lin']], ['Volunteers and helpers', ['Mei Tan']]]);
assert.deepEqual(r.members?.committee, [{ title: 'President', name: 'Linda Park' }]);

// The shared copy drops the committee notes, and money or replies when switched off
const withMoney = { ...r, money: seasonMoney({ payments: [{ id: 'x', kind: 'fee_request', category: 'registration', status: 'paid', method: 'stripe', amount_cents: 5000, season: '2026', paid_at: '2026-02-01T00:00:00Z' }], expenses: [], season: base.season, previous: null, currency: 'AUD', opening: null, today: '2026-11-18' }) };
assert.equal(withMoney.money?.income, 5000);
assert.equal(withMoney.money?.fees?.collected, 5000);
const shared = sharedCopy(withMoney, { hideMoney: true, hideReplies: true });
assert.equal(shared.money, null);
assert.equal(shared.committee, false);
assert.equal(sharedCopy(withMoney, { hideMoney: false, hideReplies: false }).money?.income, 5000);

// Saved rows from the database: bad ones dropped
const x = readExtras({ awards: [{ award: ' Best  and Fairest ', name: 'Tom' }, { award: '', name: 'Nobody' }, 'junk'], thanks: [{ name: 'Mei', role: 'canteen' }, { role: 'no name' }], hide_money: true });
assert.deepEqual(x.awards.map(a => a.award), ['Best and Fairest']);
assert.equal(x.thanks.length, 1);
assert.equal(x.hide_money, true);
assert.equal(x.hide_replies, false);

console.log('season-review checks passed');
