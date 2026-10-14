/**
 * Dates and times read the same way everywhere on the site: Australian English, e.g. "Sat 18 Oct
 * 2026" and "3:00 pm". Pass it to toLocaleDateString / toLocaleTimeString / Intl.DateTimeFormat
 * instead of 'en-US', 'en-GB' or the browser's own default.
 */
export const DATE_LOCALE = 'en-AU';
