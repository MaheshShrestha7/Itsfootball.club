// Email templates. One layout (table-based, inline styles: what Gmail, Outlook and Apple Mail
// all render the same) plus a builder per email. Every value is escaped; builders pass plain text.
import { SITE_URL } from '@/lib/seo';
import { evaluateColorContrast } from '@/lib/theme-utils';

/** Who the email is from: a club, or the platform itself when omitted */
export interface EmailBrand {
  name: string;
  logoUrl?: string | null;
  /** Hex colour for the button and accent bar */
  color?: string | null;
  url: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface EmailContent {
  subject: string;
  brand?: EmailBrand;
  /** Inbox preview line */
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  details?: [label: string, value: string][];
  /** A row of smaller links under the button, e.g. "Add to calendar · Directions" (https only) */
  links?: { label: string; url: string }[];
  /** Small print under the button, e.g. "This link expires in 1 hour" */
  note?: string;
  /** Why the recipient got this email */
  reason: string;
  /** Optional personal message from the club, shown as a quote under the intro */
  message?: string | null;
  /** Optional wide image (https only), e.g. a news article's cover */
  image?: string | null;
  /** Footer unsubscribe link (club emails other than sign-in) */
  unsubscribeUrl?: string | null;
  /** Sponsor logos (or names) at the bottom of the card, under a small heading */
  sponsors?: { heading: string; list: { name: string; logoUrl?: string | null; url?: string | null }[] };
}

const PLATFORM: EmailBrand = { name: 'itsfootball.club', logoUrl: `${SITE_URL}/logo-96.png`, color: '#047857', url: SITE_URL };

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const absolute = (url?: string | null) => (!url ? null : /^https:\/\//.test(url) ? url : url.startsWith('/') ? SITE_URL + url : null);
const hex = (c?: string | null) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : null);

export function renderEmail(c: EmailContent): RenderedEmail {
  const brand = c.brand || PLATFORM;
  const color = hex(brand.color) || PLATFORM.color!;
  const onColor = evaluateColorContrast(color).bestTextColor;
  const logo = absolute(brand.logoUrl);
  const isClub = !!c.brand;
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const details = c.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:separate;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px">
${c.details.map(([k, v], i) => `<tr><td style="padding:10px 16px;${i ? 'border-top:1px solid #E2E8F0;' : ''}font:600 13px ${font};color:#64748B;width:34%;vertical-align:top">${esc(k)}</td><td style="padding:10px 16px;${i ? 'border-top:1px solid #E2E8F0;' : ''}font:600 14px ${font};color:#0F172A">${esc(v)}</td></tr>`).join('\n')}
</table>`
    : '';

  const cta = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${color}">
<a href="${esc(c.cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font:700 16px ${font};color:${onColor};text-decoration:none;border-radius:10px">${esc(c.cta.label)}</a>
</td></tr></table>
<p style="margin:0 0 24px;font:13px/1.5 ${font};color:#64748B">Button not working? Copy this link into your browser:<br><a href="${esc(c.cta.url)}" style="color:#334155;word-break:break-all">${esc(c.cta.url)}</a></p>`
    : '';

  const links = (c.links || []).filter(l => /^https:\/\//.test(l.url));
  const linkRow = links.length
    ? `<p style="margin:0 0 24px;font:14px/1.9 ${font};color:#334155">${links.map(l => `<a href="${esc(l.url)}" target="_blank" style="color:#334155;font-weight:700">${esc(l.label)}</a>`).join(' &nbsp;&middot;&nbsp; ')}</p>`
    : '';

  const message = c.message?.trim()
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="border-left:4px solid ${color};background:#F8FAFC;border-radius:0 10px 10px 0;padding:14px 18px">
<p style="margin:0 0 6px;font:700 12px ${font};color:#64748B;text-transform:uppercase;letter-spacing:0.06em">Message from ${esc(brand.name)}</p>
${c.message.trim().split(/\n{2,}/).map(p => `<p style="margin:0 0 8px;font:15px/1.6 ${font};color:#0F172A">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
</td></tr></table>`
    : '';
  const image = absolute(c.image);

  const sponsorCell = (sp: { name: string; logoUrl?: string | null; url?: string | null }) => {
    const src = absolute(sp.logoUrl);
    const inner = src
      ? `<img src="${esc(src)}" height="40" alt="${esc(sp.name)}" style="display:block;height:40px;max-width:120px;width:auto;margin:0 auto">`
      : `<span style="font:800 13px ${font};color:#0F172A">${esc(sp.name)}</span>`;
    const href = sp.url && /^https?:\/\//.test(sp.url) ? sp.url : null;
    return `<td style="padding:4px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="height:52px;min-width:96px;padding:6px 12px;border:1px solid #E2E8F0;border-radius:8px;background:#FFFFFF">${href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none">${inner}</a>` : inner}</td></tr></table></td>`;
  };
  const sponsors = c.sponsors?.list.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-top:1px solid #E2E8F0"><tr><td align="center" style="padding-top:16px">
<p style="margin:0 0 10px;font:800 11px ${font};color:#64748B;text-transform:uppercase;letter-spacing:0.16em">${esc(c.sponsors.heading)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${c.sponsors.list.map(sponsorCell).join('')}</tr></table>
</td></tr></table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F5F9">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    ${logo ? `<td style="padding-right:12px;vertical-align:middle"><img src="${esc(logo)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:10px;object-fit:cover"></td>` : ''}
    <td style="vertical-align:middle;font:800 18px ${font};color:#0F172A">${esc(brand.name)}</td>
  </tr></table>
</td></tr>
<tr><td style="background:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;border-top:4px solid ${color};padding:32px 32px 8px">
  ${image ? `<img src="${esc(image)}" width="496" alt="" style="display:block;width:100%;max-width:496px;height:auto;border-radius:10px;margin:0 0 20px">` : ''}
  <h1 style="margin:0 0 16px;font:800 24px/1.25 ${font};color:#0F172A">${esc(c.heading)}</h1>
  ${c.paragraphs.map(p => `<p style="margin:0 0 16px;font:16px/1.6 ${font};color:#334155">${esc(p)}</p>`).join('\n  ')}
  ${message}
  ${details}
  ${cta}
  ${linkRow}
  ${c.note ? `<p style="margin:0 0 24px;font:13px/1.5 ${font};color:#64748B">${esc(c.note)}</p>` : ''}
  ${sponsors}
</td></tr>
<tr><td style="padding:20px 8px;font:12px/1.6 ${font};color:#64748B;text-align:center">
  ${esc(c.reason)}<br>
  ${c.unsubscribeUrl ? `<a href="${esc(c.unsubscribeUrl)}" style="color:#475569">Unsubscribe from ${esc(brand.name)} emails</a><br>` : ''}
  ${isClub ? `Sent by <a href="${esc(brand.url)}" style="color:#475569">${esc(brand.name)}</a> via <a href="${SITE_URL}" style="color:#475569">itsfootball.club</a>` : `<a href="${SITE_URL}" style="color:#475569">itsfootball.club</a> &middot; Home of football clubs`}
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    brand.name,
    '',
    c.heading,
    '',
    ...c.paragraphs.flatMap(p => [p, '']),
    ...(c.message?.trim() ? [`Message from ${brand.name}:`, c.message.trim(), ''] : []),
    ...(c.details?.length ? [...c.details.map(([k, v]) => `${k}: ${v}`), ''] : []),
    ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`, ''] : []),
    ...(links.length ? [...links.map(l => `${l.label}: ${l.url}`), ''] : []),
    ...(c.note ? [c.note, ''] : []),
    ...(c.sponsors?.list.length ? [`${c.sponsors.heading}: ${c.sponsors.list.map(sp => sp.name).join(', ')}`, ''] : []),
    '--',
    c.reason,
    ...(c.unsubscribeUrl ? [`Unsubscribe: ${c.unsubscribeUrl}`] : []),
    isClub ? `Sent by ${brand.name} via itsfootball.club` : 'itsfootball.club',
  ].join('\n');

  return { subject: c.subject, html, text };
}

// ---------------------------------------------------------------------------------------------
// Auth emails (sent from the Supabase send-email hook)
// ---------------------------------------------------------------------------------------------

export type AuthAction = 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change' | 'email' | 'reauthentication';

export interface AuthHookData {
  token: string;
  token_hash: string;
  token_new?: string;
  token_hash_new?: string;
  email_action_type: AuthAction;
}

export interface AuthRecipient {
  to: string;
  token: string;
  tokenHash: string;
  /** email_change only: this copy goes to the current address and names the new one */
  changeTo?: string;
}

/**
 * Who the hook emails, with which token. Every action goes to the account's email, except
 * email_change: its token/token_hash confirm the NEW address, and token_new/token_hash_new
 * (only sent when "Secure email change" is on) confirm from the CURRENT one. Supabase keeps
 * those names swapped for backward compatibility.
 */
export function authRecipients(user: { email?: string; new_email?: string }, data: AuthHookData): AuthRecipient[] {
  if (data.email_action_type !== 'email_change') {
    return user.email ? [{ to: user.email, token: data.token, tokenHash: data.token_hash }] : [];
  }
  const out: AuthRecipient[] = [];
  if (user.new_email && data.token_hash) {
    out.push({ to: user.new_email, token: data.token, tokenHash: data.token_hash });
  }
  if (user.email && data.token_hash_new) {
    out.push({ to: user.email, token: data.token_new || '', tokenHash: data.token_hash_new, changeTo: user.new_email });
  }
  return out;
}

export function authEmail(action: AuthAction, link: string, token: string, brand?: EmailBrand, changeTo?: string): RenderedEmail {
  const where = brand ? brand.name : 'itsfootball.club';
  const reason = `You're receiving this because someone entered this email address on ${where}. If that wasn't you, you can ignore this email.`;
  switch (action) {
    case 'signup':
      return renderEmail({
        brand, reason,
        subject: `Confirm your email for ${where}`,
        preheader: 'One click to confirm your email and finish setting up your account.',
        heading: 'Confirm your email',
        paragraphs: ['Thanks for signing up. Confirm this is your email address to finish creating your account.'],
        cta: { label: 'Confirm email', url: link },
        note: 'This link works once and expires in 24 hours.',
      });
    case 'magiclink':
    case 'email':
      return renderEmail({
        brand, reason,
        subject: `Your sign-in link for ${where}`,
        preheader: 'Tap the button to sign in. No password needed.',
        heading: brand ? `Sign in to ${brand.name}` : 'Sign in to itsfootball.club',
        paragraphs: ['Tap the button below to sign in. No password needed.'],
        cta: { label: 'Sign in', url: link },
        note: 'This link works once and expires in 1 hour. Only use it on your own device.',
      });
    case 'recovery':
      return renderEmail({
        brand, reason,
        subject: `Reset your ${where} password`,
        preheader: 'Choose a new password for your account.',
        heading: 'Reset your password',
        paragraphs: ['We received a request to reset your password. Use the button below to choose a new one.'],
        cta: { label: 'Choose a new password', url: link },
        note: 'This link works once and expires in 1 hour.',
      });
    case 'invite':
      return renderEmail({
        brand, reason,
        subject: `You're invited to ${where}`,
        preheader: 'Accept your invitation to get started.',
        heading: `You're invited to ${where}`,
        paragraphs: ['You have been invited to join. Accept the invitation to set up your account.'],
        cta: { label: 'Accept invitation', url: link },
      });
    case 'email_change':
      if (changeTo) {
        return renderEmail({
          brand, reason,
          subject: `Confirm your email change on ${where}`,
          preheader: `Confirm changing your account email to ${changeTo}.`,
          heading: 'Confirm your email change',
          paragraphs: [
            `Someone asked to change the email on your account to ${changeTo}. Confirm here to go ahead.`,
            'If that wasn\'t you, don\'t confirm, and change your password.',
          ],
          cta: { label: 'Confirm email change', url: link },
        });
      }
      return renderEmail({
        brand, reason,
        subject: `Confirm your new email for ${where}`,
        preheader: 'Confirm the change to your account email.',
        heading: 'Confirm your new email',
        paragraphs: ['Confirm this change to the email address on your account.'],
        cta: { label: 'Confirm email change', url: link },
      });
    case 'reauthentication':
      return renderEmail({
        brand, reason,
        subject: `Your ${where} verification code`,
        preheader: `Your verification code is ${token}`,
        heading: 'Your verification code',
        paragraphs: ['Enter this code to confirm it\'s you:'],
        details: [['Code', token]],
        note: 'The code expires in 1 hour.',
      });
  }
}

// ---------------------------------------------------------------------------------------------
// Reminders (sent by /api/cron/reminders)
// ---------------------------------------------------------------------------------------------

const firstName = (full: string) => full.trim().split(/\s+/)[0] || 'there';

/** Emails about a junior go to their parent or guardian (memberRecipient): `childName` is the junior */
interface ForGuardian {
  childName?: string;
}

/** Shared by every club email other than sign-in */
interface ClubEmailExtras {
  unsubscribeUrl?: string | null;
  /** Personal note from an admin (manual notices) */
  message?: string | null;
}

export function availabilityReminder(p: ClubEmailExtras & ForGuardian & { brand: EmailBrand; memberName: string; fixture: string; competition?: string | null; when: string; venue: string; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: p.childName ? `Is ${firstName(p.childName)} available? ${p.fixture}` : `Are you available? ${p.fixture}`,
    preheader: `${p.brand.name} needs your answer for ${p.when}.`,
    heading: p.childName ? `Can ${firstName(p.childName)} play?` : 'Can you play?',
    paragraphs: [p.childName
      ? `Hi ${firstName(p.memberName)}, ${p.brand.name} is picking the squad and hasn't heard back about ${p.childName}. Let the coaches know if they're in, out or maybe.`
      : `Hi ${firstName(p.memberName)}, ${p.brand.name} is picking the squad and hasn't heard from you yet. Let the coaches know if you're in, out or maybe.`],
    details: [['Match', p.fixture], ...(p.competition ? [['Competition', p.competition] as [string, string]] : []), ['When', p.when], ['Where', p.venue]],
    cta: { label: p.childName ? `Reply for ${firstName(p.childName)}` : 'Reply with my availability', url: p.link },
    note: 'It takes one tap. This link is personal to you, so please don\'t forward it.',
    reason: p.childName
      ? `You're receiving this because you're the parent or guardian of ${p.childName} in the ${p.brand.name} squad.`
      : `You're receiving this because you're in the ${p.brand.name} squad.`,
  });
}

