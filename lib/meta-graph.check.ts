import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { loginUrl, pagesFromCode, postInstagram, postPagePhoto, readSignedRequest, readState, seal, signState, unseal } from './meta-graph';

(async () => {
  const secret = 'test-secret';
  // Tokens: round trip, a different secret or a changed byte can't open them
  const sealed = await seal(secret, 'EAAB-page-token');
  assert.equal(await unseal(secret, sealed), 'EAAB-page-token');
  assert.equal(await unseal('other', sealed), null);
  assert.equal(await unseal(secret, sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA')), null);
  assert.notEqual(await seal(secret, 'x'), await seal(secret, 'x'), 'a fresh iv each time');

  // State: signed, expires after 15 minutes, tampering fails
  const now = Date.parse('2026-11-26T00:00:00Z');
  const state = await signState(secret, 'club-1', 'user-1', now);
  assert.deepEqual(await readState(secret, state, now + 60000), { clubId: 'club-1', userId: 'user-1' });
  assert.equal(await readState(secret, state, now + 16 * 60000), null);
  assert.equal(await readState('other', state, now), null);
  const forged = Buffer.from(JSON.stringify({ c: 'club-2', u: 'user-1', e: now + 60000 })).toString('base64url') + '.' + state.split('.')[1];
  assert.equal(await readState(secret, forged, now), null);

  // Meta's signed_request
  const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '123', issued_at: 1 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  assert.equal((await readSignedRequest(secret, `${sig}.${payload}`))?.user_id, '123');
  assert.equal(await readSignedRequest('other', `${sig}.${payload}`), null);

  // Login link: scopes by default, a configuration id when there is one
  const url = new URL(loginUrl({ appId: '1', secret }, 's'));
  assert.equal(url.searchParams.get('redirect_uri'), 'https://itsfootball.club/api/social/meta/callback');
  assert.match(url.searchParams.get('scope') || '', /pages_manage_posts.*instagram_content_publish/);
  assert.equal(new URL(loginUrl({ appId: '1', secret, configId: '9' }, 's')).searchParams.get('config_id'), '9');

  // Graph calls against a stand-in Facebook
  const calls: { url: string; body?: string }[] = [];
  let status = 'IN_PROGRESS';
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? String(init.body) : undefined });
    const path = new URL(url).pathname.replace('/v25.0', '');
    const json = (x: unknown, ok = true) => new Response(JSON.stringify(x), { status: ok ? 200 : 400 });
    if (path === '/oauth/access_token') return json({ access_token: url.includes('fb_exchange_token') ? 'long' : 'short' });
    if (path === '/me') return json({ id: 'fb-1' });
    if (path === '/me/accounts') return json({ data: [
      { id: 'p1', name: 'Craik Park FC', access_token: 'pt1', tasks: ['CREATE_CONTENT', 'MANAGE'], instagram_business_account: { id: 'ig1', username: 'craikpark' } },
      { id: 'p2', name: 'Read only', access_token: 'pt2', tasks: ['ANALYZE'] },
    ] });
    if (path === '/p1/photos') return json({ id: 'photo', post_id: 'p1_post' });
    if (path === '/ig1/media') return json({ id: 'box' });
    if (path === '/box') { const r = json({ status_code: status }); status = 'FINISHED'; return r; }
    if (path === '/ig1/media_publish') return json({ id: 'media-1' });
    if (path === '/bad/photos') return json({ error: { message: 'Permissions error' } }, false);
    return json({ error: { message: 'unknown ' + path } }, false);
  }) as typeof fetch;
  const cfg = { appId: '1', secret };
  const got = await pagesFromCode(cfg, 'code-1');
  assert.equal(got.fbUserId, 'fb-1');
  assert.deepEqual(got.pages, [{ id: 'p1', name: 'Craik Park FC', token: 'pt1', igId: 'ig1', igUsername: 'craikpark' }], 'Pages it can post to only');
  assert.ok(calls.some(c => c.url.includes('appsecret_proof=')), 'token calls carry the proof');
  assert.ok(!calls.some(c => c.url.includes('access_token=short') && c.url.includes('/me')), 'the long-lived token reads the Pages');
  assert.equal(await postPagePhoto(cfg, 'p1', 'pt1', 'https://img/x.jpg', 'Full time'), 'p1_post');
  assert.match(calls.at(-1)!.body || '', /url=https%3A%2F%2Fimg%2Fx.jpg&caption=Full\+time/);
  calls.length = 0;
  assert.equal(await postInstagram(cfg, 'ig1', 'pt1', 'https://img/x.jpg', 'cap', true), 'media-1');
  assert.match(calls[0].body || '', /media_type=STORIES/);
  assert.ok(!/caption/.test(calls[0].body || ''), 'Stories have no caption');
  await assert.rejects(postPagePhoto(cfg, 'bad', 't', 'u', 'c'), /Permissions error/);
  console.log('meta-graph checks passed');
})().catch(e => { console.error(e); process.exit(1); });
