// Run: npx esbuild lib/email/email.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { verifyWebhook } from './webhook';
import { authEmail, authRecipients, availabilityReminder, renewalReminder, newsNotice, matchNotice, applicationReceived, applicationApproved, applicationRejected, ticketsEmail } from './templates';
import { unsubscribeToken, verifyUnsubscribeToken } from './unsubscribe';
import { cleanSettings } from './settings';
import { memberRecipient } from './club-emails';
import { formatMatchWhen, formatWhen } from './format';

// Test fixture only, NOT a real key: a made-up string, wrapped in the "v1,whsec_<base64>" format
// Supabase uses. Built at runtime so no secret-shaped literal sits in the repo.
// SIG was computed independently with Python's hmac module: base64(HMAC-SHA256(key, "id.ts.body")).
const FAKE_KEY = 'test-secret-key-0123456789abcdef';
const SECRET = `v1,whsec_${btoa(FAKE_KEY)}`;
const BODY = '{"user":{"email":"a@b.co"}}';
const SIG = 'mrts+LzYLON1CFt9H4c4oszDyylifj4pWdi3XzDpjfU=';
const TS = 1700000000;
const headers = (signature: string, timestamp = String(TS)) => ({ id: 'msg_2Lh9KsGQ', timestamp, signature });

