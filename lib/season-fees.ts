// The maths of the free season budget & subs fee calculator (/tools/season-fee-calculator): the break-even
// membership fee from a season's costs, and what a club keeps when it collects that fee by card (less the
// card processing fee) or in cash (less the players who never pay). All amounts are in cents.

export interface CostLine {
  label: string;
  cents: number;
  /** Charged for every player (e.g. association player registration) rather than once for the season */
  perPlayer: boolean;
}

export interface CardFee {
  percent: number;
  fixedCents: number;
}

export interface FeePreset extends CardFee {
  id: string;
  label: string;
}

/** Stripe Australia's published rates (GST included), from stripe.com/au/pricing, checked 15 October 2026 */
export const STRIPE_AU_SOURCE = { url: 'https://stripe.com/au/pricing', checked: '15 October 2026' };
export const CARD_PRESETS: FeePreset[] = [
  { id: 'stripe-au', label: 'Stripe AU cards', percent: 1.65, fixedCents: 30 },
  { id: 'stripe-au-intl', label: 'Stripe intl cards', percent: 3.5, fixedCents: 30 },
  { id: 'custom', label: 'Custom rate', percent: 1.65, fixedCents: 30 },
];

export interface BudgetInput {
  costs: CostLine[];
  players: number;
  /** Sponsorship, grants and fundraising that go towards this season */
  incomeCents: number;
  /** A safety margin on top of the costs, e.g. 5 (%) */
  bufferPercent: number;
  card: CardFee;
  /** Share of players who never pay when the club chases cash or transfers, e.g. 10 (%) */
  unpaidPercent: number;
  /** The fee the club will charge; null = the suggested fee */
  feeCents: number | null;
}

export interface Collection {
  /** Players who pay */
  paying: number;
  /** Charged to the players who pay */
  grossCents: number;
  /** Card processing fees (card) or unpaid fees (cash) */
  lostCents: number;
  /** What the club ends up with */
  keptCents: number;
  /** keptCents + income minus the season's costs (with the buffer): positive is a surplus */
  balanceCents: number;
}

export interface Budget {
  ok: boolean;
  error?: string;
  /** Season costs, per-player lines multiplied out */
  costsCents: number;
  bufferCents: number;
  /** What the players' fees must raise: costs + buffer - income (never below 0) */
  toRaiseCents: number;
  /** The fee if every player pays and nothing is deducted */
  breakEvenCents: number;
  /** The fee that still nets breakEvenCents a player after the card fee */
  cardPriceCents: number;
  /** The fee that still raises toRaiseCents when the unpaid players don't pay */
  cashPriceCents: number;
  unpaidPlayers: number;
  /** The suggested fee: the card price rounded up to the next whole 5 dollars */
  suggestedCents: number;
  feeCents: number;
  card: Collection;
  cash: Collection;
  /** Each cost line per player, for the breakdown */
  perPlayer: { label: string; cents: number }[];
}

export const MAX_PLAYERS = 500;

/** The card fee on one payment of `cents` */
export function cardFeeCents(cents: number, card: CardFee): number {
  if (!(cents > 0)) return 0;
  return Math.round((cents * card.percent) / 100) + card.fixedCents;
}

/** The smallest charge that leaves at least `netCents` after the card fee */
export function grossUpCents(netCents: number, card: CardFee): number {
  if (!(netCents > 0)) return 0;
  let gross = Math.ceil((netCents + card.fixedCents) / (1 - card.percent / 100));
  // The fee is rounded to the cent, so step back while a cent less still covers it
  while (gross > 0 && gross - 1 - cardFeeCents(gross - 1, card) >= netCents) gross--;
  while (gross - cardFeeCents(gross, card) < netCents) gross++;
  return gross;
}

export const roundUpTo = (cents: number, step: number) => Math.ceil(cents / step) * step;