export function eventReminder(p: ClubEmailExtras & { brand: EmailBrand; attendeeName: string; event: string; when: string; venue: string; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: `Reminder: ${p.event} is coming up`,
    preheader: `${p.event}, ${p.when} at ${p.venue}.`,
    heading: `See you at ${p.event}`,
    paragraphs: [`Hi ${firstName(p.attendeeName)}, just a reminder that you're registered for this ${p.brand.name} event.`],
    details: [['Event', p.event], ['When', p.when], ['Where', p.venue]],
    cta: { label: 'View event details', url: p.link },
    note: 'Bring your member pass or ticket QR code for a quick check-in at the door.',
    reason: `You're receiving this because you registered for this event with ${p.brand.name}.`,
  });
}

/** Sent once a ticket order is paid: transactional, so no unsubscribe link */
export function ticketsEmail(p: { brand: EmailBrand; buyerName: string; event: string; quantity: number; when: string; venue: string; link: string; sponsors?: { name: string; logoUrl?: string | null; url?: string | null }[] }): RenderedEmail {
  const tickets = `${p.quantity} ticket${p.quantity === 1 ? '' : 's'}`;
  return renderEmail({
    brand: p.brand,
    subject: `Your tickets: ${p.event}`,
    preheader: `${tickets} for ${p.event}, ${p.when}.`,
    heading: 'You’re going!',
    paragraphs: [`Hi ${firstName(p.buyerName)}, thanks for your order. Your ${tickets} for ${p.event} ${p.quantity === 1 ? 'is' : 'are'} ready.`],
    details: [['Event', p.event], ['When', p.when], ['Where', p.venue], ['Tickets', String(p.quantity)]],
    cta: { label: 'Show my tickets', url: p.link },
    note: 'Each ticket has its own QR code and can be scanned once at the door. Anyone with this link can use your tickets, so keep it to yourself.',
    reason: `You're receiving this because you bought tickets from ${p.brand.name}.`,
    // Sponsors whose package includes event tickets (Admin, Sponsors, Packages)
    sponsors: p.sponsors?.length ? { heading: 'This event is supported by', list: p.sponsors } : undefined,
  });
}

