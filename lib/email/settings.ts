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
] as const;

export type ReminderSetting = (typeof REMINDER_SETTINGS)[number]['key'];
export type EmailSettings = Partial<Record<ReminderSetting, boolean>>;

export const isReminderSetting = (key: string): key is ReminderSetting => REMINDER_SETTINGS.some(s => s.key === key);

/** Keeps only known switches with boolean values */
export function cleanSettings(raw: unknown): EmailSettings {
  const out: EmailSettings = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (isReminderSetting(k) && typeof v === 'boolean') out[k] = v;
  }
  return out;
}
