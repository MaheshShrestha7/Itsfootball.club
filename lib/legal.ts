// Details shown on /privacy and /terms. Bump LEGAL_UPDATED whenever either page's wording changes.
export const LEGAL = {
  /** Where the platform is run from; also whose laws and courts govern the terms */
  jurisdiction: 'New South Wales, Australia',
  email: 'contact@itsfootball.club',
  /** Optional: shown only when filled in (e.g. once an ABN is registered) */
  abn: '',
  /** Optional postal address for privacy requests (a PO box is fine); shown only when filled in */
  address: '',
};

export const LEGAL_UPDATED = '10 October 2026';

/** "itsfootball.club is run from New South Wales, Australia (ABN …)" */
export const LEGAL_IDENTITY = `itsfootball.club is run from ${LEGAL.jurisdiction}${LEGAL.abn ? ` (ABN ${LEGAL.abn})` : ''}`;