async function main() {
  // --- webhook signatures ---
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY, TS), true, 'valid signature');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY + ' ', TS), false, 'tampered body');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY, TS + 301), false, 'expired timestamp');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY, TS - 301), false, 'future timestamp');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,AAAA v1,${SIG}`), BODY, TS), true, 'one of several signatures');
  assert.equal(await verifyWebhook(SECRET, headers(`v2,${SIG}`), BODY, TS), false, 'unknown version');
  assert.equal(await verifyWebhook(SECRET, headers('v1,not-base64!!'), BODY, TS), false, 'garbage signature');
  assert.equal(await verifyWebhook('v1,whsec_' + btoa('another-key'), headers(`v1,${SIG}`), BODY, TS), false, 'wrong secret');
  assert.equal(await verifyWebhook(SECRET, { id: null, timestamp: String(TS), signature: `v1,${SIG}` }, BODY, TS), false, 'missing id');

  // --- templates ---
  const evil = { name: 'Evil <script>alert(1)</script> FC', color: '#FFFF00', url: 'https://itsfootball.club/evil', logoUrl: 'javascript:alert(1)' };
  const link = 'https://x.supabase.co/auth/v1/verify?token=abc&type=magiclink&redirect_to=https%3A%2F%2Fitsfootball.club%2Fevil%2Fmember';
  const signIn = authEmail('magiclink', link, '123456', evil);
  assert.ok(!signIn.html.includes('<script>'), 'club name is escaped');
  assert.ok(!signIn.html.includes('javascript:'), 'non-https logo is dropped');
  assert.ok(signIn.html.includes(link.replace(/&/g, '&amp;')), 'link in html (escaped)');
  assert.ok(signIn.text.includes(link), 'link in plain text');
  assert.ok(signIn.subject.includes('Evil <script>'), 'subject is plain text, not html');
  assert.ok(signIn.html.includes('color:#090D16'), 'dark button text on a light club colour');

  const platform = authEmail('signup', link, '123456');
  assert.ok(platform.html.includes('https://itsfootball.club/logo-96.png'), 'platform logo');
  assert.ok(platform.subject.includes('itsfootball.club'));

  const code = authEmail('reauthentication', '', '654321');
  assert.ok(code.html.includes('654321') && code.text.includes('654321'), 'reauth shows the code');

  // --- who auth emails go to ---
  const user = { email: 'old@example.com', new_email: 'new@example.com' };
  const base = { token: '111111', token_hash: 'h-new', email_action_type: 'email_change' as const };
  assert.deepEqual(authRecipients(user, base), [{ to: 'new@example.com', token: '111111', tokenHash: 'h-new' }],
    'email change, secure change off: only the new address');
  const secure = authRecipients(user, { ...base, token_new: '222222', token_hash_new: 'h-cur' });
  assert.deepEqual(secure.map(r => [r.to, r.tokenHash]), [['new@example.com', 'h-new'], ['old@example.com', 'h-cur']],
    'email change, secure change on: both addresses, token names swapped');
  assert.equal(secure[1].changeTo, 'new@example.com', 'current-address copy names the new address');
  assert.deepEqual(authRecipients({ email: 'a@x.com' }, { token: 't', token_hash: 'h', email_action_type: 'magiclink' }).map(r => r.to), ['a@x.com']);
  assert.deepEqual(authRecipients({}, { token: 't', token_hash: 'h', email_action_type: 'magiclink' }), [], 'no address, nothing to send');
  const toCurrent = authEmail('email_change', link, '', undefined, 'new@example.com');
  assert.ok(toCurrent.text.includes('new@example.com') && toCurrent.subject.includes('email change'), 'current-address wording');

  const avail = availabilityReminder({ brand: evil, memberName: '  Sam  Ray ', fixture: 'A vs B', when: 'Sat 4 Oct', venue: 'Park', link: 'https://itsfootball.club/evil/availability?token=t' });
  assert.ok(avail.text.startsWith(evil.name) && avail.text.includes('Hi Sam,'), 'first name greeting');

  const renew = renewalReminder({ brand: evil, memberName: 'Jo', tier: 'Senior', expires: '1 November 2026', expired: true, link: 'https://x' });
  assert.ok(renew.subject.includes('has expired'));

  // --- unsubscribe tokens ---
  const k = 'test-cron-secret';
  const tok = (await unsubscribeToken('club-1', ' Sam@Example.com ', k))!;
  assert.ok(/^[A-Za-z0-9_-]+$/.test(tok), 'url-safe token');
  assert.equal(await verifyUnsubscribeToken('club-1', 'sam@example.com', tok, k), true, 'same address, any case/spacing');
  assert.equal(await verifyUnsubscribeToken('club-2', 'sam@example.com', tok, k), false, 'other club');
  assert.equal(await verifyUnsubscribeToken('club-1', 'other@example.com', tok, k), false, 'other address');
  assert.equal(await verifyUnsubscribeToken('club-1', 'sam@example.com', tok, 'another-secret'), false, 'other secret');
  assert.equal(await verifyUnsubscribeToken('club-1', 'sam@example.com', 'garbage!!', k), false, 'garbage token');
  assert.equal(await unsubscribeToken('club-1', 'sam@example.com', ''), null, 'no secret, no token');

  // --- settings ---
  assert.deepEqual(cleanSettings({ availability_reminders: true, event_reminders: 'yes', bogus: true }), { availability_reminders: true }, 'only known boolean switches');
  assert.deepEqual(cleanSettings(null), {});

  // --- notices ---
  const news = newsNotice({ brand: evil, recipientName: 'Sam', title: 'Big <win>', summary: 'We won', image: 'http://insecure/img.jpg', link: 'https://x/#news', message: 'Hi <b>all</b>\n\nSecond para', unsubscribeUrl: 'https://itsfootball.club/unsubscribe?c=1&e=a&t=b' });
  assert.ok(!news.html.includes('<b>all</b>') && news.html.includes('&lt;b&gt;all&lt;/b&gt;'), 'admin message escaped');
  assert.ok(!news.html.includes('http://insecure'), 'non-https image dropped');
  assert.ok(news.html.includes('Unsubscribe from') && news.text.includes('Unsubscribe: https://itsfootball.club/unsubscribe'), 'unsubscribe link in html and text');
  assert.ok(news.text.includes('Second para'), 'message in plain text');
  const match = matchNotice({ brand: evil, recipientName: 'Sam', fixture: 'A vs B', competition: null, when: 'Sun', venue: 'Park', link: 'https://x' });
  assert.ok(!match.html.includes('Message from') && !match.html.includes('Unsubscribe from'), 'no message/unsubscribe blocks when absent');

  // --- membership applications ---
  const received = applicationReceived({ brand: evil, memberName: 'Jo Bloggs', tier: 'Senior', link: 'https://x/member', payable: true });
  assert.ok(received.text.includes('Hi Jo,') && received.text.includes('membership fee') && !received.html.includes('Unsubscribe from'), 'received: name, fee hint, no unsubscribe');
  const approved = applicationApproved({ brand: evil, memberName: 'Jo', tier: 'Senior', link: 'https://x/member' });
  assert.ok(approved.text.includes('Open my member pass: https://x/member'), 'approved: sign-in link');
  const rejected = applicationRejected({ brand: evil, memberName: 'Jo', tier: 'Senior', reason: 'Squad <full>', link: 'https://x/member' });
  assert.ok(rejected.html.includes('Squad &lt;full&gt;') && rejected.text.includes('Squad <full>'), 'rejected: reason escaped and in text');
  assert.ok(!applicationRejected({ brand: evil, memberName: 'Jo', tier: 'Senior', reason: null, link: 'https://x' }).html.includes('Message from'), 'rejected: no reason block when empty');

  // --- juniors: emails go to the parent or guardian ---
  assert.deepEqual(memberRecipient({ full_name: 'Jo Bloggs', email: 'jo@x.com' }), { to: 'jo@x.com', name: 'Jo Bloggs' }, 'adult: own address');
  assert.deepEqual(memberRecipient({ full_name: 'Kid One', email: '', guardian_name: 'Pat Parent', guardian_email: ' pat@x.com ' }),
    { to: 'pat@x.com', name: 'Pat Parent', childName: 'Kid One' }, 'junior with no email: guardian');
  assert.equal(memberRecipient({ full_name: 'Teen', email: 'teen@x.com', guardian_name: null, guardian_email: 'pat@x.com' })?.to, 'pat@x.com', 'junior with own email: still the guardian');
  assert.equal(memberRecipient({ full_name: 'Teen', email: 'teen@x.com', guardian_email: 'not-an-email' })?.to, 'teen@x.com', 'bad guardian email: own address');
  assert.equal(memberRecipient({ full_name: 'Nobody', email: '', guardian_email: null }), null, 'no address at all');
  assert.equal(memberRecipient({ full_name: 'Kid', email: null, guardian_name: '', guardian_email: 'pat@x.com' })?.name, '', 'no guardian name: greeting falls back');

  const kidRenew = renewalReminder({ brand: evil, memberName: 'Pat Parent', childName: 'Kid One', tier: 'U10', expires: '1 November 2026', expired: false, link: 'https://x' });
  assert.ok(kidRenew.subject.startsWith("Kid One's") && kidRenew.text.includes('Hi Pat,') && kidRenew.text.includes("Kid One's") && kidRenew.text.includes('Renew for Kid'), 'renewal to a guardian names the child');
  const kidAvail = availabilityReminder({ brand: evil, memberName: '', childName: 'Kid One', fixture: 'A vs B', when: 'Sat', venue: 'Park', link: 'https://x' });
  assert.ok(kidAvail.subject.includes('Is Kid available?') && kidAvail.text.includes('Hi there,') && kidAvail.text.includes('about Kid One'), 'availability to a guardian');
  const kidApproved = applicationApproved({ brand: evil, memberName: 'Pat', childName: 'Kid One', tier: 'U10', link: 'https://x/member' });
  assert.ok(kidApproved.text.includes("approved Kid One's membership") && kidApproved.text.includes('parent or guardian') === false, 'approved to a guardian');
  assert.ok(applicationReceived({ brand: evil, memberName: 'Pat', childName: 'Kid One', tier: 'U10', link: 'https://x', payable: false }).text.includes('applying for Kid One'), 'received to a guardian');
  assert.ok(applicationRejected({ brand: evil, memberName: 'Pat', childName: 'Kid One', tier: 'U10', reason: null, link: 'https://x' }).text.includes('applied for Kid One'), 'rejected to a guardian');
  // Members without a guardian get exactly the wording they had before
  assert.ok(renew.text.includes('your ') && !renew.text.includes('parent or guardian'), 'adult renewal unchanged');

  // Cup fixtures store a date-only match_date with the kick-off in match_time.
  assert.equal(formatMatchWhen('2026-10-17', '15:00'), 'Sat, 17 Oct, 3:00 pm');
  assert.equal(formatMatchWhen('2026-10-17', '09:30:00'), 'Sat, 17 Oct, 9:30 am');
  assert.equal(formatMatchWhen('2026-10-17'), 'Sat, 17 Oct');
  assert.equal(formatMatchWhen('not a date'), '');
  assert.equal(formatMatchWhen('2026-10-17T04:00:00Z', '09:00'), formatWhen('2026-10-17T04:00:00Z'));
  // Tickets email: sponsors whose package includes event tickets, at the bottom of the card
{
  const base = { brand: { name: 'Riverside Rovers FC', url: 'https://itsfootball.club/rrfc' }, buyerName: 'Jess Lee', event: 'Presentation Night', quantity: 2, when: 'Fri 21 Nov, 7:00 pm', venue: 'Clubrooms', link: 'https://itsfootball.club/rrfc/tickets/1' };
  const plain = ticketsEmail(base);
  assert.ok(!plain.html.includes('supported by') && !plain.text.includes('supported by'), 'no sponsors, no row');
  const withSponsors = ticketsEmail({ ...base, sponsors: [
    { name: 'Harbour Physio', logoUrl: 'https://cdn.example.com/hp.png', url: 'https://harbourphysio.com.au/' },
    { name: 'Corner <Cafe>', logoUrl: 'javascript:alert(1)', url: 'javascript:alert(1)' },
  ] });
  assert.ok(withSponsors.html.includes('This event is supported by'));
  assert.ok(withSponsors.html.includes('src="https://cdn.example.com/hp.png"') && withSponsors.html.includes('href="https://harbourphysio.com.au/"'));
  assert.ok(withSponsors.html.includes('Corner &lt;Cafe&gt;') && !withSponsors.html.includes('javascript:'), 'unsafe logo and link left out, name escaped');
  assert.ok(withSponsors.text.includes('This event is supported by: Harbour Physio, Corner <Cafe>'));
}

console.log('email: webhook signatures, unsubscribe tokens and templates OK');
}

main().catch(e => { console.error(e); process.exit(1); });