export function renewalReminder(p: ClubEmailExtras & ForGuardian & { brand: EmailBrand; memberName: string; tier: string; expires: string; expired: boolean; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: p.childName
      ? (p.expired ? `${p.childName}'s ${p.brand.name} membership has expired` : `${p.childName}'s ${p.brand.name} membership expires on ${p.expires}`)
      : (p.expired ? `Your ${p.brand.name} membership has expired` : `Your ${p.brand.name} membership expires on ${p.expires}`),
    preheader: p.expired ? 'Renew now to keep the member pass active.' : 'Renew early and keep the remaining days.',
    heading: p.expired ? (p.childName ? 'Membership expired' : 'Your membership has expired') : 'Time to renew your membership',
    paragraphs: [
      p.childName
        ? (p.expired
          ? `Hi ${firstName(p.memberName)}, ${p.childName}'s ${p.brand.name} membership ended on ${p.expires}. Renew now to reactivate their member pass.`
          : `Hi ${firstName(p.memberName)}, ${p.childName}'s ${p.brand.name} membership expires on ${p.expires}. Renewing early keeps their remaining days.`)
        : (p.expired
          ? `Hi ${firstName(p.memberName)}, your ${p.brand.name} membership ended on ${p.expires}. Renew now to reactivate your member pass.`
          : `Hi ${firstName(p.memberName)}, your ${p.brand.name} membership expires on ${p.expires}. Renewing early keeps your remaining days.`),
    ],
    details: [...(p.childName ? [['Member', p.childName] as [string, string]] : []), ['Membership', p.tier], [p.expired ? 'Expired' : 'Expires', p.expires]],
    cta: { label: p.childName ? `Renew for ${firstName(p.childName)}` : 'Renew my membership', url: p.link },
    reason: p.childName
      ? `You're receiving this because you're the parent or guardian of ${p.childName}, a member of ${p.brand.name}.`
      : `You're receiving this because you're a member of ${p.brand.name}.`,
  });
}

