// Dates in emails. Clubs don't store a time zone yet, so one zone serves all (EMAIL_TIMEZONE).
const TIME_ZONE = process.env.EMAIL_TIMEZONE || 'Australia/Sydney';

/** "Sun 4 Oct, 10:00 am" */
export const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** "15 October 2026", for a date-only value (YYYY-MM-DD) */
export const formatDay = (date: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));

/** Today's date (YYYY-MM-DD) in the email time zone, shifted by `offsetDays` */
export const localDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(Date.now() + offsetDays * 86400000));
