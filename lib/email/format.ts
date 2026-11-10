// Dates in emails. A club can pick its own time zone (clubTimeZone in lib/dates.ts): pass it as
// `timeZone`. TIME_ZONE (EMAIL_TIMEZONE) is for anything not tied to one club.
export const TIME_ZONE = process.env.EMAIL_TIMEZONE || 'Australia/Sydney';

/** "Sun 4 Oct, 10:00 am" */
export const formatWhen = (iso: string, timeZone: string = TIME_ZONE) =>
  new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** "15 October 2026", for a date-only value (YYYY-MM-DD) */
export const formatDay = (date: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));

/** Today's date (YYYY-MM-DD) in the email time zone, shifted by `offsetDays` */
export const localDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(Date.now() + offsetDays * 86400000));

/**
 * A match's kick-off: "Sat 17 Oct, 3:00 pm". Cup fixtures store the day alone (midnight UTC) with
 * the club's local kick-off time in match_time, so that time is shown as it is, not converted.
 */
export function formatMatchWhen(matchDate: string, matchTime?: string | null, timeZone: string = TIME_ZONE): string {
  const d = new Date(matchDate);
  if (isNaN(d.getTime())) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return formatWhen(matchDate, timeZone);
  const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  const time = matchTime?.match(/^(\d{1,2}):(\d{2})/);
  if (!time) return day;
  const hours = Number(time[1]);
  return `${day}, ${hours % 12 || 12}:${time[2]} ${hours < 12 ? 'am' : 'pm'}`;
}