/** A bill from the club (a fee request), or a nudge about one that's still unpaid */
export function feeRequest(p: ClubEmailExtras & ForGuardian & { brand: EmailBrand; memberName: string; title: string; price: string; dueOn: string; overdue: boolean; reminder: boolean; link: string }): RenderedEmail {
  const who = p.childName ? `${firstName(p.childName)}'s` : 'your';
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: p.reminder ? `Reminder: ${p.title}, ${p.price} ${p.overdue ? `was due ${p.dueOn}` : `due ${p.dueOn}`}` : `${p.title}: ${p.price} due ${p.dueOn}`,
    preheader: p.reminder ? `${p.brand.name} hasn't received this yet.` : `Pay ${p.brand.name} online in a minute.`,
    heading: p.reminder ? `A reminder about ${p.title}` : p.title,
    paragraphs: [
      p.reminder
        ? `Hi ${firstName(p.memberName)}, ${p.brand.name} hasn't received ${who} payment for ${p.title} yet.`
        : `Hi ${firstName(p.memberName)}, ${p.brand.name} is asking for ${who} payment for ${p.title}.`,
    ],
    details: [...(p.childName ? [['For', p.childName] as [string, string]] : []), ['Amount', p.price], [p.overdue ? 'Was due' : 'Due', p.dueOn]],
    cta: { label: `Pay ${p.price}`, url: p.link },
    note: 'Already paid? You can ignore this. Bank transfers show as paid once the club has checked them.',
    reason: p.childName
      ? `You're receiving this because you're the parent or guardian of ${p.childName} at ${p.brand.name}.`
      : `You're receiving this because you're a member of ${p.brand.name}.`,
  });
}

/** What happened to a member's expense claim */
export function expenseClaimUpdate(p: { brand: EmailBrand; memberName: string; description: string; price: string; outcome: 'approved' | 'rejected' | 'paid'; reason?: string | null; link: string }): RenderedEmail {
  const words = {
    approved: { subject: 'approved', heading: 'Your expense claim is approved', line: 'The club will pay you back soon.' },
    rejected: { subject: 'not approved', heading: 'Your expense claim wasn\'t approved', line: 'Reply to the club if you have a question, or send it again with what they asked for.' },
    paid: { subject: 'paid', heading: 'Your expense claim has been paid', line: 'The club has marked this as paid back to you.' },
  }[p.outcome];
  return renderEmail({
    brand: p.brand,
    subject: `Expense claim ${words.subject}: ${p.description}`,
    preheader: words.line,
    heading: words.heading,
    paragraphs: [`Hi ${firstName(p.memberName)}, here's the latest on your claim to ${p.brand.name}. ${words.line}`],
    details: [['Claim', p.description], ['Amount', p.price], ...(p.reason ? [['Reason', p.reason] as [string, string]] : [])],
    cta: { label: 'See my claims', url: p.link },
    reason: `You're receiving this because you sent ${p.brand.name} an expense claim.`,
  });
}

// ---------------------------------------------------------------------------------------------
// Admin notices (sent from the Email notifications admin page)
// ---------------------------------------------------------------------------------------------

export function matchNotice(p: ClubEmailExtras & { brand: EmailBrand; recipientName: string; fixture: string; competition?: string | null; when: string; venue: string; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: `Match: ${p.fixture} · ${p.when}`,
    preheader: `${p.fixture} at ${p.venue}, ${p.when}.`,
    heading: p.fixture,
    paragraphs: [`Hi ${firstName(p.recipientName)}, here are the details for the next ${p.brand.name} match. Follow it live on the day from the match page.`],
    details: [['Match', p.fixture], ...(p.competition ? [['Competition', p.competition] as [string, string]] : []), ['When', p.when], ['Where', p.venue]],
    cta: { label: 'Open match centre', url: p.link },
    reason: `You're receiving this because you're a member of ${p.brand.name}.`,
  });
}

