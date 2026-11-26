'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/supabase/client';
import type { SocialSettings } from '@/lib/social-posts';

// The browser's side of posting to the club's Facebook Page and Instagram (/api/social/meta, /api/social/publish)

export interface SocialAccount {
  configured: boolean;
  connected?: boolean;
  /** The table isn't there yet (migration 20261188) */
  missing?: boolean;
  page?: { name: string; instagram: string | null; by: string | null; at: string } | null;
  /** The club's saved rules, for the scorer's screen that makes the posts that go out by themselves */
  settings?: SocialSettings;
}

async function authed(input: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  return fetch(input, { ...init, headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

/** Calls /api/social/meta; the JSON answer, or { error } */
export async function metaAccount(method: 'POST' | 'DELETE', body: Record<string, unknown>): Promise<Record<string, unknown> & { error?: string }> {
  try {
    const res = await authed('/api/social/meta', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { error: data.error || 'Something went wrong. Please try again.' };
  } catch { return { error: 'Check your connection and try again.' }; }
}

/** What's connected for the club; null while loading. reload() after connecting or disconnecting. */
export function useSocialAccount(clubId: string | undefined, enabled = true) {
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!clubId || !enabled) return;
    let live = true;
    void authed(`/api/social/meta?clubId=${encodeURIComponent(clubId)}`)
      .then(r => (r.ok ? r.json() : { configured: false }))
      .catch(() => ({ configured: false }))
      .then(a => { if (live) setAccount(a); });
    return () => { live = false; };
  }, [clubId, enabled, tick]);
  return { account, reload: useCallback(() => setTick(t => t + 1), []) };
}

/** The graphic as a JPEG (Instagram takes only JPEG), and whether it's Story-shaped (taller than 4:5) */
export async function toJpeg(blob: Blob): Promise<{ jpeg: Blob; story: boolean }> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot make the picture.');
  ctx.fillStyle = '#fff'; // JPEG has no see-through parts
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const jpeg = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  if (!jpeg) throw new Error('This browser cannot make the picture.');
  return { jpeg, story: bitmap.height / bitmap.width > 1.3 };
}

export interface PublishResult { status?: 'shared' | 'failed'; facebook?: boolean; instagram?: boolean; story?: boolean; errors?: string[]; error?: string }

export async function publishSocial(p: { clubId: string; key: string; caption: string; by: string; image: Blob; auto?: boolean }): Promise<PublishResult> {
  try {
    const { jpeg, story } = await toJpeg(p.image);
    const form = new FormData();
    form.set('clubId', p.clubId);
    form.set('key', p.key);
    form.set('caption', p.caption);
    form.set('by', p.by);
    form.set('image', jpeg, 'post.jpg');
    if (story) form.set('story', '1');
    if (p.auto) form.set('auto', '1');
    const res = await authed('/api/social/publish', { method: 'POST', body: form, signal: AbortSignal.timeout(100000) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { error: data.error || `Posting didn’t work (${res.status}). Please try again.` };
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') return { error: 'No answer after 100 seconds. Check the Page before trying again: it may have posted.' };
    return { error: (e as Error).message || 'Check your connection and try again.' };
  }
}

/** "Posted to Facebook and your Instagram Story" */
export function publishSummary(r: PublishResult): string {
  if (r.error) return r.error;
  const where = [r.facebook && 'Facebook', r.instagram && (r.story ? 'your Instagram Story' : 'Instagram')].filter(Boolean).join(' and ');
  const problems = r.errors?.length ? ` ${r.errors.join(' ')}` : '';
  return where ? `Posted to ${where}.${problems}` : `It didn’t post.${problems}`;
}
