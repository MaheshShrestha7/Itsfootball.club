// Copies MediaPipe's WebAssembly runtime from node_modules into public/, so the result graphic maker's
// "Remove background" (lib/remove-background.ts) loads it from our own domain (the CSP allows no CDN).
// Runs before `next dev` and as part of `npm run build`. The files are ~22 MB, so they're not committed.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const from = 'node_modules/@mediapipe/tasks-vision/wasm';
const to = 'public/vendor/mediapipe/wasm';
const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];

if (!existsSync(from)) {
  console.warn(`copy-mediapipe: ${from} is missing, so Remove background won't work. Run npm install.`);
} else {
  mkdirSync(to, { recursive: true });
  for (const f of files) copyFileSync(`${from}/${f}`, `${to}/${f}`);
}
