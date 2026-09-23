'use client';

// Samples a crest/logo image on an offscreen canvas and returns a CSS color built from its
// average ink color, adjusted to stay readable as text on a dark background. Returns null if the
// image can't be read (missing, still loading, or blocked by CORS on a third-party host).
export async function extractCrestTextColor(imageUrl: string | undefined): Promise<string | null> {
  if (typeof window === 'undefined' || !imageUrl) return null;

  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue; // skip transparent pixels
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 235 || brightness < 20) continue; // skip near-white/near-black background
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (!count) return resolve(null);
        resolve(toReadableHsl(r / count, g / count, b / count));
      } catch {
        resolve(null); // tainted canvas (no CORS headers) or other read failure
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

// Converts an averaged RGB sample to HSL and clamps lightness/saturation so the result reads
// clearly as text against a near-black scoreboard background.
function toReadableHsl(r: number, g: number, b: number): string {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  s = Math.max(s * 100, 55);
  const lightness = Math.min(Math.max(l * 100, 58), 78);
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(lightness)}%)`;
}
