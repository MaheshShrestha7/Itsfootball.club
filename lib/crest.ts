// Neutral shield placeholder used when a team has no uploaded crest.
export const DEFAULT_CREST =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 6 12 20v28c0 24 16 40 38 46 22-6 38-22 38-46V20L50 6Z" fill="#1E293B" stroke="#64748B" stroke-width="4"/></svg>'
  );

// Neutral pitch-toned banner placeholder used when a club has no uploaded banner
// (or its banner_url is empty/broken) - an inline SVG so it never itself fails to load.
export const DEFAULT_BANNER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice">' +
    '<defs>' +
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#132018"/>' +
    '<stop offset="100%" stop-color="#0B1119"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<rect width="800" height="300" fill="url(#bg)"/>' +
    '<g stroke="#1F2E24" stroke-width="2" fill="none">' +
    '<rect x="40" y="40" width="720" height="220"/>' +
    '<line x1="400" y1="40" x2="400" y2="260"/>' +
    '<circle cx="400" cy="150" r="45"/>' +
    '</g>' +
    '<path d="M400 108 372 128l11 34h34l11-34Z" fill="#1E293B" stroke="#64748B" stroke-width="4"/>' +
    '</svg>'
  );