export function eventNotice(p: ClubEmailExtras & { brand: EmailBrand; recipientName: string; event: string; description?: string | null; when: string; venue: string; link: string }): RenderedEmail {
  const blurb = p.description?.trim().replace(/\s+/g, ' ');
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: `${p.event} · ${p.when}`,
    preheader: `${p.brand.name} event at ${p.venue}, ${p.when}.`,
    heading: p.event,
    paragraphs: [
      `Hi ${firstName(p.recipientName)}, ${p.brand.name} has an event coming up and we'd love to see you there.`,
      ...(blurb ? [blurb.length > 400 ? blurb.slice(0, 397) + '...' : blurb] : []),
    ],
    details: [['Event', p.event], ['When', p.when], ['Where', p.venue]],
    cta: { label: 'View event and register', url: p.link },
    reason: `You're receiving this because you're a member of ${p.brand.name}.`,
  });
}

export function newsNotice(p: ClubEmailExtras & { brand: EmailBrand; recipientName: string; title: string; summary?: string | null; image?: string | null; link: string }): RenderedEmail {
  const summary = p.summary?.trim().replace(/\s+/g, ' ');
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message, image: p.image,
    subject: `${p.brand.name}: ${p.title}`,
    preheader: summary?.slice(0, 120) || `New from ${p.brand.name}`,
    heading: p.title,
    paragraphs: [summary || `Hi ${firstName(p.recipientName)}, there's news from ${p.brand.name}.`],
    cta: { label: 'Read on the club site', url: p.link },
    reason: `You're receiving this because you're a member of ${p.brand.name}.`,
  });
}

// ---------------------------------------------------------------------------------------------
// Membership applications (sent from /api/members/application-email). Transactional: they answer
// something the applicant did, so no unsubscribe link.
// ---------------------------------------------------------------------------------------------

export function applicationReceived(p: ForGuardian & { brand: EmailBrand; memberName: string; tier: string; link: string; payable: boolean }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    subject: `We've received your ${p.brand.name} membership application`,
    preheader: 'The committee will review it and email you the outcome.',
    heading: 'Application received',
    paragraphs: [
      p.childName
        ? `Hi ${firstName(p.memberName)}, thanks for applying for ${p.childName} to join ${p.brand.name}. The committee will review the application and we'll email you as soon as there's a decision.`
        : `Hi ${firstName(p.memberName)}, thanks for applying to join ${p.brand.name}. The committee will review your application and we'll email you as soon as there's a decision.`,
      p.payable
        ? `If you haven't paid the membership fee yet, you can do it any time from the member page: sign in with this email address to see ${p.childName ? 'the' : 'your'} application.`
        : `You can check where it stands any time on the member page: sign in with this email address to see ${p.childName ? 'the' : 'your'} application.`,
    ],
    details: [...(p.childName ? [['Member', p.childName] as [string, string]] : []), ['Membership', p.tier], ['Status', 'Waiting for committee review']],
    cta: { label: 'View my application', url: p.link },
    reason: p.childName ? `You're receiving this because you applied for ${p.childName} to join ${p.brand.name}.` : `You're receiving this because you applied for membership of ${p.brand.name}.`,
  });
}

export function applicationApproved(p: ForGuardian & { brand: EmailBrand; memberName: string; tier: string; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    subject: `Welcome to ${p.brand.name}! Your membership is approved`,
    preheader: 'Your digital member pass is ready.',
    heading: `Welcome to ${p.brand.name}!`,
    paragraphs: [
      p.childName
        ? `Hi ${firstName(p.memberName)}, great news: the committee has approved ${p.childName}'s membership. Their digital member pass is now active.`
        : `Hi ${firstName(p.memberName)}, great news: the committee has approved your membership. Your digital member pass is now active.`,
      p.childName
        ? 'Open the member page and sign in with this email address to see their pass, pay fees and message the club. We\'ll email you a one-time sign-in link, no password needed.'
        : 'Open the member page and sign in with this email address. We\'ll email you a one-time sign-in link, no password needed.',
    ],
    details: [...(p.childName ? [['Member', p.childName] as [string, string]] : []), ['Membership', p.tier], ['Status', 'Approved']],
    cta: { label: 'Open my member pass', url: p.link },
    reason: p.childName ? `You're receiving this because you applied for ${p.childName} to join ${p.brand.name}.` : `You're receiving this because you applied for membership of ${p.brand.name}.`,
  });
}

export function applicationRejected(p: ForGuardian & { brand: EmailBrand; memberName: string; tier: string; reason?: string | null; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    message: p.reason,
    subject: `Your ${p.brand.name} membership application`,
    preheader: 'An update on your membership application.',
    heading: 'About your application',
    paragraphs: [
      p.childName
        ? `Hi ${firstName(p.memberName)}, thank you for applying for ${p.childName} to join ${p.brand.name}. Unfortunately the committee wasn't able to approve the application this time.`
        : `Hi ${firstName(p.memberName)}, thank you for applying to join ${p.brand.name}. Unfortunately the committee wasn't able to approve your application this time.`,
      p.childName
        ? 'Sign in on the member page with this email address to see the application or message the club about it.'
        : 'If your circumstances change, you can apply again from the member page: sign in with this email address.',
    ],
    details: [...(p.childName ? [['Member', p.childName] as [string, string]] : []), ['Membership', p.tier], ['Status', 'Not approved']],
    cta: { label: 'View my application', url: p.link },
    reason: p.childName ? `You're receiving this because you applied for ${p.childName} to join ${p.brand.name}.` : `You're receiving this because you applied for membership of ${p.brand.name}.`,
  });
}

