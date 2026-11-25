// Per-club switches for the automatic reminder emails (clubs.email_settings). Shared by the daily
// job and the admin page. A missing key means off: clubs opt in.

export const REMINDER_SETTINGS = [
  {
    key: 'availability_reminders',
    label: 'Match availability reminders',
    description: 'Emails players who haven\'t said if they can play, 48 hours before each match.',
  },
  {
    key: 'event_reminders',
    label: 'Event reminders',
    description: 'Reminds people registered for an event, the day before it starts.',
  },
  {
    key: 'renewal_reminders',
    label: 'Membership renewal reminders',
    description: 'Emails members 14 days before their membership expires, and once after it lapses. Needs a paid membership plan.',
  },
  {
    key: 'sponsor_renewal_reminders',
    label: 'Sponsor renewal reminders',
    description: 'Emails sponsors 30 days before their sponsorship ends, and once in the week after it ends, with a link to renew. Needs a priced sponsorship package.',
  },
  {
    key: 'admin_summary',
    label: 'Morning summary for admins',
    description: 'Emails each admin what\'s waiting for them: Inbox messages, applications, claims, receipts to check, results to enter, a new season to start. Only on mornings when something new is waiting, and only for the parts of the club they look after.',
  },
  {
    key: 'fee_reminders',
    label: 'Fee request reminders',
    description: 'Emails anyone who still owes on a fee request 3 days before it\'s due, 3 days after, then a week later. Three reminders at most, and they stop as soon as they pay.',
  },
  {
    key: 'weekly_roundup',
    label: 'Weekly round-up',
    description: 'One email to members with the coming week\'s games and events, last week\'s results and new news. Skipped on weeks with nothing on.',
  },
] as const;

export type ReminderSetting = (typeof REMINDER_SETTINGS)[number]['key'];
export type EmailSettings = Partial<Record<ReminderSetting, boolean>> & {
  /** The weekly round-up's day in the club's time zone: 1 Monday ... 5 Friday */
  weekly_roundup_day?: number;
};

export const ROUNDUP_DAYS = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
] as const;
export const DEFAULT_ROUNDUP_DAY = 4;

export const isReminderSetting = (key: string): key is ReminderSetting => REMINDER_SETTINGS.some(s => s.key === key);

/** Keeps only known switches with boolean values */
export function cleanSettings(raw: unknown): EmailSettings {
  const out: EmailSettings = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (isReminderSetting(k) && typeof v === 'boolean') out[k] = v;
    const day = (raw as { weekly_roundup_day?: unknown }).weekly_roundup_day;
    if (typeof day === 'number' && ROUNDUP_DAYS.some(d => d.value === day)) out.weekly_roundup_day = day;
  }
  return out;
}
