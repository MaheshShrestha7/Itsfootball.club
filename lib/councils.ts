// Councils whose sportsgrounds appear in the grounds directory (/grounds), with the official page that
// says whether their grounds are open after rain. Each link and phone number was read on the council's
// own site on COUNCILS_CHECKED; re-check them before relying on them in a new season.
//   kind 'status': the page itself shows open / closed (by ground, or one status for all grounds)
//   kind 'info':   the council's sportsground page, which links on to its closures information
// A council not listed here can still be picked as 'other' with its name typed in.

export const COUNCILS_CHECKED = '2026-10-15';

export type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

export const STATES: { code: AuState; name: string }[] = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

export interface Council {
  key: string;
  name: string;
  state: AuState;
  url: string;
  kind: 'status' | 'info';
  /** How the council says it publishes closures, in a sentence */
  note: string;
  /** A phone line the council gives for ground closures, when it gives one */
  phone?: { label: string; number: string };
}

export const COUNCILS: Council[] = [
  {
    key: 'blacktown', name: 'Blacktown City Council', state: 'NSW', kind: 'status',
    url: 'https://www.blacktown.nsw.gov.au/Sport-recreation/Sports-field-closures',
    note: 'The council posts one open or closed status for all its fields, updated on weekdays, so a field closed on Friday stays closed over the weekend.',
    phone: { label: 'Greenspace Services', number: '(02) 5300 6000' },
  },
  {
    key: 'camden', name: 'Camden Council', state: 'NSW', kind: 'status',
    url: 'https://www.camden.nsw.gov.au/parks-and-recreation/sports-field-status',
    note: 'The council lists every sports field as open, closed or managed by club, updated by 2pm, and Friday’s status applies all weekend.',
  },
  {
    key: 'campbelltown', name: 'Campbelltown City Council', state: 'NSW', kind: 'status',
    url: 'https://www.campbelltown.nsw.gov.au/Parks-Sport-Recreation/Sports-Ground-Status',
    note: 'The council posts its latest sports ground closures for the Campbelltown area on its status page.',
  },
  {
    key: 'canterbury-bankstown', name: 'City of Canterbury Bankstown', state: 'NSW', kind: 'status',
    url: 'https://fieldav-public.cbcity.nsw.gov.au',
    note: 'The council keeps a wet weather status report for every park and field (open, closed or under maintenance), searchable by park.',
  },
  {
    key: 'cumberland', name: 'Cumberland City Council', state: 'NSW', kind: 'info',
    url: 'https://www.cumberland.nsw.gov.au/sports-ground-listing-and-closures',
    note: 'The council’s sports ground list links to its sports ground closures page.',
  },
  {
    key: 'fairfield', name: 'Fairfield City Council', state: 'NSW', kind: 'status',
    url: 'https://www.fairfieldcity.nsw.gov.au/Services/Sports-Parks-Recreation/Using-Our-Sportsfields-including-when-wet',
    note: 'The sportsfields status section of the council’s sportsfields page is its main source of closure information.',
    phone: { label: 'Customer Service', number: '(02) 9725 0222' },
  },
  {
    key: 'hornsby', name: 'Hornsby Shire Council', state: 'NSW', kind: 'info',
    url: 'https://www.hornsby.nsw.gov.au/Community/Sports-and-recreation/Sporting-facilities/Sportsgrounds',
    note: 'Fields close in wet weather, and the council’s sportsgrounds page links to its closures page.',
  },
  {
    key: 'liverpool', name: 'Liverpool City Council', state: 'NSW', kind: 'status',
    url: 'https://www.liverpool.nsw.gov.au/venues/Sports-and-Leisure/wet-weather',
    note: 'The council posts one status for all its grounds, with weekend decisions by 3:30pm Friday, reviewed Monday at 9:30am.',
  },
  {
    key: 'parramatta', name: 'City of Parramatta', state: 'NSW', kind: 'status',
    url: 'https://www.cityofparramatta.nsw.gov.au/community/sports-and-facilities/sportsground-status',
    note: 'The council lists its grounds as open or closed, updated by 2:30pm on weekdays in wet weather.',
  },
  {
    key: 'penrith', name: 'Penrith City Council', state: 'NSW', kind: 'info',
    url: 'https://penrithcity.nsw.gov.au/facilities-recreation/sports/sports-ground-maintenance-and-closures',
    note: 'The council runs a 24-hour recorded closures line, and clubs decide closures for their own training and games, so check with your club too.',
    phone: { label: '24-hour recorded closures message', number: '(02) 4732 8017' },
  },
  {
    key: 'ryde', name: 'City of Ryde', state: 'NSW', kind: 'status',
    url: 'https://www.ryde.nsw.gov.au/Recreation/Parks-and-Sportsgrounds/Sportsground-Status',
    note: 'The council posts each wet weather update, with its time, on its sportsground status page.',
  },
];

export const councilByKey = (key: string | null | undefined): Council | undefined =>
  key ? COUNCILS.find(c => c.key === key) : undefined;

export const stateName = (code: string) => STATES.find(s => s.code === code)?.name || code;