export function seasonBudget(input: BudgetInput): Budget {
  const players = Math.floor(input.players);
  const perPlayer = input.costs.filter(c => c.cents > 0).map(c => ({
    label: c.label.trim() || 'Other cost',
    cents: c.perPlayer ? c.cents : players > 0 ? Math.round(c.cents / players) : 0,
  }));
  const empty: Collection = { paying: 0, grossCents: 0, lostCents: 0, keptCents: 0, balanceCents: 0 };
  const base = { costsCents: 0, bufferCents: 0, toRaiseCents: 0, breakEvenCents: 0, cardPriceCents: 0, cashPriceCents: 0, unpaidPlayers: 0, suggestedCents: 0, feeCents: 0, card: empty, cash: empty, perPlayer };
  if (!(players >= 1) || players > MAX_PLAYERS) return { ok: false, error: `Enter between 1 and ${MAX_PLAYERS} players.`, ...base };
  if (!(input.card.percent >= 0 && input.card.percent < 50) || !(input.card.fixedCents >= 0)) return { ok: false, error: 'Check the card fee: a percentage under 50% and a fixed fee of 0 or more.', ...base };

  const costsCents = input.costs.reduce((sum, c) => sum + Math.max(0, c.cents) * (c.perPlayer ? players : 1), 0);
  const bufferCents = Math.round((costsCents * Math.max(0, input.bufferPercent)) / 100);
  const toRaiseCents = Math.max(0, costsCents + bufferCents - Math.max(0, input.incomeCents));
  const breakEvenCents = Math.ceil(toRaiseCents / players);
  const cardPriceCents = grossUpCents(breakEvenCents, input.card);

  const unpaidPercent = Math.min(90, Math.max(0, input.unpaidPercent));
  const unpaidPlayers = Math.min(players - 1, Math.round((players * unpaidPercent) / 100));
  const cashPayers = players - unpaidPlayers;
  const cashPriceCents = Math.ceil(toRaiseCents / cashPayers);

  const suggestedCents = roundUpTo(cardPriceCents, 500);
  const feeCents = input.feeCents != null && input.feeCents >= 0 ? Math.round(input.feeCents) : suggestedCents;
  const spend = costsCents + bufferCents - Math.max(0, input.incomeCents);

  const cardKept = players * (feeCents - cardFeeCents(feeCents, input.card));
  const card: Collection = {
    paying: players,
    grossCents: players * feeCents,
    lostCents: players * cardFeeCents(feeCents, input.card),
    keptCents: cardKept,
    balanceCents: cardKept - spend,
  };
  const cashKept = cashPayers * feeCents;
  const cash: Collection = {
    paying: cashPayers,
    grossCents: players * feeCents,
    lostCents: unpaidPlayers * feeCents,
    keptCents: cashKept,
    balanceCents: cashKept - spend,
  };

  return { ok: true, costsCents, bufferCents, toRaiseCents, breakEvenCents, cardPriceCents, cashPriceCents, unpaidPlayers, suggestedCents, feeCents, card, cash, perPlayer };
}

/** "$1,234.50", or "$1,235" with whole = true */
export function money(cents: number, whole = false): string {
  const v = cents / 100;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(v);
}

/** The example season the calculator opens with: one senior amateur team of 18 players (illustrative, not quotes) */
export const EXAMPLE_COSTS: CostLine[] = [
  { label: 'Pitch and training ground hire', cents: 320000, perPlayer: false },
  { label: 'League / association team entry', cents: 120000, perPlayer: false },
  { label: 'Referee fees', cents: 160000, perPlayer: false },
  { label: 'Player registration & insurance', cents: 16000, perPlayer: true },
  { label: 'Balls, bibs and cones', cents: 45000, perPlayer: false },
  { label: 'Playing kit', cents: 140000, perPlayer: false },
  { label: 'Trophies and presentation night', cents: 50000, perPlayer: false },
  { label: 'First aid kit and strapping', cents: 15000, perPlayer: false },
];
export const EXAMPLE_PLAYERS = 18;
export const EXAMPLE_INCOME = 250000;
