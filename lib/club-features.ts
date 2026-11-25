// Features a club can switch off (Admin -> Club settings -> Features, or Mission Control's club panel).
// Stored as clubs.config.features_off (a list of keys), so every feature is on until someone turns it off
// and no new column is needed. Off only hides a feature: nothing is deleted, and turning it back on
// brings everything back as it was.

export type ClubFeatureKey =
  | 'shop' | 'sponsor_page' | 'tournaments' | 'events' | 'gallery' | 'news'
  | 'friendlies' | 'expense_claims' | 'committee';

export interface ClubFeature {
  key: ClubFeatureKey;
  label: string;
  /** What switching it off hides, in plain words */
  hides: string;
  /** Public pages under /{club}/ that close while it's off (first part of the path) */
  publicPaths?: string[];
  /** Admin pages under /{club}/admin/ that close, and leave the admin menu, while it's off */
  adminPaths?: string[];
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
];

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
