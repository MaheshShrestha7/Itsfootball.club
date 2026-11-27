// Features a club can switch off (Admin -> Club settings -> Features, or Mission Control's club panel).
// Stored as clubs.config.features_off (a list of keys), so every feature is on until someone turns it off
// and no new column is needed. Off only hides a feature: nothing is deleted, and turning it back on
// brings everything back as it was.

export type ClubFeatureKey =
  | 'shop' | 'sponsor_page' | 'tournaments' | 'events' | 'gallery' | 'news'
  | 'friendlies' | 'expense_claims' | 'committee' | 'joining' | 'scanner' | 'perks'
  | 'home_numbers' | 'home_sponsors' | 'home_committee' | 'home_top_players' | 'home_ground';

export interface ClubFeature {
  key: ClubFeatureKey;
  label: string;
  /** What switching it off hides, in plain words */
  hides: string;
  /** Public pages under /{club}/ that close while it's off (first part of the path) */
  publicPaths?: string[];
  /** Admin pages under /{club}/admin/ that close, and leave the admin menu, while it's off */
  adminPaths?: string[];
  /** Shown under "Home page sections" on the Features page */
  home?: boolean;
}

export const CLUB_FEATURES: ClubFeature[] = [
  { key: 'shop', label: 'Club shop', hides: 'The Shop page, its menu links and Admin → Club shop.', publicPaths: ['shop'], adminPaths: ['shop'] },
  { key: 'sponsor_page', label: 'Become a sponsor page', hides: 'The public sponsor sign-up page and its menu links. Your sponsors still show on the site, and their invoice and sponsorship links keep working.', publicPaths: ['sponsor'] },
  { key: 'tournaments', label: 'Tournaments and cups', hides: 'The Tournaments pages, tournament entry links and Admin → Tournaments and cups.', publicPaths: ['tournaments', 'tournament-entry'], adminPaths: ['tournaments'] },
  { key: 'events', label: 'Events and tickets', hides: 'The public Events pages, the events on the club home page and ticket sales. Training and events stay in Admin.', publicPaths: ['events'] },
  { key: 'gallery', label: 'Photo gallery', hides: 'The Gallery page, its menu links and Admin → Photo gallery.', publicPaths: ['gallery'], adminPaths: ['gallery'] },
  { key: 'news', label: 'News', hides: 'The News pages, the news on the club home page and Admin → News.', publicPaths: ['news'], adminPaths: ['content'] },
  { key: 'friendlies', label: 'Friendly match invites', hides: 'The "Invite us to a friendly" choice on the contact form.' },
  { key: 'expense_claims', label: 'Expense claims', hides: 'Claiming money back from the member area, and the Expense claims tab in Finance.' },
  { key: 'committee', label: 'Committee meetings', hides: 'Admin → Committee (meetings, agendas and minutes).', adminPaths: ['committee'] },
  { key: 'joining', label: 'Online joining', hides: 'The "Join the club" buttons and the membership application form. Members still sign in, and parents can still add a child.' },
  { key: 'scanner', label: 'Gate scanner', hides: 'Admin → Gate scanner and the pass check page. Member passes still show.', publicPaths: ['verify'], adminPaths: ['scanner'] },
  { key: 'perks', label: 'Member perks', hides: 'Sponsor perks in the member area, on the join page and on the pass check page, and the Member perks tab under Sponsors. Your perks are kept.' },
  { key: 'home_numbers', label: 'Club in numbers', hides: 'The club numbers under the hero.', home: true },
  { key: 'home_sponsors', label: 'Sponsors', hides: '"Thank you to our sponsors" on the home page. Sponsors still show in the footer and on match pages.', home: true },
  { key: 'home_committee', label: 'Committee', hides: 'The committee members on the home page. The Leadership page stays.', home: true },
  { key: 'home_top_players', label: 'Top players', hides: 'The top players table on the home page. Player pages stay.', home: true },
  { key: 'home_ground', label: 'Home ground and map', hides: 'The home ground details and map on the home page.', home: true },
];

/** ClubScore has had its own on/off since migration 20261105 (clubscore_rules.is_active, which also stops the
 *  database awarding points), so it keeps that switch and only shows beside the others */
export const CLUBSCORE_FEATURE = {
  label: 'ClubScore (points and badges)',
  hides: 'While it’s off, players earn no points from check-ins, matches or coach bonuses. Points already earned stay.',
};

/** Score by chat keeps its own switch too (club_chat_settings.scoring_enabled, migration 20261183), off until
 *  turned on; the Features page and Mission Control show it beside the others */
export const SCORE_BY_CHAT_FEATURE = {
  label: 'Score by chat',
  hides: 'Lets the people you allow send goals, cards and the score from Telegram. Set up the club link in Match Centre.',
};

type WithConfig = { config?: unknown } | null | undefined;

/** The keys a club has switched off */
export function featuresOff(club: WithConfig): ClubFeatureKey[] {
  const config = club?.config;
  const off = config && typeof config === 'object' ? (config as { features_off?: unknown }).features_off : null;
  return Array.isArray(off) ? off.filter((k): k is ClubFeatureKey => CLUB_FEATURES.some(f => f.key === k)) : [];
}

/** True unless the club switched the feature off (on by default) */
export const featureOn = (club: WithConfig, key: ClubFeatureKey) => !featuresOff(club).includes(key);

/** The config to save: the club's other settings kept, features_off replaced (left out when all are on) */
export function configWithFeaturesOff(config: unknown, off: ClubFeatureKey[]): Record<string, unknown> {
  const next = { ...(config && typeof config === 'object' ? config as Record<string, unknown> : {}) };
  const clean = CLUB_FEATURES.map(f => f.key).filter(k => off.includes(k));
  if (clean.length) next.features_off = clean; else delete next.features_off;
  return next;
}

/** The switched-off feature that closes a page, from the path after /{club}/ ('shop', 'admin/gallery'), or null */
export function featureClosingPath(club: WithConfig, rest: string): ClubFeature | null {
  const off = featuresOff(club);
  if (!off.length) return null;
  const parts = rest.split('/').filter(Boolean);
  const admin = parts[0] === 'admin';
  const segment = admin ? parts[1] : parts[0];
  if (!segment) return null;
  // The sponsor page's invoice and "your sponsorship" links belong to sponsors who already signed up
  if (!admin && segment === 'sponsor' && parts.length > 1) return null;
  return CLUB_FEATURES.find(f => off.includes(f.key) && (admin ? f.adminPaths : f.publicPaths)?.includes(segment)) || null;
}
