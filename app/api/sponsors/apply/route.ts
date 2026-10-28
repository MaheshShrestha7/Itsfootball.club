import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { sponsorHref } from '@/lib/sponsors';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/turnstile-server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max = 255) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

// Public sponsorship sign-up: creates a hidden 'prospect' sponsor the club can then take payment for.
// It stays off the public site until an admin adds the logo and switches it on.
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

  const row = {
    club_id: clubId,
    name,
    website_url: website,
    tier: pkg.tier,
    is_active: false,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    package_value: pkg.price_cents / 100,
    package_status: 'prospect',
  };
  // The badge shows the package's name; before migration 20261127 there is no label column, so save without it
  const label = typeof pkg.name === 'string' ? pkg.name.trim().slice(0, 60) || null : null;
  // Applying again with the same email (a retry, or a different package) updates the hidden
  // prospect from last time instead of adding another one to the club's sponsor list
  const { data: earlier } = await db
    .from('sponsors')
    .select('id')
    .eq('club_id', clubId)
    .eq('package_status', 'prospect')
    .eq('is_active', false)
    .ilike('contact_email', contactEmail.replace(/[%_\\]/g, '\\$&'))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const save = (values: Record<string, unknown>) =>
    earlier
      ? db.from('sponsors').update(values).eq('id', earlier.id).select('id').single()
      // The logo is a placeholder until the club uploads the sponsor's artwork
      : db.from('sponsors').insert({ logo_url: '/logo-96.png', ...values }).select('id').single();
  let { data: sponsor, error } = await save({ ...row, label });
  if (error?.code === 'PGRST204') ({ data: sponsor, error } = await save(row));
  if (error || !sponsor) return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 });
  return NextResponse.json({ sponsorId: sponsor.id });
}
