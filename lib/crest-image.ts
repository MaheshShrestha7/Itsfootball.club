'use client';

// The visitor's crest on a friendly invitation: shrunk on their device to a small square image sent
// inline with the form (no upload, they aren't signed in). The club's admin uploads it properly
// when they save the fixture (crestFile), so the fixture shows the real crest, not the plain shield.
import { MAX_CREST_LENGTH, okCrest } from './friendlies';

const SIZE = 96;

function loadFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn’t an image we can read. Try a PNG or JPG.')); };
    img.src = url;
  });
}

/** A 96 px square data URL of the crest, centred with its shape kept. Throws a readable message. */
export async function shrinkCrest(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Pick a PNG or JPG image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('That image is too big. Pick one under 10 MB.');
  const img = await loadFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser couldn’t read the image.');
  const scale = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight) || 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, Math.round((SIZE - w) / 2), Math.round((SIZE - h) / 2), w, h);

  // WebP keeps the see-through background and is small; browsers without it give PNG
  let url = canvas.toDataURL('image/webp', 0.9);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/png');
  if (url.length > MAX_CREST_LENGTH) {
    // A busy photo: JPEG on white is always small enough
    const flat = document.createElement('canvas');
    flat.width = SIZE;
    flat.height = SIZE;
    const f = flat.getContext('2d')!;
    f.fillStyle = '#ffffff';
    f.fillRect(0, 0, SIZE, SIZE);
    f.drawImage(canvas, 0, 0);
    url = flat.toDataURL('image/jpeg', 0.82);
  }
  if (!okCrest(url)) throw new Error('That image couldn’t be used. Try a smaller PNG or JPG.');
  return url;
}

/** The crest as a file, for uploadImage() */
export function crestFile(dataUrl: string, name = 'opponent-crest'): File | null {
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[3]), c => c.charCodeAt(0));
  return new File([bytes], `${name}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`, { type: m[1] });
}
