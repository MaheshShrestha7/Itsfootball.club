// Names for email_log.kind, shown on the club Emails page and in Mission Control

export const EMAIL_KIND_LABELS: Record<string, string> = {
  availability: 'Availability reminders', event: 'Event reminders', renewal: 'Renewal reminders',
  notice_match: 'Match notices', notice_event: 'Event notices', notice_news: 'News notices', notice_renewal: 'Renewal notices',
  member_applied: 'Membership applications', member_approved: 'Members approved', member_rejected: 'Members not approved',
  inquiry_reply: 'Inbox replies', fee_request: 'Fee requests', fee_reminder: 'Fee reminders', expense_claim: 'Expense claims',
  sponsor_payment: 'Sponsor payments', sponsor_renewal: 'Sponsor renewals', sponsor_paid: 'Sponsor receipts',
  sponsor_rejected: 'Sponsors declined', sponsor_change: 'Sponsor changes', sponsor_invoice: 'Sponsor invoices', sponsor_reminder: 'Sponsor reminders',
  friendly_suggest: 'Friendly invites', friendly_confirm: 'Friendlies confirmed', friendly_update: 'Friendly updates',
  tournament_entry: 'Tournament entries', tournament_reminder: 'Tournament reminders', tournament_info: 'Tournament updates',
  tickets: 'Event tickets', receipt: 'Payment receipts', admin_summary: 'Admin morning summaries', weekly_roundup: 'Weekly round-ups', welcome_pack: 'Welcome packs', committee_agenda: 'Meeting agendas', committee_minutes: 'Meeting minutes',
  ground_suggestion: 'Ground suggestions', support_request: 'Support requests', support_reply: 'Support replies',
  support_access: 'Support access requests', feature_built: 'Feature built notes', club_invite: 'Club admin invites',
  platform_email: 'Mission Control emails', platform_admin: 'Mission Control invites', health_alert: 'Health alerts',
  sign_in: 'Sign-in links', password_reset: 'Password resets', email_changed: 'Email changed notices',
  auth_magiclink: 'Sign-in links', auth_signup: 'Sign-up confirmations', auth_recovery: 'Password resets', auth_invite: 'Account invites',
  auth_email_change: 'Email change confirmations', auth_email: 'Sign-in codes', auth_reauthentication: 'Confirmation codes',
};

export const emailKindLabel = (kind: string | null | undefined) => EMAIL_KIND_LABELS[kind || ''] || 'Other emails';

/** Mission Control's Email log filter */
export const EMAIL_KIND_GROUPS: { id: string; label: string; kinds: string[] }[] = [
  { id: 'reminders', label: 'Reminders', kinds: ['availability', 'event', 'renewal', 'fee_reminder', 'sponsor_reminder', 'admin_summary'] },
  { id: 'notices', label: 'Notices and news', kinds: ['notice_match', 'notice_event', 'notice_news', 'notice_renewal', 'weekly_roundup', 'committee_agenda', 'committee_minutes'] },
  { id: 'money', label: 'Payments, tickets and sponsors', kinds: ['fee_request', 'expense_claim', 'tickets', 'receipt', 'sponsor_payment', 'sponsor_renewal', 'sponsor_paid', 'sponsor_rejected', 'sponsor_change', 'sponsor_invoice'] },
  { id: 'members', label: 'Members, Inbox and friendlies', kinds: ['member_applied', 'member_approved', 'member_rejected', 'inquiry_reply', 'friendly_suggest', 'friendly_confirm', 'friendly_update', 'tournament_entry', 'tournament_reminder', 'tournament_info', 'ground_suggestion', 'welcome_pack'] },
  { id: 'signin', label: 'Sign-in and invites', kinds: ['sign_in', 'password_reset', 'email_changed', 'club_invite', 'platform_admin', 'auth_magiclink', 'auth_signup', 'auth_recovery', 'auth_invite', 'auth_email_change', 'auth_email', 'auth_reauthentication'] },
  { id: 'platform', label: 'Support and Mission Control', kinds: ['support_request', 'support_reply', 'support_access', 'feature_built', 'platform_email', 'health_alert'] },
];
