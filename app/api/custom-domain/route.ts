import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireAdminOfClub, requireClubOwner } from '@/lib/supabase/server-auth';
import { addHostname, findHostname, isCloudflareConfigured, isLive, removeHostname } from '@/lib/cloudflare';
import { normalizeDomain } from '@/lib/slugs';

// A club's own domain: saving it registers it with Cloudflare, which serves the club site on it
// (middleware.ts) as soon as the club's CNAME points at us. See docs/custom-domains.md.

type DomainStatus = { domain: string; status: 'none' | 'pending' | 'live' };

const error = (status: number, message: string) => NextResponse.json({ error: message }, { status });

function notConfigured(db: unknown) {
  const missing = [
    !process.env.CF_HOSTNAMES_TOKEN && 'CF_HOSTNAMES_TOKEN',
    !process.env.CF_ZONE_ID && 'CF_ZONE_ID',
    !db && 'SUPABASE_SECRET_KEY',
  ].filter(Boolean);
  console.error('[custom-domain] not configured, missing:', missing.join(', '));
  return error(503, 'Custom domains are not set up on this site yet.');
}

async function statusOf(domain: string): Promise<DomainStatus> {
  if (!domain) return { domain: '', status: 'none' };
  return { domain, status: isLive(await findHostname(domain)) ? 'live' : 'pending' };
}

/** Where the club's domain is up to. Any admin of the club. */
export async function GET(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('clubId') || '';
  const auth = await requireAdminOfClub(req, clubId);
  if (!auth.ok) return error(auth.status, auth.error);
  const db = getServiceClient();
  if (!db || !isCloudflareConfigured()) return notConfigured(db);

  const { data: club } = await db.from('clubs').select('custom_domain').eq('id', clubId).maybeSingle();
  try {
    return NextResponse.json(await statusOf(club?.custom_domain || ''));
  } catch (err) {
    console.error('[custom-domain] status:', err);
    return error(502, 'Could not check the domain right now. Please try again.');
  }
}

/** Connects { domain }, replacing the old one; '' disconnects. Owner only, like the club's Stripe account. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clubId = typeof body?.clubId === 'string' ? body.clubId : '';
  const input = typeof body?.domain === 'string' ? body.domain : '';
  const domain = normalizeDomain(input);
  if (!clubId || (input.trim() && !domain)) return error(400, 'Enter a domain like www.yourclub.com.');

  const auth = await requireClubOwner(req, clubId);
  if (!auth.ok) return error(auth.status, auth.error);
  const db = getServiceClient();
  if (!db || !isCloudflareConfigured()) return notConfigured(db);

  const { data: club } = await db.from('clubs').select('custom_domain').eq('id', clubId).maybeSingle();
  if (!club) return error(404, 'Club not found.');
  const previous = club.custom_domain || '';

  if (domain && domain !== previous) {
    const { data: taken } = await db.from('clubs').select('id').eq('custom_domain', domain).neq('id', clubId).maybeSingle();
    if (taken) return error(409, 'Another club is already using this domain.');
  }

  try {
    // Cloudflare first: if it fails, nothing has changed
    if (domain) await addHostname(domain);
    const { error: dbError } = await db.from('clubs')
      .update({ custom_domain: domain || null, updated_at: new Date().toISOString() })
      .eq('id', clubId);
    if (dbError) throw dbError;
    if (previous && previous !== domain) {
      await removeHostname(previous).catch(err => console.error('[custom-domain] remove old:', previous, err));
    }
    return NextResponse.json(await statusOf(domain));
  } catch (err) {
    console.error('[custom-domain] connect:', domain, err);
    return error(502, 'Could not connect the domain right now. Please try again.');
  }
}
