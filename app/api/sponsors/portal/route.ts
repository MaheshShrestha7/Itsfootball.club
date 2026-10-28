import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { matchesFileSignature } from '@/lib/file-signature';
import { isR2Configured, uploadBufferToR2 } from '@/lib/storage/r2';
import { findSponsorByKey, loadPortal } from '@/lib/sponsor-portal-server';
import { typedWebsite } from '@/lib/sponsors';

// A sponsor's own page (SP-F1, SP-F3 from the 28 Oct 2026 sponsors review). The link's secret is the key.
//   GET  ?k=...                                  their logo, results, payments and renewal link
//   POST multipart { k, logo?, website? }        a new logo and/or website for the club to check.
//        Saved as pending_*; nothing changes on the site until an admin taps Use it.

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!(await durableRateLimit(`sponsor-page:${getClientIp(req.headers)}`, 60, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This page is not available right now.' }, { status: 503 });
  const found = await findSponsorByKey(db, req.nextUrl.searchParams.get('k'));
  if (!found) return NextResponse.json({ error: 'This link is not valid. Ask the club for a new one.' }, { status: 404 });
  return NextResponse.json(await loadPortal(db, found.sponsor, found.club), { headers: noStore });
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') || 0) > MAX_LOGO_SIZE + 256 * 1024) {
    return NextResponse.json({ error: 'The logo must be 2 MB or smaller.' }, { status: 413 });
  }
  if (!(await durableRateLimit(`sponsor-page-send:${getClientIp(req.headers)}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many changes sent. Please try again in an hour.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This page is not available right now.' }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const found = await findSponsorByKey(db, form?.get('k'));
  if (!found) return NextResponse.json({ error: 'This link is not valid. Ask the club for a new one.' }, { status: 404 });
  const { sponsor, club } = found;
  if (!('pending_sent_at' in sponsor)) {
    return NextResponse.json({ error: 'The club hasn\'t switched this on yet. Email your logo to the club instead.' }, { status: 409 });
  }

  const file = form?.get('logo');
  const websiteInput = String(form?.get('website') ?? '').trim().slice(0, 500);
  const website = websiteInput ? typedWebsite(websiteInput) : undefined;
  if (websiteInput && !website) return NextResponse.json({ error: 'That website address doesn\'t look right.' }, { status: 400 });
  const newWebsite = website && website !== (sponsor.website_url || '') ? website : null;
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !newWebsite) return NextResponse.json({ error: 'Nothing has changed.' }, { status: 400 });

  let logoUrl: string | null = null;
  if (hasFile) {
    const type = (file.type || '').toLowerCase();
    if (!LOGO_TYPES[type]) return NextResponse.json({ error: 'Please send a PNG, JPG, WebP or GIF image.' }, { status: 415 });
    if (file.size > MAX_LOGO_SIZE) return NextResponse.json({ error: 'The logo must be 2 MB or smaller.' }, { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(buffer, type)) return NextResponse.json({ error: 'That file isn\'t the image it says it is.' }, { status: 415 });
    const key = `clubs/${club.id}/sponsors/${crypto.randomUUID()}.${LOGO_TYPES[type]}`;
    if (isR2Configured) logoUrl = await uploadBufferToR2(key, buffer, type);
    if (!logoUrl) {
      const { error } = await db.storage.from('club-assets').upload(key, buffer, { contentType: type, upsert: false });
      if (!error) logoUrl = db.storage.from('club-assets').getPublicUrl(key).data.publicUrl;
      else console.error('[sponsor-page] logo upload failed:', error.message);
    }
    if (!logoUrl) return NextResponse.json({ error: 'The logo could not be saved right now. Please try again later.' }, { status: 503 });
  }

  // A second send replaces only what it includes, so a logo then a website arrive as one change
  const sentAt = new Date().toISOString();
  const { error } = await db.from('sponsors').update({
    ...(logoUrl ? { pending_logo_url: logoUrl } : {}),
    ...(newWebsite ? { pending_website_url: newWebsite } : {}),
    pending_sent_at: sentAt,
  }).eq('id', sponsor.id);
  if (error) return NextResponse.json({ error: 'Could not send that to the club. Please try again.' }, { status: 500 });
  // SPE-17: a new send replaces the club's last answer (migration 20261136; quietly nothing before it)
  await db.from('sponsors').update({ change_reviewed: null, change_reviewed_at: null }).eq('id', sponsor.id).then(() => undefined, () => undefined);

  // Tell the club in their Inbox (an inbox message needs a sender email). Best effort: the Sponsors
  // page and the admin "Needs you" list show it either way
  const sent = [logoUrl && 'a new logo', newWebsite && `a new website (${newWebsite})`].filter(Boolean).join(' and ');
  if (sponsor.contact_email) await db.from('contact_inquiries').insert({
    club_id: club.id,
    sender_name: sponsor.contact_name || sponsor.name,
    sender_email: sponsor.contact_email,
    sender_phone: sponsor.contact_phone || null,
    inquiry_type: 'Sponsorship',
    message: `${sponsor.name} sent ${sent} from their sponsor page.\n\nNothing changes on your site until you check it and tap Use it on their card on the Sponsors page.`,
    status: 'unread',
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ ok: true, pending_logo_url: logoUrl ?? sponsor.pending_logo_url ?? null, pending_website_url: newWebsite ?? sponsor.pending_website_url ?? null, pending_sent_at: sentAt });
}
