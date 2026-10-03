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

  const message = c.message?.trim()
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="border-left:4px solid ${color};background:#F8FAFC;border-radius:0 10px 10px 0;padding:14px 18px">
<p style="margin:0 0 6px;font:700 12px ${font};color:#64748B;text-transform:uppercase;letter-spacing:0.06em">Message from ${esc(brand.name)}</p>
${c.message.trim().split(/\n{2,}/).map(p => `<p style="margin:0 0 8px;font:15px/1.6 ${font};color:#0F172A">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
</td></tr></table>`
    : '';
  const image = absolute(c.image);

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
  ${c.note ? `<p style="margin:0 0 24px;font:13px/1.5 ${font};color:#64748B">${esc(c.note)}</p>` : ''}
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
    ...(c.note ? [c.note, ''] : []),
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

/** Shared by every club email other than sign-in */
interface ClubEmailExtras {
  unsubscribeUrl?: string | null;
  /** Personal note from an admin (manual notices) */
  message?: string | null;
}

export function availabilityReminder(p: ClubEmailExtras & { brand: EmailBrand; memberName: string; fixture: string; competition?: string | null; when: string; venue: string; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: `Are you available? ${p.fixture}`,
    preheader: `${p.brand.name} needs your answer for ${p.when}.`,
    heading: 'Can you play?',
    paragraphs: [`Hi ${firstName(p.memberName)}, ${p.brand.name} is picking the squad and hasn't heard from you yet. Let the coaches know if you're in, out or maybe.`],
    details: [['Match', p.fixture], ...(p.competition ? [['Competition', p.competition] as [string, string]] : []), ['When', p.when], ['Where', p.venue]],
    cta: { label: 'Reply with my availability', url: p.link },
    note: 'It takes one tap. This link is personal to you, so please don\'t forward it.',
    reason: `You're receiving this because you're in the ${p.brand.name} squad.`,
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
export function ticketsEmail(p: { brand: EmailBrand; buyerName: string; event: string; quantity: number; when: string; venue: string; link: string }): RenderedEmail {
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
  });
}

export function renewalReminder(p: ClubEmailExtras & { brand: EmailBrand; memberName: string; tier: string; expires: string; expired: boolean; link: string }): RenderedEmail {
  return renderEmail({
    brand: p.brand, unsubscribeUrl: p.unsubscribeUrl, message: p.message,
    subject: p.expired ? `Your ${p.brand.name} membership has expired` : `Your ${p.brand.name} membership expires on ${p.expires}`,
    preheader: p.expired ? 'Renew now to keep your member pass active.' : 'Renew early and keep your remaining days.',
    heading: p.expired ? 'Your membership has expired' : 'Time to renew your membership',
    paragraphs: [
      p.expired
        ? `Hi ${firstName(p.memberName)}, your ${p.brand.name} membership ended on ${p.expires}. Renew now to reactivate your member pass.`
        : `Hi ${firstName(p.memberName)}, your ${p.brand.name} membership expires on ${p.expires}. Renewing early keeps your remaining days.`,
    ],
    details: [['Membership', p.tier], [p.expired ? 'Expired' : 'Expires', p.expires]],
    cta: { label: 'Renew my membership', url: p.link },
    reason: `You're receiving this because you're a member of ${p.brand.name}.`,
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
