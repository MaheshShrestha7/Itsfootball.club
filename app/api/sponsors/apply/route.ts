import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { sponsorHref } from '@/lib/sponsors';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/turnstile-server';
import { formatMoney } from '@/lib/finance';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max = 255) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

// Public sponsorship sign-up: creates a hidden 'prospect' sponsor the club can then take payment for.
// It stays off the public site until an admin checks it and taps Put on site (even once paid).
// A "price on request" package (price 0) skips payment: the business's message goes to the Inbox.
// Either way the club hears about it in their Inbox, and on the admin "Needs you" list.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!(await durableRateLimit(`sponsor-apply:${ip}`, 3, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Sponsorship sign-up is not available right now.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  if (clean(body.company_website_confirm)) return NextResponse.json({ sponsorId: crypto.randomUUID() }); // honeypot
  if (!(await verifyTurnstile(body.captchaToken, ip))) return NextResponse.json({ error: TURNSTILE_FAILED }, { status: 400 });

  const clubId = clean(body.clubId, 36);
  const packageId = clean(body.packageId, 36);
  const name = clean(body.name);
  const contactName = clean(body.contact_name);
  const contactEmail = clean(body.contact_email).toLowerCase();
  const contactPhone = clean(body.contact_phone, 64) || null;
  const website = sponsorHref(clean(body.website_url, 500) || undefined) ?? null;
  const offer = clean(body.message, 2000);
  if (!clubId || !packageId || !name || !contactName || !EMAIL_RE.test(contactEmail)) {
    return NextResponse.json({ error: 'Please fill in your business name, contact name and a valid email.' }, { status: 400 });
  }

  const { data: pkg } = await db
    .from('sponsorship_packages')
    .select('id, name, tier, price_cents')
    .eq('id', packageId)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();
  if (!pkg) return NextResponse.json({ error: 'That package is no longer available.' }, { status: 404 });

  const onRequest = !(pkg.price_cents > 0);
  const row = {
    club_id: clubId,
    name,
    website_url: website,
    tier: pkg.tier,
    is_active: false,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    package_value: onRequest ? null : pkg.price_cents / 100,
    package_status: 'prospect',
  };
  // Applying again with the same email within the hour (a retry, or a change of package) updates
  // that hidden prospect instead of adding another one to the club's sponsor list. Anything older
  // makes a new sign-up, so typing someone else's email can't overwrite their business's details.
  const { data: earlier } = await db
    .from('sponsors')
    .select('id')
    .eq('club_id', clubId)
    .eq('package_status', 'prospect')
    .eq('is_active', false)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .ilike('contact_email', contactEmail.replace(/[%_\\]/g, '\\$&'))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const save = (values: Record<string, unknown>) =>
    earlier
      ? db.from('sponsors').update(values).eq('id', earlier.id).select('id').single()
      // No logo yet: their initials show until the club uploads the artwork. The badge label is
      // left to the admin, so the site shows the tier name ("Gold Partner"), not the package's name.
      : db.from('sponsors').insert({ logo_url: '', ...values }).select('id').single();
  const { data: sponsor, error } = await save(row);
  if (error || !sponsor) return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 });

  // Tell the club in their Inbox. Best effort: the sign-up is saved either way, and the inbox's own
  // 2-minute per-email cooldown quietly drops a quick repeat
  const { data: settings } = await db.from('club_payment_settings').select('currency').eq('club_id', clubId).maybeSingle();
  const price = onRequest ? 'price on request' : formatMoney(pkg.price_cents, settings?.currency || 'AUD');
  const lines = [
    `New sponsor sign-up from your website: ${name}.`,
    '',
    `Package: ${pkg.name} (${price})`,
    `Contact: ${contactName}, ${contactEmail}${contactPhone ? `, ${contactPhone}` : ''}`,
    website ? `Website: ${website}` : 'Website: none given',
    '',
    onRequest
      ? `What they would like to offer:\n${offer || '(no message)'}`
      : 'They have gone on to payment. Card payments show as Paid on the Sponsors page; bank transfers wait for you to check the receipt in Finance.',
    '',
    'They stay off your site until you check their details and tap Put on site on the Sponsors page.',
  ];
  await db.from('contact_inquiries').insert({
    club_id: clubId,
    sender_name: contactName,
    sender_email: contactEmail,
    sender_phone: contactPhone,
    inquiry_type: 'Sponsorship',
    message: lines.join('\n'),
    status: 'unread',
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ sponsorId: sponsor.id, onRequest });
}
