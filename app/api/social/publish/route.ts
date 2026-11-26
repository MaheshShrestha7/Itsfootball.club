import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { durableRateLimit } from '@/lib/rate-limit';
import { matchesFileSignature } from '@/lib/file-signature';
import { uploadBufferToR2 } from '@/lib/storage/r2';
import { MetaError, metaConfig, postInstagram, postPagePhoto, unseal } from '@/lib/meta-graph';
import { AUTO_TRIGGERS, readSocialSettings } from '@/lib/social-posts';

// Posts one Admin > Social media post to the club's Facebook Page and Instagram (migration 20261188).
// The browser draws the graphic (the server can't) and sends it as a JPEG; it's stored in the club's
// photo storage so Facebook and Instagram can fetch it. multipart { clubId, key, caption, by, image,
// story?: "1" (Instagram Story, no caption), auto?: "1" (a kick-off/half/full time post made by the
// scorer's screen, allowed for match scorers when the club turned that post on) }.
// The mark is claimed first ("posting"), so two admins' screens never post the same thing twice.
const KEY_RE = /^[a-z]{3,10}:[A-Za-z0-9-]{1,64}(:[0-9]{4})?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 8 * 1024 * 1024;
const STALE = 5 * 60000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') || 0) > MAX + 64 * 1024) return fail('That picture is too big.', 413);
  const form = await req.formData().catch(() => null);
  const str = (k: string) => { const v = form?.get(k); return typeof v === 'string' ? v : ''; };
  const clubId = str('clubId');
  const key = str('key');
  const caption = str('caption').slice(0, 2200);
  const auto = str('auto') === '1';
  const story = str('story') === '1';
  const image = form?.get('image');
  if (!UUID_RE.test(clubId) || !KEY_RE.test(key) || !(image instanceof File)) return fail('Invalid request.', 400);
  const trigger = key.split(':')[0];
  if (auto && !AUTO_TRIGGERS.includes(trigger as never)) return fail('Invalid request.', 400);

  const auth = await requireClubPerm(req, clubId, auto ? ['content', 'match-center', 'matches'] : ['content'], 'edit');
  if (!auth.ok) return fail(auth.error, auth.status);
  const cfg = metaConfig();
  const db = getServiceClient();
  if (!cfg || !db) return fail('Facebook posting is not set up on this site yet.', 503);
  if (!(await durableRateLimit(`social-post:${clubId}`, 40, 3600000))) return fail('Too many posts in the last hour. Please wait a while.', 429);

  const bytes = new Uint8Array(await image.arrayBuffer());
  if (bytes.length > MAX || !matchesFileSignature(bytes, 'image/jpeg')) return fail('The picture must be a JPEG under 8 MB.', 400);

  const [{ data: account }, { data: settingsRow }] = await Promise.all([
    db.from('social_accounts').select('page_id, page_token_enc, ig_user_id').eq('club_id', clubId).maybeSingle(),
    auto ? db.from('social_settings').select('rules, hashtags').eq('club_id', clubId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const token = account?.page_id && account.page_token_enc ? await unseal(cfg.secret, account.page_token_enc) : null;
  if (!account?.page_id || !token) return fail('Connect the club’s Facebook Page first (Social media, Accounts).', 409);
  if (auto && !readSocialSettings(settingsRow).rules[trigger as (typeof AUTO_TRIGGERS)[number]].auto) return fail('This post is set to check first.', 409);

  // Claim it: a new mark, or one that failed (or was skipped, for a person pressing Post), or a stuck "posting"
  const at = new Date().toISOString();
  const byName = str('by').slice(0, 120) || null;
  const claim = { status: 'posting', caption, by_name: byName, at };
  const { error: insertError } = await db.from('social_post_marks').insert({ club_id: clubId, post_key: key, ...claim });
  if (insertError) {
    if (insertError.code !== '23505') return fail("That didn't save. Please try again.", 500);
    const stale = new Date(Date.now() - STALE).toISOString();
    const { data: claimed } = await db.from('social_post_marks').update(claim).eq('club_id', clubId).eq('post_key', key)
      .or(`status.in.(${auto ? 'failed' : 'failed,skipped'}),and(status.eq.posting,at.lt."${stale}")`).select('post_key');
    if (!claimed?.length) return fail('This one has already been posted.', 409);
  }

  const url = await uploadBufferToR2(`clubs/${clubId}/social/${key.replace(/:/g, '-')}-${Date.now()}.jpg`, Buffer.from(bytes), 'image/jpeg').catch(() => null);
  const results: { facebook?: string; instagram?: string; errors?: string[] } = {};
  const errors: string[] = [];
  if (!url) errors.push('The picture could not be stored.');
  else {
    const why = (where: string, e: unknown) => errors.push(`${where}: ${e instanceof MetaError ? e.message : 'no answer'}`);
    await Promise.all([
      postPagePhoto(cfg, account.page_id, token, url, caption).then(id => { results.facebook = id; }, e => why('Facebook', e)),
      account.ig_user_id
        ? postInstagram(cfg, account.ig_user_id, token, url, caption, story).then(id => { results.instagram = id; }, e => why('Instagram', e))
        : null,
    ]);
  }
  if (errors.length) { results.errors = errors.map(e => e.slice(0, 300)); console.error('Social post problems:', clubId, key, errors); }
  const status = results.facebook || results.instagram ? 'shared' : 'failed';
  await db.from('social_post_marks').update({ status, results, at: new Date().toISOString() }).eq('club_id', clubId).eq('post_key', key);
  return NextResponse.json({ status, facebook: !!results.facebook, instagram: !!results.instagram, story, errors });
}
