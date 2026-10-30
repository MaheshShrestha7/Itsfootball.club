import { Club, ClubMember } from '@/lib/supabase/types';
import { evaluateColorContrast } from '@/lib/theme-utils';
import { DATE_LOCALE } from '@/lib/dates';
import { corsCopy } from '@/lib/image-color';

/**
 * Draws the member pass as a phone-sized PNG (1080x1350, taller with a sponsor row) so it can be kept in the photo
 * library and shown at the gate without signing in. The QR is copied from a canvas the
 * card already rendered, so the image carries exactly the token the gate scanner reads.
 * The crest and member photo are left out: a cross-origin image would block exporting the canvas.
 * A sponsor logo is drawn only when it loads with CORS, like the share graphics' logos.
 */
export async function renderPassImage(
  club: Club,
  member: ClubMember,
  qrCanvas: HTMLCanvasElement,
  statusLabel: string,
  /** The pass's one sponsor (Admin, Sponsors): a "Supported by" row under the QR, on a taller image */
  sponsor?: { name: string; logoUrl?: string | null } | null
): Promise<Blob> {
  const W = 1080;
  const logo = sponsor?.logoUrl ? await loadLogo(sponsor.logoUrl) : null;
  const H = sponsor ? 1470 : 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported');

  const primary = /^#[0-9a-f]{6}$/i.test(club.primary_color || '') ? club.primary_color : '#10B981';
  const bandInk = evaluateColorContrast(primary).bestTextColor; // light club colours get dark header text
  const font = (weight: number, size: number) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  // Shrinks the text until it fits the width, so long club or member names never run off the edge
  const fitText = (text: string, weight: number, size: number, maxWidth: number, y: number, color: string) => {
    let s = size;
    ctx.font = font(weight, s);
    while (s > 20 && ctx.measureText(text).width > maxWidth) {
      s -= 2;
      ctx.font = font(weight, s);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  };

  ctx.fillStyle = '#0E1420';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, W, 220);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(club.name, 800, 64, W - 120, 95, bandInk);
  fitText('OFFICIAL MEMBER PASS', 700, 30, W - 120, 165, bandInk);

  fitText(member.full_name, 900, 72, W - 120, 315, '#FFFFFF');
  const role = member.is_executive && member.executive_title ? member.executive_title : member.membership_tier;
  const jersey = member.jersey_number ? ` • Jersey No. ${member.jersey_number}` : '';
  fitText(`${role || 'Member'}${jersey}`, 600, 38, W - 120, 395, '#CBD5E1');

  // White quiet zone around the QR so phone and gate cameras lock on quickly
  const qrSize = 640;
  const pad = 40;
  const qrX = (W - qrSize) / 2;
  const qrY = 490;
  ctx.fillStyle = '#FFFFFF';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 32);
    ctx.fill();
  } else {
    ctx.fillRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  const expires = member.membership_expires_at
    ? new Date(`${member.membership_expires_at.slice(0, 10)}T00:00:00`).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  fitText(`${statusLabel}${expires ? ` • Valid until ${expires}` : ''}`, 700, 36, W - 120, 1222, statusLabel === 'ACTIVE' ? '#34D399' : '#FBBF24');
  fitText('Show this QR code at the gate', 500, 30, W - 120, 1285, '#94A3B8');

  if (sponsor) {
    // "SUPPORTED BY" and the sponsor's logo on a white tile (or their name without one)
    const tileW = 260;
    const tileH = 84;
    ctx.font = font(800, 24);
    const label = 'SUPPORTED BY';
    const labelW = ctx.measureText(label).width + 11 * 2;
    const x0 = (W - (labelW + 28 + tileW)) / 2;
    const cy = 1385;
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '2px';
    ctx.fillText(label, x0, cy);
    ctx.letterSpacing = '0px';
    const tx = x0 + labelW + 28;
    ctx.fillStyle = '#FFFFFF';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(tx, cy - tileH / 2, tileW, tileH, 14);
      ctx.fill();
    } else {
      ctx.fillRect(tx, cy - tileH / 2, tileW, tileH);
    }
    ctx.imageSmoothingEnabled = true;
    if (logo) {
      const scale = Math.min((tileW - 28) / logo.naturalWidth, (tileH - 20) / logo.naturalHeight);
      const w = logo.naturalWidth * scale;
      const h = logo.naturalHeight * scale;
      ctx.drawImage(logo, tx + (tileW - w) / 2, cy - h / 2, w, h);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0E1420';
      let size = 30;
      ctx.font = font(800, size);
      while (size > 16 && ctx.measureText(sponsor.name).width > tileW - 24) ctx.font = font(800, (size -= 2));
      ctx.fillText(sponsor.name, tx + tileW / 2, cy + 1);
    }
    ctx.textAlign = 'center';
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), 'image/png');
  });
}

/**
 * Hands the image to the phone's share sheet (where "Save Image" puts it in Photos) when the
 * browser can share files, otherwise downloads it. Returns false if the person cancelled.
 */
export async function savePassImage(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (isTouch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return true;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return false;
      // Sharing refused (e.g. no user gesture left): fall back to a plain download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** A sponsor logo that can be drawn and still exported: fetched with CORS (as the share graphics do),
 *  so a logo the browser can't load that way is left out rather than blocking the save */
function loadLogo(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = corsCopy(src);
  });
}
