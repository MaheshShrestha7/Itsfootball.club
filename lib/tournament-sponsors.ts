// A tournament's own sponsors (migration 20261196): categories, their order and the header strip.
// Pure helpers; the hook that reads and writes them is lib/use-tournament-sponsors.ts.

export interface TournamentSponsor {
  id: string;
  tournament_id: string;
  club_id?: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  /** A preset key below, or the host's own words ("Food partner") */
  category: string;
  /** 'header': the strip under the tournament header and the list; 'list': the list only */
  placement: 'header' | 'list';
  display_order: number;
  is_active: boolean;
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

/** The public list: one group per category, highest category first, each in the host's order */
export function sponsorGroups(list: TournamentSponsor[]): { category: string; title: string; size: 'xl' | 'lg' | 'md' | 'sm'; sponsors: TournamentSponsor[] }[] {
  const shown = inOrder(list.filter(s => s.is_active));
  const cats = [...new Set(shown.map(s => s.category))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return cats.map(category => {
    const sponsors = shown.filter(s => s.category === category);
    const preset = PRESET.get(category);
    const r = rank(category);
    return {
      category,
      title: preset ? (sponsors.length > 1 ? preset.plural : preset.label) : category,
      // Bigger logos for higher categories
      size: r === 0 ? 'xl' : r === 1 ? 'lg' : r === 2 ? 'md' : 'sm',
      sponsors,
    };
  });
}

/** The strip under the header: the sponsors placed there, in the host's order */
export const headerSponsors = (list: TournamentSponsor[]) => inOrder(list.filter(s => s.is_active && s.placement === 'header'));

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
