// The admin welcome pack: what to set up, where it is and how, for a new Owner or admin.
// Shown on /{club}/admin/start and emailed by /api/admin/welcome-pack. Each person only sees the
// steps their access lets them do (Owner / Club Admin: all of them; a Treasurer: the money ones).

import { levelAtLeast, type AccessLevel } from './permissions';

/** What the club already has, so steps tick themselves off */
export interface PackFacts {
  logo: boolean;
  season: boolean;
  teams: boolean;
  plans: boolean;
  stripe: boolean;
  players: boolean;
  fixture: boolean;
  shared: boolean;
  helper: boolean;
}

export type FactKey = keyof PackFacts;

export interface PackStep {
  key: string;
  title: string;
  what: string;
  /** The admin menu path to it */
  where: string;
  how: string[];
  button: string;
  href: (slug: string) => string;
  /** Needs edit on this admin area; 'super' = Owner or Club Admin only; null = anyone with admin access */
  area: string | 'super' | null;
  /** Ticks itself off when this is true */
  fact?: FactKey;
  /** Can be ticked by hand (nothing in the data shows it, or the club may skip it) */
  manual?: boolean;
}

export interface PackGroup {
  key: string;
  title: string;
  sub: string;
  steps: PackStep[];
}

const admin = (path: string) => (slug: string) => `/${slug}/admin${path}`;

export const PACK_GROUPS: PackGroup[] = [
  {
    key: 'yours',
    title: 'Make it yours',
    sub: 'Your club’s look and the season everything hangs off.',
    steps: [
      {
        key: 'logo', title: 'Logo and club colours', fact: 'logo', area: 'branding',
        what: 'Your crest and colours show across the website, member passes and share graphics.',
        where: 'Club settings › Club profile and branding',
        how: ['Upload your crest.', 'Pick your main and second colours.', 'Add your home ground so fixtures show where to go.'],
        button: 'Open branding', href: admin('/branding'),
      },
      {
        key: 'season', title: 'Set up your season', fact: 'season', area: 'seasons',
        what: 'Fees, fixtures and stats all belong to a season.',
        where: 'Club settings › Seasons',
        how: ['Add a season, e.g. 2027.', 'Set the start and end dates.'],
        button: 'Open seasons', href: admin('/seasons'),
      },
    ],
  },
  {
    key: 'people',
    title: 'Teams and people',
    sub: 'Who plays for which team, and what they pay.',
    steps: [
      {
        key: 'teams', title: 'Set up your teams', fact: 'teams', area: 'teams',
        what: 'Seniors, juniors and age groups each get their own squad and fixtures.',
        where: 'Players and teams › Club teams',
        how: ['Add each team.', 'Junior team? Fill in the safeguarding settings it asks for.'],
        button: 'Open teams', href: admin('/teams'),
      },
      {
        key: 'plans', title: 'Add membership plans', fact: 'plans', area: 'finance',
        what: 'What players and supporters pay to join.',
        where: 'Money › Finance › Payment settings',
        how: ['Add a plan for each kind of member (player, junior, supporter).', 'Set the price, or make it free.'],
        button: 'Open payment settings', href: admin('/finance?tab=settings'),
      },
      {
        key: 'stripe', title: 'Take card payments', fact: 'stripe', area: 'finance', manual: true,
        what: 'Members pay online and the money goes to the club’s own Stripe account.',
        where: 'Money › Finance › Payment settings',
        how: ['Press Connect Stripe and follow Stripe’s steps.', 'Prefer cash or bank transfer? Mark this done and record payments by hand.'],
        button: 'Open payment settings', href: admin('/finance?tab=settings'),
      },
      {
        key: 'players', title: 'Add your players', fact: 'players', area: 'squad',
        what: 'Players and parents get a digital member pass once they’re in.',
        where: 'Players and teams › People',
        how: ['Add people one by one, or import a spreadsheet (CSV).', 'Or share your join link and approve people under Applications.'],
        button: 'Open People', href: admin('/people'),
      },
    ],
  },
  {
    key: 'matchday',
    title: 'Matchday',
    sub: 'Everything for game day, from the fixture to the final score.',
    steps: [
      {
        key: 'fixture', title: 'Schedule your first fixture', fact: 'fixture', area: 'matches',
        what: 'It shows on your website straight away.',
        where: 'Fixtures and events › Fixtures and results',
        how: ['Add the opponent, date, time and ground.', 'Pick the team that’s playing.'],
        button: 'Open fixtures', href: admin('/matches'),
      },
      {
        key: 'availability', title: 'Ask who’s available', area: 'availability', manual: true,
        what: 'Players answer In, Out or Maybe from their phone.',
        where: 'Matchday › Player availability',
        how: ['Pick the fixture.', 'Send the reminder to the squad.'],
        button: 'Open availability', href: admin('/availability'),
      },
      {
        key: 'lineup', title: 'Pick the line-up and go live', area: 'lineup', manual: true,
        what: 'Drag players onto the pitch, then run the live score on the day.',
        where: 'Matchday › Lineup workbench, then Match Centre',
        how: ['Build the line-up from players who said In.', 'On the day, open Match Centre and press Start.'],
        button: 'Open Lineup workbench', href: admin('/lineup/draft'),
      },
    ],
  },
  {
    key: 'share',
    title: 'Tell people and share the work',
    sub: 'Get members in, and don’t run it all on your own.',
    steps: [
      {
        key: 'share', title: 'Share your club link', fact: 'shared', area: null, manual: true,
        what: 'Send it to players and parents so they can join.',
        where: 'Your website',
        how: ['Copy the link.', 'Post it in your team chat or socials.'],
        button: 'Copy link', href: slug => `/${slug}`,
      },
      {
        key: 'helper', title: 'Give a role to a helper', fact: 'helper', area: 'super',
        what: 'A Treasurer sees the money, a Manager runs the football. Nobody gets more than they need.',
        where: 'Club settings › Roles and permissions',
        how: ['Pick a role, e.g. Treasurer or Manager.', 'In People, add that role to the person.'],
        button: 'Open roles', href: admin('/roles'),
      },
    ],
  },
];

