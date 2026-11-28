// A tournament's own sponsors (migration 20261196): categories, their order and the header strip.
// Pure helpers; the hook that reads and writes them is lib/use-tournament-sponsors.ts.

export type SponsorPlacement = 'title' | 'header' | 'list';

export interface TournamentSponsor {
  id: string;
  tournament_id: string;
  club_id?: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  /** A preset key below, or the host's own words ("Food partner") */
  category: string;
  /** 'title': the one main sponsor ("<name> presents" above the tournament name); 'header': the strip
   *  under the tournament header; 'list': the list only. Every shown sponsor is also in the list. */
  placement: SponsorPlacement;
  display_order: number;
  is_active: boolean;
  /** The host's own logo size (migration 20261199); null or missing = the category's size */
  logo_size?: LogoSize | null;
}

/** Logo sizes, biggest first. Each preset category has its own; every other category is small. */
export const LOGO_SIZES = [
  { key: 'platinum', label: 'Platinum size', desk: 2, phone: 1 },
  { key: 'gold', label: 'Gold size', desk: 3, phone: 2 },
  { key: 'silver', label: 'Silver size', desk: 4, phone: 2 },
  { key: 'bronze', label: 'Bronze size', desk: 5, phone: 3 },
  { key: 'small', label: 'Small', desk: 6, phone: 3 },
] as const;
export type LogoSize = (typeof LOGO_SIZES)[number]['key'];
const SIZE = new Map<string, (typeof LOGO_SIZES)[number]>(LOGO_SIZES.map(z => [z.key, z]));

/** The size a category's logos get: Platinum, Gold, Silver, Bronze, otherwise small */
export const categorySize = (category: string): LogoSize => (SIZE.has(category) ? (category as LogoSize) : 'small');
/** One sponsor's size: the host's choice, else its category's */
export const sponsorSize = (s: Pick<TournamentSponsor, 'category' | 'logo_size'>): LogoSize =>
  (s.logo_size && SIZE.has(s.logo_size) ? s.logo_size : categorySize(s.category));
export const sizeLabel = (size: LogoSize) => SIZE.get(size)!.label;

/** How many columns a logo spans in its category's row (each size is a share of the row), on desktop and phone */
export function logoSpan(size: LogoSize, rowSize: LogoSize): { desk: number; phone: number } {
  const t = SIZE.get(size)!, r = SIZE.get(rowSize)!;
  return { desk: Math.min(r.desk, Math.max(1, Math.round(r.desk / t.desk))), phone: Math.min(r.phone, Math.max(1, Math.round(r.phone / t.phone))) };
}

/** The preset categories, highest first: the public list follows this order */
export const SPONSOR_CATEGORIES = [
  { key: 'platinum', label: 'Platinum', plural: 'Platinum' },
  { key: 'gold', label: 'Gold', plural: 'Gold' },
  { key: 'silver', label: 'Silver', plural: 'Silver' },
  { key: 'bronze', label: 'Bronze', plural: 'Bronze' },
  { key: 'media', label: 'Media partner', plural: 'Media partners' },
  { key: 'partner', label: 'Partner', plural: 'Partners' },
] as const;

const PRESET = new Map<string, (typeof SPONSOR_CATEGORIES)[number]>(SPONSOR_CATEGORIES.map(c => [c.key, c]));

export const isPresetCategory = (category: string) => PRESET.has(category);
export const categoryLabel = (category: string) => PRESET.get(category)?.label ?? category;
/** New sponsors in these categories start in the header strip */
export const defaultPlacement = (category: string): 'header' | 'list' => (category === 'platinum' || category === 'gold' ? 'header' : 'list');

/** Rank of a category: presets in their order, then the host's own categories */
const rank = (category: string) => {
  const i = SPONSOR_CATEGORIES.findIndex(c => c.key === category);
  return i === -1 ? SPONSOR_CATEGORIES.length : i;
};

/** Sponsors in the host's order (display_order, then name) */
export const inOrder = (list: TournamentSponsor[]) =>
  [...list].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

/** The public list: one group per category, highest category first, each in the host's order (admin: hidden ones too) */
export function sponsorGroups(list: TournamentSponsor[], withHidden = false): { category: string; title: string; size: LogoSize; sponsors: TournamentSponsor[] }[] {
  const shown = inOrder(withHidden ? list : list.filter(s => s.is_active));
  const cats = [...new Set(shown.map(s => s.category))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return cats.map(category => {
    const sponsors = shown.filter(s => s.category === category);
    const preset = PRESET.get(category);
    return {
      category,
      title: preset ? (sponsors.length > 1 ? preset.plural : preset.label) : category,
      // Bigger logos for higher categories
      size: categorySize(category),
      sponsors,
    };
  });
}

/** The strip under the header: the sponsors placed there, biggest logo size first, then the host's order */
export const headerSponsors = (list: TournamentSponsor[]) => {
  const big = (s: TournamentSponsor) => LOGO_SIZES.findIndex(z => z.key === sponsorSize(s));
  return inOrder(list.filter(s => s.is_active && s.placement === 'header')).sort((a, b) => big(a) - big(b));
};

/** The tournament's main sponsor ("<name> presents"), when it has a shown one */
export const titleSponsor = (list: TournamentSponsor[]) => list.find(s => s.is_active && s.placement === 'title');

export const PLACEMENT_LABEL: Record<SponsorPlacement, string> = {
  title: 'Main sponsor',
  header: 'Header strip and list',
  list: 'List only',
};

/** Moves one sponsor up or down; returns the new display_order for every sponsor whose order changed */
export function moveSponsor(list: TournamentSponsor[], id: string, dir: -1 | 1): { id: string; display_order: number }[] {
  const ordered = inOrder(list);
  const i = ordered.findIndex(s => s.id === id);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= ordered.length) return [];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  return ordered.map((s, k) => ({ id: s.id, display_order: k })).filter(x => list.find(s => s.id === x.id)!.display_order !== x.display_order);
}

/** A website as typed ("momohouse.com.au") made into a link; '' stays empty */
export const normaliseWebsite = (raw: string) => {
  const v = raw.trim();
  return !v ? '' : /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