/** A club's reply to a contact-form enquiry, sent from the Inbox */
export function inquiryReply(p: { brand: EmailBrand; senderName: string; reply: string; inquiryType: string; original: string; canReply: boolean }): RenderedEmail {
  const original = p.original.length > 300 ? `${p.original.slice(0, 300).trim()}...` : p.original;
  return renderEmail({
    brand: p.brand,
    subject: `Re: your message to ${p.brand.name}`,
    preheader: p.reply.slice(0, 120),
    heading: `${p.brand.name} replied to your message`,
    paragraphs: [
      `Hi ${firstName(p.senderName)}, thanks for getting in touch. Here's the club's reply.`,
      ...(p.canReply ? ['To write back, just reply to this email.'] : []),
    ],
    message: p.reply,
    details: [['You asked about', p.inquiryType], ['Your message', original]],
    reason: `You're receiving this because you sent a message to ${p.brand.name} through its website.`,
  });
}

// ---------------------------------------------------------------------------------------------
// Friendly invitations (lib/friendlies.ts): emails to the person who invited one of our teams
// ---------------------------------------------------------------------------------------------

const friendlyReason = (club: string) => `You're receiving this because you invited ${club} to a friendly through its website.`;

/** The club suggests other dates; the button opens a private page where they pick one */
export function friendlySuggest(p: { brand: EmailBrand; senderName: string; teamName: string; message: string; dates: string[]; link: string; canReply: boolean }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    subject: `${p.brand.name}: other dates for your friendly`,
    preheader: `Would ${p.dates.join(' or ')} suit?`,
    heading: p.dates.length > 1 ? 'Would one of these dates suit?' : 'Would this date suit?',
    paragraphs: [`Hi ${firstName(p.senderName)}, thanks for inviting ${p.teamName} to a friendly. The dates you offered don't quite work, so here's what does.`],
    message: p.message,
    details: p.dates.map((d, i) => [p.dates.length > 1 ? `Option ${i + 1}` : 'Date', d]),
    cta: { label: p.dates.length > 1 ? 'Pick a date' : 'Accept this date', url: p.link },
    note: p.canReply
      ? 'This link is just for you. If none of these work, reply to this email.'
      : 'This link is just for you.',
    reason: friendlyReason(p.brand.name),
  });
}

export interface FriendlyFacts {
  /** "Leppington Rovers Reserves v First Team", home side first */
  title: string;
  /** "Sat 21 Nov, kick-off 3:00 pm" */
  when: string;
  where: string;
  /** "11-a-side, 2 × 45 min" */
  game: string;
  contact?: string | null;
}

const factRows = (f: FriendlyFacts): [string, string][] => [
  ['When', f.when], ['Where', f.where], ['Game', f.game],
  ...(f.contact ? [['Our contact', f.contact] as [string, string]] : []),
];

/** The game is on: the match page, add to calendar, directions and the ground guide in one email */
export function friendlyConfirm(p: { brand: EmailBrand; senderName: string; facts: FriendlyFacts; matchUrl: string; links: { label: string; url: string }[]; message?: string | null; canReply: boolean }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    subject: `It's on: ${p.facts.title}`,
    preheader: `${p.facts.when}. ${p.facts.where}.`,
    heading: `It's on: ${p.facts.title}`,
    paragraphs: [
      `Hi ${firstName(p.senderName)}, thanks for the invite. We'd love to play. Here's everything in one place.`,
      ...(p.canReply ? ['Any questions? Just reply to this email.'] : []),
    ],
    message: p.message,
    details: factRows(p.facts),
    cta: { label: 'See the match page', url: p.matchUrl },
    links: p.links,
    note: "If the date changes or the game is called off, we'll email you here.",
    reason: friendlyReason(p.brand.name),
  });
}

export type FriendlyChange = 'changed' | 'postponed' | 'cancelled';

/** The date, time or ground changed, or the game was postponed or called off */
export function friendlyUpdate(p: { brand: EmailBrand; senderName: string; change: FriendlyChange; facts: FriendlyFacts; was?: string | null; matchUrl: string; links: { label: string; url: string }[]; canReply: boolean }): RenderedEmail {
  const hi = `Hi ${firstName(p.senderName)},`;
  const head = p.change === 'cancelled' ? `Called off: ${p.facts.title}` : p.change === 'postponed' ? `Postponed: ${p.facts.title}` : `Change to our friendly: ${p.facts.title}`;
  const intro = p.change === 'cancelled'
    ? `${hi} sorry, we've had to call off our friendly.`
    : p.change === 'postponed'
      ? `${hi} we've had to postpone our friendly. We'll be in touch about a new date.`
      : `${hi} the details of our friendly have changed. Here's what it is now.`;
  return renderEmail({
    brand: p.brand,
    subject: head,
    preheader: p.change === 'changed' ? `Now ${p.facts.when}. ${p.facts.where}.` : intro.replace(hi, '').trim(),
    heading: head,
    paragraphs: [intro, ...(p.canReply ? ['Any questions? Just reply to this email.'] : [])],
    details: [...factRows(p.facts), ...(p.was ? [['Was', p.was] as [string, string]] : [])],
    ...(p.change === 'cancelled' ? {} : { cta: { label: 'See the match page', url: p.matchUrl }, links: p.links }),
    reason: friendlyReason(p.brand.name),
  });
}

// ---------------------------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------------------------

/** A payment link for a sponsor who signed up but hasn't paid, or a renewal link before their
 *  sponsorship ends (sent from Admin, Sponsors) */
