// Where a member's emails go. No server imports: the admin pages use it to show who a notice reaches.

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const looksLikeEmail = (email: string | null | undefined): email is string => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Member email columns that `memberRecipient` reads (guardian_* need migration 20261102) */
export const MEMBER_RECIPIENT_COLUMNS = 'full_name, email, guardian_name, guardian_email';

export interface MemberRecipient {
  to: string;
  /** Who the email greets: the member, or their parent / guardian */
  name: string;
  /** Set when the email goes to a guardian: the child it is about */
  childName?: string;
}

/**
 * Where a member's emails go: a member with a parent or guardian email on file (juniors) is
 * emailed through the guardian, never directly; everyone else at their own address. Null when
 * there is no usable address.
 */
export function memberRecipient(m: { full_name: string; email?: string | null; guardian_name?: string | null; guardian_email?: string | null }): MemberRecipient | null {
  if (looksLikeEmail(m.guardian_email)) {
    return { to: m.guardian_email.trim(), name: m.guardian_name?.trim() || '', childName: m.full_name };
  }
  return looksLikeEmail(m.email) ? { to: m.email.trim(), name: m.full_name } : null;
}