/** "Later, when you're ready": nice to have, never counted */
export const PACK_LATER: { key: string; title: string; what: string; where: string; area: string | null; href: (slug: string) => string }[] = [
  { key: 'sponsors', title: 'Sponsors', what: 'Packages, sign-ups and invoices.', where: 'Money › Sponsors', area: 'sponsors', href: admin('/sponsors') },
  { key: 'shop', title: 'Club shop', what: 'Kit and merch, paid online.', where: 'Money › Club shop', area: 'shop', href: admin('/shop') },
  { key: 'events', title: 'Events and training', what: 'Training nights, socials and tickets.', where: 'Fixtures and events › Events and training', area: 'events', href: admin('/events') },
  { key: 'domain', title: 'Your own web address', what: 'Use your club’s own domain.', where: 'Club settings › Club profile and branding', area: 'branding', href: admin('/branding') },
  { key: 'twostep', title: '2-step sign-in', what: 'Protect your account with a code from an app.', where: 'Your account › Account settings', area: null, href: slug => `/${slug}/account` },
];

/** Who's looking: a super user (Owner / Club Admin) or the highest level per area from their roles */
export interface PackViewer {
  isSuper: boolean;
  areas: Record<string, AccessLevel>;
}

const allowed = (area: string | null, v: PackViewer, need: AccessLevel) =>
  area === null || v.isSuper || (area !== 'super' && levelAtLeast(v.areas[area], need));

/** The groups and steps this person can do (empty groups dropped) */
export function packFor(v: PackViewer): PackGroup[] {
  return PACK_GROUPS
    .map(g => ({ ...g, steps: g.steps.filter(s => allowed(s.area, v, 'edit')) }))
    .filter(g => g.steps.length > 0);
}

export function laterFor(v: PackViewer) {
  return PACK_LATER.filter(l => allowed(l.area, v, 'edit'));
}

export function isStepDone(step: PackStep, facts: Partial<PackFacts>, ticked: ReadonlySet<string>): boolean {
  return (!!step.fact && !!facts[step.fact]) || (!!step.manual && ticked.has(step.key));
}

/** Done count, total and the first step not done yet */
export function packProgress(groups: PackGroup[], facts: Partial<PackFacts>, ticked: ReadonlySet<string> = new Set()) {
  const steps = groups.flatMap(g => g.steps);
  const done = steps.filter(s => isStepDone(s, facts, ticked)).length;
  return { done, total: steps.length, next: steps.find(s => !isStepDone(s, facts, ticked)) || null };
}

/** Lower-cased labels; a member counts as a player when one of them is 'player' (isPlayerMember) */
const labelsOf = (role?: string | null, roles?: unknown) =>
  [...(Array.isArray(roles) ? roles.map(String) : []), ...(role || '').split(',')].map(r => r.trim().toLowerCase()).filter(Boolean);

/**
 * Facts from the club's rows (the page has them in the club context; the email route reads them).
 * `helperRoles`: names of the club's access roles other than Club Admin.
 */
export function factsFrom(d: {
  logoUrl?: string | null;
  seasons: number;
  teams: number;
  teamMembers: number;
  plans: number;
  stripe: boolean;
  fixtures: number;
  members: { role?: string | null; roles?: unknown; applied_at?: string | null }[];
  helperRoles: string[];
  sharedFlag?: boolean;
}): PackFacts {
  const helpers = new Set(d.helperRoles.map(r => r.toLowerCase()));
  return {
    logo: !!d.logoUrl,
    season: d.seasons > 0,
    // Same rule as the dashboard list: more than the default team, or someone placed in one
    teams: d.teams > 1 || d.teamMembers > 0,
    plans: d.plans > 0,
    stripe: d.stripe,
    players: d.members.some(m => {
      const arr = Array.isArray(m.roles) && m.roles.length ? m.roles.map(r => String(r).toLowerCase()) : (m.role || '').split(',').map(r => r.trim().toLowerCase());
      return arr.includes('player');
    }),
    fixture: d.fixtures > 0,
    // Someone applied through the join page, so the link is out there
    shared: !!d.sharedFlag || d.members.some(m => !!m.applied_at),
    helper: d.members.some(m => labelsOf(m.role, m.roles).some(l => helpers.has(l))),
  };
}
