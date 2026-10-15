// The free tools under /tools: the three main tools and the format landing pages that open them with
// different defaults. Used for the sitemap, the cross-links between the pages and llms.txt.
export interface ToolPageLink {
  path: string;
  label: string;
  blurb: string;
}

export const LINEUP_TOOL: ToolPageLink = { path: '/tools/lineup-builder', label: 'Football lineup builder', blurb: '5, 7, 9 or 11-a-side, 28 formations' };
export const TOURNAMENT_TOOL: ToolPageLink = { path: '/tools/tournament-maker', label: 'Soccer tournament maker', blurb: 'Groups, knockout or league, live link' };
export const RESULT_TOOL: ToolPageLink = { path: '/tools/match-result-graphic-maker', label: 'Match result graphic maker', blurb: 'Full-time score for stories and posts' };

export const LINEUP_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/11-a-side-lineup-builder', label: '11-a-side lineup builder', blurb: 'Opens on 4-3-3' },
  { path: '/tools/9-a-side-lineup-builder', label: '9-a-side lineup builder', blurb: 'Opens on 3-3-2' },
  { path: '/tools/7-a-side-lineup-builder', label: '7-a-side lineup builder', blurb: 'Opens on 2-3-1' },
  { path: '/tools/5-a-side-formation-builder', label: '5-a-side formation builder', blurb: 'Opens on the 1-2-1 diamond' },
];

export const TOURNAMENT_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/round-robin-fixture-generator', label: 'Round robin fixture generator', blurb: 'Everyone plays everyone once' },
  { path: '/tools/knockout-cup-bracket-maker', label: 'Knockout cup bracket maker', blurb: 'Single elimination with byes' },
];

export const RESULT_FORMAT_PAGES: ToolPageLink[] = [
  { path: '/tools/player-of-the-match-graphic-maker', label: 'Player of the Match graphic maker', blurb: 'MOTM card with their photo' },
];

export const FORMAT_PAGES = [...LINEUP_FORMAT_PAGES, ...TOURNAMENT_FORMAT_PAGES, ...RESULT_FORMAT_PAGES];
