'use client';

import React, { useEffect, useRef } from 'react';

/** A sheet of silk in the club's two colours, rolling slowly like a flag, with the shirt number
 *  printed on it so it bends and catches the light with the folds. Drawn by a small WebGL shader
 *  at half resolution, paused off screen; a still frame under reduced motion. Without WebGL it
 *  draws nothing and the card keeps its plain glass look (and its CSS number).
 *
 *  Place it as the first child of a positioned card. `numberSelector` names the card's own number
 *  element: its CSS box and tilt place the printed number, and it is hidden once the silk is on. */
interface Props {
  primary?: string | null;
  secondary?: string | null;
  numberSelector: string;
  /** Changes when the card shows someone else, so their number is printed and fades in; null = no number */
  number: string | number | null;
}

const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0.,1.); }';
const FS = `precision mediump float;
varying vec2 uv; uniform float t; uniform vec2 res; uniform vec3 ca, cb; uniform sampler2D num; uniform vec4 box; uniform float ink;
float h(vec2 q){
  // Folds run mostly one way (long ripples), like silk hanging from a pole
  vec2 r = vec2(q.x*0.82 + q.y*0.57, -q.x*0.57 + q.y*0.82);
  float w = sin(r.x*2.1 + t*0.50 + sin(r.y*1.1 + t*0.27)*1.3);
  float w2 = sin(r.x*3.6 - t*0.33 + sin(r.y*0.9 - t*0.2)*1.8 + 1.7);
  float w3 = sin(r.x*6.5 + t*0.8 + r.y*0.8);
  return w*0.6 + w2*0.32 + w3*0.08;
}
void main(){
  vec2 q = uv * vec2(res.x/res.y, 1.) * 3.2;
  float e = 0.01;
  float hc = h(q);
  vec2 g = vec2(h(q+vec2(e,0.))-hc, h(q+vec2(0.,e))-hc)/e;
  vec3 n = normalize(vec3(-g*0.55, 1.));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
  float dif = pow(clamp(dot(n,L), 0., 1.), 1.6);
  vec3 H = normalize(L + vec3(0.,0.,1.));
  float spec = pow(clamp(dot(n,H),0.,1.), 60.) * 0.6;
  // Calmer highlights behind the name and stats, so white text always reads
  spec *= 0.45 + 0.55*smoothstep(0.2, 0.75, uv.x);
  float m = smoothstep(-0.25, 0.25, sin((uv.x*0.9 - uv.y*0.6)*3.14159 + hc*0.7 + t*0.1));
  vec3 col = mix(ca, cb, m*0.85);
  col *= 0.30 + 0.85*dif;
  col += spec;
  // The shirt number, printed on the cloth: it bends with the folds and catches the same light
  vec2 nu = (uv - box.xy)/box.zw + g*0.012;
  float a = 0.;
  if (nu.x>0. && nu.x<1. && nu.y>0. && nu.y<1.) a = texture2D(num, vec2(nu.x, 1.-nu.y)).a;
  vec3 print = vec3(1.) * (0.55 + 0.6*dif) + spec*0.6;
  col = mix(col, print, a*0.42*ink);
  gl_FragColor = vec4(col, 1.);
}`;

const rgb = (hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return fallback;
  return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255) as [number, number, number];
};
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// Both colours kept dark enough for white text on top
const tame = (c: number[]) => { const l = lum(c); const k = l > 0.45 ? 0.45 / l : 1; return c.map(v => v * k); };

/** The two silk colours; a light second colour (white, yellow) becomes a pale tint of the first */
export function silkColours(primary?: string | null, secondary?: string | null) {
  const a = tame(rgb(primary, [0.06, 0.73, 0.51]));
  const bRaw = rgb(secondary, [0.06, 0.09, 0.16]);
  const b = lum(bRaw) > 0.45 ? a.map((v, i) => v * 0.6 + tame(bRaw)[i] * 0.4 + 0.08) : tame(bRaw);
  return { a, b };
}

export default function SilkBackdrop({ primary, secondary, numberSelector, number }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const card = cv?.parentElement;
    if (!cv || !card) return;
    const gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const shader = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(pr, n);
    const { a, b } = silkColours(primary, secondary);
    gl.uniform3fv(U('ca'), a);
    gl.uniform3fv(U('cb'), b);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U('num'), 0);
    gl.uniform4f(U('box'), -1, -1, 0.001, 0.001);

    // The number: drawn into a texture over its own CSS box (padded for the tilt), same font and tilt
    const nc = document.createElement('canvas');
    const printNumber = () => {
      const el = card.querySelector<HTMLElement>(numberSelector);
      const cw = card.clientWidth, ch = card.clientHeight;
      if (!el || !cw || !ch || number == null || !el.textContent) { gl.uniform4f(U('box'), -1, -1, 0.001, 0.001); return; }
      const pad = 0.25;
      const w = el.offsetWidth * (1 + pad * 2), hgt = el.offsetHeight * (1 + pad * 2);
      const scale = Math.min(2, 1024 / Math.max(w, hgt));
      nc.width = Math.max(2, Math.round(w * scale)); nc.height = Math.max(2, Math.round(hgt * scale));
      const x = nc.getContext('2d')!;
      const cs = getComputedStyle(el);
      x.clearRect(0, 0, nc.width, nc.height);
      x.scale(scale, scale);
      x.translate(w / 2, hgt / 2);
      x.rotate(-10 * Math.PI / 180);
      x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('letterSpacing' in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = '#fff';
      x.fillText(el.textContent || '', 0, el.offsetHeight * 0.04);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nc);
      const left = el.offsetLeft - el.offsetWidth * pad, top = el.offsetTop - el.offsetHeight * pad;
      gl.uniform4f(U('box'), left / cw, 1 - (top + hgt) / ch, w / cw, hgt / ch);
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = false, raf = 0, seenAt = 0;
    const size = () => {
      const r = card.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
      cv.width = Math.max(2, Math.round(r.width * d)); cv.height = Math.max(2, Math.round(r.height * d));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(U('res'), r.width, r.height);
      printNumber();
    };
    const t0 = performance.now();
    const draw = (now: number) => {
      const tt = reduce ? 2 : (now - t0) / 1000;
      gl.uniform1f(U('t'), tt);
      // The number fades in (and rises a touch) the first time the card is seen
      const k = reduce ? 1 : Math.min(1, seenAt ? (now - seenAt) / 700 : 0);
      gl.uniform1f(U('ink'), 1 - Math.pow(1 - k, 3));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const loop = (now: number) => { draw(now); raf = visible && !reduce ? requestAnimationFrame(loop) : 0; };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };

    const ro = new ResizeObserver(() => { size(); if (!raf) draw(performance.now()); });
    ro.observe(card);
    const io = new IntersectionObserver(es => {
      visible = es.some(e => e.isIntersecting);
      if (visible) { if (!seenAt) seenAt = performance.now(); start(); }
    }, { threshold: 0.15 });
    io.observe(card);
    size();
    // Marked on the canvas (React owns the card's class list): CSS hides the card's own number
    cv.dataset.on = '1';
    // Web fonts may land after the first print
    document.fonts?.ready.then(() => { printNumber(); if (!raf) draw(performance.now()); });

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      delete cv.dataset.on;
      gl.deleteTexture(tex); gl.deleteBuffer(buf); gl.deleteProgram(pr);
    };
  }, [primary, secondary, numberSelector, number]);

  return <canvas ref={ref} className="silk-backdrop" aria-hidden="true" />;
}