export function sponsorLink(p: { brand: EmailBrand; contactName: string; business: string; packageName: string; price: string; renewal: boolean; endsOn?: string | null; ended?: boolean; link: string; pageLink?: string | null; canReply: boolean; unsubscribeUrl?: string | null }): RenderedEmail {
  const ends = p.endsOn ? (p.ended ? `ended on ${p.endsOn}` : `ends on ${p.endsOn}`) : null;
  return renderEmail({
    brand: p.brand,
    // The daily renewal reminders (SPP-1) can be unsubscribed from; links an admin sends by hand can't
    unsubscribeUrl: p.unsubscribeUrl,
    subject: p.renewal ? `Renew your ${p.brand.name} sponsorship` : `Finish your ${p.brand.name} sponsorship`,
    preheader: p.renewal ? `${p.business}'s sponsorship${ends ? ` ${ends}` : ''}. Renew for another year.` : `Pay for the ${p.packageName} package to finish signing up.`,
    heading: p.renewal ? 'Time to renew your sponsorship' : 'Finish your sponsorship',
    paragraphs: [
      p.renewal
        ? `Hi ${firstName(p.contactName)}, thank you for supporting ${p.brand.name}. ${p.business}'s sponsorship${ends ? ` ${ends}` : ' is coming up for renewal'}. To keep your logo on the club's site for another year, renew below.`
        : `Hi ${firstName(p.contactName)}, thanks for signing up to sponsor ${p.brand.name}. To finish, pay for the ${p.packageName} package below. You can pay by card or bank transfer.`,
      ...(p.canReply ? ['Questions about the package? Just reply to this email.'] : []),
    ],
    details: [
      ['Business', p.business], ['Package', p.packageName], ['Price', p.price],
      ...(p.endsOn ? [[p.ended ? 'Ended' : 'Ends', p.endsOn] as [string, string]] : []),
      // Their own page: a new logo, their results and invoices (SP-F1/F3/F4)
      ...(p.pageLink ? [['Your sponsor page', p.pageLink] as [string, string]] : []),
    ],
    cta: { label: p.renewal ? 'Renew my sponsorship' : 'Pay for my sponsorship', url: p.link },
    note: 'This link is just for your business. Please don\'t share it.',
    reason: `You're receiving this because ${p.business} ${p.renewal ? 'sponsors' : 'signed up to sponsor'} ${p.brand.name}.`,
  });
}

/** SPP-2: an invoice sent before payment ("Invoice me first", or Send invoice in admin), for the
 *  business to pay or pass to whoever pays their bills */
export function sponsorInvoice(p: { brand: EmailBrand; contactName: string; business: string; packageName: string; price: string; number: string; dueOn: string; invoiceLink: string; canReply: boolean; instalment?: string | null; overdue?: boolean }): RenderedEmail {
  const which = p.instalment ? `${p.instalment.toLowerCase()} for the ${p.packageName} package` : `the ${p.packageName} package`;
  return renderEmail({
    brand: p.brand,
    subject: p.overdue ? `Reminder: invoice ${p.number} from ${p.brand.name} was due ${p.dueOn}` : `Invoice ${p.number} from ${p.brand.name}`,
    preheader: `${p.price} for ${which}, due ${p.dueOn}.`,
    heading: p.overdue ? `A reminder about invoice ${p.number}` : `Invoice ${p.number}`,
    paragraphs: [
      p.overdue
        ? `Hi ${firstName(p.contactName)}, ${p.brand.name} hasn't received ${p.business}'s payment for ${which}, which was due ${p.dueOn}. If it's already on its way, please ignore this.`
        : `Hi ${firstName(p.contactName)}, thank you for sponsoring ${p.brand.name}. Here is ${p.business}'s invoice for ${which}.`,
      'Open it to print or save it as a PDF for your accounts. It has the club\'s bank details, and a button to pay by card.',
      ...(p.canReply ? ['Questions? Just reply to this email.'] : []),
    ],
    details: [['Business', p.business], ['Package', p.packageName], ...(p.instalment ? [['Instalment', p.instalment.replace('Instalment ', '')] as [string, string]] : []), ['Amount', p.price], [p.overdue ? 'Was due' : 'Due', p.dueOn], ['Invoice', p.number]],
    cta: { label: 'Open the invoice', url: p.invoiceLink },
    note: 'This link is just for your business. Please don\'t share it outside your business.',
    reason: `You're receiving this because ${p.business} signed up to sponsor ${p.brand.name}.`,
  });
}

/** The club couldn't match a sponsor's bank transfer (Finance, Reject; SPE-8): why, and the link to
 *  pay again by card or another transfer */
export function sponsorTransferRejected(p: { brand: EmailBrand; contactName: string; business: string; packageName: string; price: string; reason: string | null; link: string; canReply: boolean }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    subject: `Your ${p.brand.name} sponsorship payment`,
    preheader: `We couldn't match ${p.business}'s bank transfer. You can pay again from the link inside.`,
    heading: 'We couldn\'t match your bank transfer',
    paragraphs: [
      `Hi ${firstName(p.contactName)}, thank you for signing up to sponsor ${p.brand.name}. We checked ${p.business}'s bank transfer receipt but couldn't match it to a payment, so it hasn't been counted yet.`,
      'You can pay again by card or bank transfer from the button below.',
      p.canReply ? 'If you think the money did go through, reply to this email with the date and reference.' : 'If you think the money did go through, contact the club with the date and reference.',
    ],
    details: [
      ['Business', p.business], ['Package', p.packageName], ['Price', p.price],
      ...(p.reason ? [['Club\'s note', p.reason] as [string, string]] : []),
    ],
    cta: { label: 'Pay for my sponsorship', url: p.link },
    note: 'This link is just for your business. Please don\'t share it.',
    reason: `You're receiving this because ${p.business} signed up to sponsor ${p.brand.name}.`,
  });
}

