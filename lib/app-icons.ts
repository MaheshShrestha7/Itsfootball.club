'use client';

// Club home-screen icons drawn from the crest in the browser (like lib/share-card.ts: nothing runs
// on the server and nothing new is installed). The admin area keeps them in step with the crest;
// the club manifest and iPhone icon serve them (app/[clubSlug]/manifest.webmanifest, apple-icon.ts).
import { useEffect } from 'react';
import { corsCopy } from './image-color';
import { getAccessToken, getSupabaseClient } from './supabase/client';

export interface AppIcons {
  /** The crest URL these were drawn from; a new crest means new icons */
  source: string;
  icon192: string;
  icon512: string;
  maskable512: string;
}

const ICONS = [
  { key: 'icon192', size: 192, fill: 0.84 },
  { key: 'icon512', size: 512, fill: 0.84 },
  // Android crops maskable icons to a circle or squircle; the crest stays inside the 80% safe zone
  { key: 'maskable512', size: 512, fill: 0.6 },
] as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // the canvas must stay exportable
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the crest'));
    img.src = corsCopy(src);
  });
}

/** The crest centred on white (crests are made for light backgrounds), as an opaque PNG */
function drawIcon(img: HTMLImageElement, size: number, fill: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas unavailable'));
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  const box = size * fill;
  // An SVG crest with only a viewBox can report 0x0: treat it as square
  const iw = img.naturalWidth || box;
  const ih = img.naturalHeight || box;
  const scale = Math.min(box / iw, box / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the icon'))), 'image/png'));
}

async function uploadPng(blob: Blob, clubId: string, name: string): Promise<string> {
  const form = new FormData();
  form.append('file', new File([blob], `${name}.png`, { type: 'image/png' }));
  form.append('folder', 'app-icons');
  form.append('clubId', clubId);
  const token = await getAccessToken();
  const res = await fetch('/api/upload', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(json.error || `Icon upload failed (${res.status})`);
  return json.url;
}

/** The crest drawn at every icon size, as PNGs */
export async function drawAppIcons(logoUrl: string): Promise<Record<(typeof ICONS)[number]['key'], Blob>> {
  const img = await loadImage(logoUrl);
  const out = {} as Record<(typeof ICONS)[number]['key'], Blob>;
  for (const { key, size, fill } of ICONS) out[key] = await drawIcon(img, size, fill);
  return out;
}

export async function makeAppIcons(clubId: string, logoUrl: string): Promise<AppIcons> {
  const blobs = await drawAppIcons(logoUrl);
  const urls: Record<string, string> = {};
  for (const { key } of ICONS) urls[key] = await uploadPng(blobs[key], clubId, key);
  // ponytail: icons from an older crest stay in storage; sweep the app-icons folder if it ever matters
  return { source: logoUrl, icon192: urls.icon192, icon512: urls.icon512, maskable512: urls.maskable512 };
}

/**
 * Keeps a club's home-screen icons in step with its crest. Runs in the admin area for people who
 * may edit the branding, so a new crest gets new icons on the next admin page view.
 */
export function useClubAppIcons(
  club: { id: string; logo_url?: string; app_icons?: AppIcons | null },
  canEdit: boolean,
  save: (icons: AppIcons) => void
) {
  const logo = club.logo_url;
  const made = club.app_icons?.source;
  useEffect(() => {
    if (!canEdit || !logo || made === logo) return;
    let cancelled = false;
    (async () => {
      // Only once the database can store them (migration 20261027), so nothing is uploaded in vain
      const check = await getSupabaseClient()?.from('clubs').select('app_icons').eq('id', club.id).maybeSingle();
      if (!check || check.error) return;
      const icons = await makeAppIcons(club.id, logo);
      if (!cancelled) save(icons);
    })().catch(err => console.warn('Could not make the club app icons:', err));
    return () => { cancelled = true; };
    // save is recreated each render; the crest and permission decide when to redraw
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id, logo, made, canEdit]);
}
