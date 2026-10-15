'use client';

// "Remove background" for the Player of the Match photo in the free result graphic maker: cuts the
// player out of their photo on the device with MediaPipe's selfie segmenter (no upload, no AI redraw:
// every pixel of the player is their own). The runtime (~11 MB) and the model (~250 KB) are served from
// /vendor/mediapipe and only load when someone taps the button; the browser caches them after that.
const BASE = '/vendor/mediapipe';

type Segmenter = import('@mediapipe/tasks-vision').ImageSegmenter;
let segmenter: Promise<Segmenter> | null = null;

function getSegmenter(): Promise<Segmenter> {
  if (!segmenter) {
    segmenter = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${BASE}/selfie_segmenter.tflite`, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })();
    segmenter.catch(() => { segmenter = null; }); // let a later tap try again
  }
  return segmenter;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the photo.'));
    img.src = src;
  });
}

/** The photo with everything but the person made transparent, as a PNG data URL, cropped to the person */
export async function removeBackground(src: string): Promise<string> {
  const [seg, img] = await Promise.all([getSegmenter(), loadImage(src)]);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const result = seg.segment(img);
  const mask = result.confidenceMasks?.[0];
  if (!mask) throw new Error('Could not find a person in the photo.');
  const conf = mask.getAsFloat32Array();
  const mw = mask.width;
  const mh = mask.height;

  // The mask as an alpha channel: soft edges between 0.35 and 0.75 confidence so hair and shirt edges blend
  const alpha = document.createElement('canvas');
  alpha.width = mw;
  alpha.height = mh;
  const actx = alpha.getContext('2d');
  if (!actx) throw new Error('Canvas is not available in this browser.');
  const data = actx.createImageData(mw, mh);
  let minX = mw, minY = mh, maxX = -1, maxY = -1;
  for (let i = 0; i < conf.length; i++) {
    const a = Math.min(1, Math.max(0, (conf[i] - 0.35) / 0.4));
    data.data[i * 4 + 3] = Math.round(a * 255);
    if (a > 0.5) {
      const x = i % mw;
      const y = (i / mw) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  result.close();
  if (maxX < 0 || (maxX - minX) * (maxY - minY) < mw * mh * 0.02) throw new Error('Could not find a person in the photo. Try one where they fill more of the picture.');
  actx.putImageData(data, 0, 0);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(alpha, 0, 0, w, h);

  // Crop to the person, with a little room around them
  const sx = w / mw;
  const sy = h / mh;
  const pad = Math.round(Math.max(w, h) * 0.02);
  const cx = Math.max(0, Math.floor(minX * sx) - pad);
  const cy = Math.max(0, Math.floor(minY * sy) - pad);
  const cw = Math.min(w, Math.ceil((maxX + 1) * sx) + pad) - cx;
  const ch = Math.min(h, Math.ceil((maxY + 1) * sy) + pad) - cy;
  const crop = document.createElement('canvas');
  crop.width = cw;
  crop.height = ch;
  crop.getContext('2d')?.drawImage(out, cx, cy, cw, ch, 0, 0, cw, ch);
  return crop.toDataURL('image/png');
}