/** The club looked at the logo or website a sponsor sent from their page (SPE-17) */
export function sponsorChangeReviewed(p: { brand: EmailBrand; contactName: string; business: string; used: boolean; what: string; pageLink: string; canReply: boolean }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    subject: p.used ? `Your new ${p.what} is on the ${p.brand.name} site` : `About the ${p.what} you sent ${p.brand.name}`,
    preheader: p.used ? `${p.brand.name} is now showing ${p.business}'s new ${p.what}.` : `${p.brand.name} is keeping ${p.business}'s current ${p.what} for now.`,
    heading: p.used ? `Your new ${p.what} is live` : `The club kept your current ${p.what}`,
    paragraphs: [
      p.used
        ? `Hi ${firstName(p.contactName)}, ${p.brand.name} checked the ${p.what} you sent and it's now on their site.`
        : `Hi ${firstName(p.contactName)}, ${p.brand.name} looked at the ${p.what} you sent and is keeping the current one for now.`,
      p.used
        ? 'You can see how often your logo is seen on your sponsor page.'
        : (p.canReply ? 'Reply to this email if you\'d like to know why, or send a different one from your sponsor page.' : 'You can send a different one from your sponsor page.'),
    ],
    details: [['Business', p.business]],
    cta: { label: 'Open my sponsor page', url: p.pageLink },
    note: 'This link is just for your business. Please don\'t share it.',
    reason: `You're receiving this because ${p.business} sponsors ${p.brand.name}.`,
  });
}

/** A sponsor's payment went through (card, or the club verified their bank transfer): thanks, and the
 *  link to their own page to send their logo, see their results and open the invoice */
export function sponsorPaid(p: { brand: EmailBrand; contactName: string; business: string; packageName: string; price: string; pageLink: string; canReply: boolean; instalment?: string | null }): RenderedEmail {
  return renderEmail({
    brand: p.brand,
    subject: `Thank you for sponsoring ${p.brand.name}`,
    preheader: `Payment received for ${p.business}. Send your logo and see your results on your sponsor page.`,
    heading: 'Payment received, thank you',
    paragraphs: [
      `Hi ${firstName(p.contactName)}, thank you for supporting ${p.brand.name}. We've received ${p.business}'s payment for the ${p.packageName} package.`,
      'On your own sponsor page you can send us your logo and website, see how often your logo was seen, and open your invoice.',
      ...(p.canReply ? ['Questions? Just reply to this email.'] : []),
    ],
    details: [['Business', p.business], ['Package', p.packageName], ...(p.instalment ? [['Instalment', p.instalment.replace('Instalment ', '')] as [string, string]] : []), ['Paid', p.price]],
    cta: { label: 'Open my sponsor page', url: p.pageLink },
    note: 'This link is just for your business. Please don\'t share it.',
    reason: `You're receiving this because ${p.business} sponsors ${p.brand.name}.`,
  });
}

// ---------------------------------------------------------------------------------------------
// Grounds directory
// ---------------------------------------------------------------------------------------------

/** "Suggest an edit" on a public ground guide, to the club that looks after the ground */
export function groundSuggestion(p: { clubName: string; ground: string; topic: string; message: string; contact?: string | null; guideUrl: string; adminUrl: string }): RenderedEmail {
  return renderEmail({
    subject: `Suggested edit: ${p.ground} (${p.topic})`,
    preheader: p.message.slice(0, 120),
    heading: `Someone suggested an edit to ${p.ground}`,
    paragraphs: [
      `A visitor to the ${p.ground} ground guide thinks something needs changing. If they're right, update the ground details in Admin, Branding, Public Ground Guide, then mark the suggestion done.`,
    ],
    details: [['About', p.topic], ['Suggestion', p.message], ...(p.contact ? [['Contact', p.contact] as [string, string]] : []), ['Guide', p.guideUrl]],
    cta: { label: 'Review in admin', url: p.adminUrl },
    reason: `You're receiving this because ${p.clubName} looks after the ${p.ground} guide on itsfootball.club.`,
  });
}

/** Mission Control invited this email to own or run a club, without joining it (migration 20261160) */
export function clubAdminInvite(p: { clubName: string; role: 'owner' | 'admin'; email: string; link: string; expires: string }): RenderedEmail {
  const roleName = p.role === 'owner' ? 'Owner' : 'Club Admin';
  return renderEmail({
    subject: `You're invited to run ${p.clubName} on itsfootball.club`,
    preheader: `Accept to become ${p.role === 'owner' ? 'the Owner' : 'a Club Admin'} of ${p.clubName}. No membership needed.`,
    heading: p.role === 'owner' ? `You're invited to be the Owner of ${p.clubName}` : `You're invited to be a Club Admin of ${p.clubName}`,
    paragraphs: [
      `Hi, the itsfootball.club team has invited you to look after ${p.clubName}'s website and club admin.`,
      'Sign in or create a free account with this email address and you\'ll go straight to the club\'s admin. You don\'t need to join the club or pay a membership fee.',
    ],
    details: [['Club', p.clubName], ['Role', roleName], ['Invite for', p.email]],
    cta: { label: 'Accept the invite', url: p.link },
    note: `This link works once and expires on ${p.expires}. Didn't expect this? You can ignore it and nothing will happen.`,
    reason: `You're receiving this because a platform admin invited this email address to run ${p.clubName}.`,
  });
}
