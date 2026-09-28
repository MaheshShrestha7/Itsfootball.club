import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { sponsorHref } from '@/lib/sponsors';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max = 255) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

// Public sponsorship sign-up: creates a hidden 'prospect' sponsor the club can then take payment for.
// It stays off the public site until an admin adds the logo and switches it on.
export async function POST(req: NextRequest) {
  if (!(await durableRateLimit(`sponsor-apply:${getClientIp(req.headers)}`, 3, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Sponsorship sign-up is not available right now.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  if (clean(body.company_website_confirm)) return NextResponse.json({ sponsorId: crypto.randomUUID() }); // honeypot

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
    .select('id, tier, price_cents')
    .eq('id', packageId)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle();
  if (!pkg) return NextResponse.json({ error: 'That package is no longer available.' }, { status: 404 });

  const { data: sponsor, error } = await db
    .from('sponsors')
    .insert({
      club_id: clubId,
      name,
      logo_url: '/logo-96.png', // placeholder until the club uploads the sponsor's artwork
      website_url: website,
      tier: pkg.tier,
      is_active: false,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      package_value: pkg.price_cents / 100,
      package_status: 'prospect',
    })
    .select('id')
    .single();
  if (error || !sponsor) return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 });
  return NextResponse.json({ sponsorId: sponsor.id });
}
