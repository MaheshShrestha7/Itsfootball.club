// The 3D player in the home hero: a footballer juggling under floodlights, kit in the visitor's picked club colour.
// Plain three.js, loaded only when the band nears the screen (components/FootballBand.tsx), so none of this
// is in the first page load. Renders only while the band is on screen and the tab is open; steps quality
// down on slow devices; one still frame under prefers-reduced-motion.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

type Pose = Record<string, number>;
type Touch = 'rf' | 'lf' | 'rk' | 'h';
interface Els { band: HTMLElement; host: HTMLElement; kit?: string }

/** Builds the scene inside `els` and starts it. Resolves to a function that tears everything down.
 *  Rejects when WebGL or the model isn't available; the caller then keeps the still picture. */
export async function mountFootballBand({ band, host, kit }: Els): Promise<() => void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isLight = () => document.documentElement.dataset.theme === 'light';
  const phone = () => band.clientWidth < 760;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  let dprCap = 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  const camBase = new THREE.Vector3(0.3, 1.3, 6.0);
  const camLook = new THREE.Vector3(0, 1.05, 0);

  // ---------- Cinematic floodlights ----------
  const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x0b2a1c, 0.35);
  scene.add(hemi);
  const key = new THREE.SpotLight(0xf4f8ff, 120, 30, 0.42, 0.55, 1.6);
  key.position.set(-5, 8.5, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.SpotLight(0xd8e6ff, 60, 30, 0.5, 0.7, 1.6);
  fill.position.set(3, 4, 7);
  scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0x34f5b0, 1.6); // club-green rim from behind
  rim.position.set(1, 3, -5);
  scene.add(rim);

  // ---------- Pitch: mown stripes, neon centre circle, soft edge ----------
  function pitchTexture(light: boolean) {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 16; i++) { g.fillStyle = (i % 2) ? (light ? '#2f8a4c' : '#0f3a24') : (light ? '#2a7d44' : '#0c321f'); g.fillRect(i * 64, 0, 64, 1024); }
    g.strokeStyle = light ? 'rgba(255,255,255,.85)' : 'rgba(52,245,176,.9)'; g.lineWidth = 6;
    g.shadowColor = light ? 'transparent' : 'rgba(52,245,176,.8)'; g.shadowBlur = 18;
    g.beginPath(); g.arc(512, 512, 220, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(0, 512); g.lineTo(1024, 512); g.stroke();
    g.beginPath(); g.arc(512, 512, 8, 0, Math.PI * 2); g.fillStyle = g.strokeStyle; g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function edgeFade() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!; const r = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  const groundMat = new THREE.MeshStandardMaterial({ map: pitchTexture(isLight()), alphaMap: edgeFade(), transparent: true, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.rotation.z = Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // In the hero he stands on a small floodlit patch of the same pitch, fading out into the hero's own
  ground.scale.setScalar(0.32);
  { // soft studio reflections so skin and kit shade like real materials
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22; pm.dispose();
  }

  // ---------- The player: a rigged footballer (Microsoft Rocketbox "Sports_Male_02", MIT licence, see
  // public/models/LICENSE-player-model.txt) with the kit repainted; the juggling is driven in code ----------
  const player = new THREE.Group(); scene.add(player);
  // Textures come as plain images, not inside the .glb: the loader would fetch embedded ones from blob: URLs, which the site's CSP (connect-src 'self') blocks.
  const texLoader = new THREE.TextureLoader();
  const [gltf, bodyTex, headTex] = await Promise.all([
    new GLTFLoader().loadAsync('/models/player.glb'),
    texLoader.loadAsync('/models/player-body.jpg'),
    texLoader.loadAsync('/models/player-head.jpg'),
  ]);
  for (const t of [bodyTex, headTex]) { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  // Club colours: repaint the green kit (shirt + socks) in the visitor's picked colour, keeping the cloth's shading.
  // The mask is worked out once; each pick only rewrites those pixels. The band listens for 'fb-kit' events.
  const kitSrc = bodyTex.image as HTMLImageElement;
  const kc = document.createElement('canvas'); kc.width = kitSrc.width; kc.height = kitSrc.height;
  const kx = kc.getContext('2d', { willReadFrequently: true })!; kx.drawImage(kitSrc, 0, 0);
  const kitBase = kx.getImageData(0, 0, kc.width, kc.height);
  const kitPx: number[] = [];
  for (let i = 0; i < kitBase.data.length; i += 4) {
    const r = kitBase.data[i], g = kitBase.data[i + 1], b = kitBase.data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (g === mx && mx > 40 && (mx - mn) / mx > 0.35 && g - r > 30) kitPx.push(i); // green, saturated: the kit
  }
  const kitTex = new THREE.CanvasTexture(kc); kitTex.flipY = false; kitTex.colorSpace = THREE.SRGBColorSpace; kitTex.anisotropy = 4;
  function paintKit(hex?: string) {
    const out = new ImageData(new Uint8ClampedArray(kitBase.data), kc.width, kc.height);
    if (hex && hex.toLowerCase() !== '#10b981') {
      const t = new THREE.Color(hex).convertLinearToSRGB(); const tr = t.r * 255, tg = t.g * 255, tb = t.b * 255;
      for (const i of kitPx) { const k = kitBase.data[i + 1] / 185; out.data[i] = tr * k; out.data[i + 1] = tg * k; out.data[i + 2] = tb * k; } // keep the folds' light and shade
    }
    kx.putImageData(out, 0, 0); kitTex.needsUpdate = true;
  }
  paintKit(kit);
  const onKit = (e: Event) => { paintKit((e as CustomEvent<string>).detail); if (!running) renderOnce(); };
  band.addEventListener('fb-kit', onKit);
  const model = gltf.scene; player.add(model);
  const skinned: THREE.SkinnedMesh[] = [];
  model.traverse(o => {
    const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return;
    m.castShadow = true; m.frustumCulled = false; skinned.push(m);
    for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) { mat.map = /head/.test(mat.name) ? headTex : kitTex; mat.needsUpdate = true; }
  });
  model.updateMatrixWorld(true);
  const bone = (n: string) => { const b = model.getObjectByName('Bip01_' + n); if (!b) throw new Error('missing bone ' + n); return b; };
  const wp = (n: string) => bone(n).getWorldPosition(new THREE.Vector3());
  let headTopY = 0.2;
  { // stand 1.8 m tall with feet on the grass (measured from the mesh itself in its bind pose)
    let min = Infinity, max = -Infinity; const v = new THREE.Vector3();
    for (const o of skinned) { const n = o.geometry.attributes.position.count; for (let i = 0; i < n; i += 3) { o.getVertexPosition(i, v); o.localToWorld(v); min = Math.min(min, v.y); max = Math.max(max, v.y); } }
    const k = 1.8 / (max - min); model.scale.multiplyScalar(k); model.position.y = -min * k; model.updateMatrixWorld(true);
    headTopY = 1.8 - wp('Head').y;
  }
  // "N" is the leg and arm on the +x side (nearer the camera once he turns), "F" the far side
  const [N, F] = wp('L_Thigh').x > 0 ? ['L', 'R'] : ['R', 'L'];

  // Each joint turns about the model's own axes (x = side to side, y = up, z = forward), measured from its parent's
  // bind pose, so the same pose numbers work whatever way the rig's bones happen to point.
  const J: Record<string, { b: THREE.Object3D; bind: THREE.Quaternion; c: THREE.Quaternion; ci: THREE.Quaternion }> = {};
  for (const n of ['Spine', 'Spine2', 'Neck', 'Head', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot', 'L_UpperArm', 'L_Forearm', 'R_UpperArm', 'R_Forearm']) {
    const b = bone(n), c = b.parent!.getWorldQuaternion(new THREE.Quaternion());
    J[n] = { b, bind: b.quaternion.clone(), c, ci: c.clone().invert() };
  }
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
  function setQ(n: string, q: THREE.Quaternion) { const j = J[n]; j.b.quaternion.copy(j.ci).multiply(q).multiply(j.c).multiply(j.bind); }
  function turn(n: string, x = 0, y = 0, z = 0) { setQ(n, Q.setFromEuler(E.set(x, y, z, 'ZYX'))); }
  // Arms start in an A-pose: work out how far they already hang and which way the elbow bends
  const arm: Record<string, { sign: number; hang: number; elbowAxis: THREE.Vector3 }> = {};
  for (const s of [N, F]) {
    const d = wp(s + '_Forearm').sub(wp(s + '_UpperArm')).normalize(), sign = Math.sign(d.x);
    arm[s] = { sign, hang: Math.atan2(-d.y, Math.abs(d.x)), elbowAxis: new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1)).normalize() };
  }
  function setArm(s: string, out: number, fwdSwing: number, elbow: number) {
    const a = arm[s];
    setQ(s + '_UpperArm', Q.setFromEuler(E.set(-fwdSwing, 0, -a.sign * (Math.PI / 2 - a.hang - out), 'ZYX')));
    setQ(s + '_Forearm', Q2.setFromAxisAngle(a.elbowAxis, elbow));
  }
  // Hips move up and down through the rig's root
  const root = bone('Pelvis').parent!, rootBind = root.position.clone();
  const rootUp = new THREE.Vector3(0, 1, 0).applyQuaternion(root.parent!.getWorldQuaternion(new THREE.Quaternion()).invert()).divideScalar(root.parent!.getWorldScale(new THREE.Vector3()).y);

  // Poses are offsets from standing; touches blend in and out around the contact moment. "r" is the near leg.
  const REST: Pose = {
    hipsY: 0, spineX: 0.06, headX: 0.12, headY: 0,
    rHip: -0.05, rKnee: 0.12, rAnkle: -0.05, lHip: -0.05, lKnee: 0.12, lAnkle: -0.05,
    rArmZ: 0.28, rArmX: 0.1, rElbow: 0.45, lArmZ: 0.28, lArmX: 0.1, lElbow: 0.45,
  };
  const PEAK: Record<Touch, Pose> = {
    rf: { rHip: -0.95, rKnee: 0.75, rAnkle: 0.2, lKnee: 0.25, hipsY: -0.03, rArmZ: 0.7, lArmZ: 0.75, spineX: 0.12, headX: 0.45 },
    lf: { lHip: -0.95, lKnee: 0.75, lAnkle: 0.2, rKnee: 0.25, hipsY: -0.03, rArmZ: 0.75, lArmZ: 0.7, spineX: 0.12, headX: 0.45 },
    rk: { rHip: -1.5, rKnee: 1.55, rAnkle: 0.1, lKnee: 0.2, hipsY: -0.02, rArmZ: 0.85, lArmZ: 0.85, headX: 0.5 },
    h: { spineX: -0.18, headX: -0.35, rKnee: 0.4, lKnee: 0.4, rHip: -0.25, lHip: -0.25, hipsY: -0.08, rArmZ: 0.55, lArmZ: 0.55, rElbow: 1.0, lElbow: 1.0 },
  };
  function applyPose(p: Pose) {
    root.position.copy(rootBind).addScaledVector(rootUp, p.hipsY);
    turn('Spine', p.spineX * 0.5); turn('Spine2', p.spineX * 0.5); turn('Neck', p.headX * 0.4, p.headY * 0.4); turn('Head', p.headX * 0.6, p.headY * 0.6);
    turn(N + '_Thigh', p.rHip); turn(N + '_Calf', p.rKnee); turn(N + '_Foot', p.rAnkle);
    turn(F + '_Thigh', p.lHip); turn(F + '_Calf', p.lKnee); turn(F + '_Foot', p.lAnkle);
    setArm(N, p.rArmZ, p.rArmX, p.rElbow); setArm(F, p.lArmZ, p.lArmX, p.lElbow);
    model.updateMatrixWorld(true);
  }
  function blendPose(weights: [Touch, number][]) {
    const p = { ...REST };
    for (const [kind, w] of weights) for (const k in PEAK[kind]) p[k] += (PEAK[kind][k] - REST[k]) * w;
    return p;
  }
  // Where the ball meets the body for each kind of touch
  const fwd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const facing = () => fwd.set(0, 0, 1).applyQuaternion(player.quaternion);
  const EFFECTOR: Record<Touch, () => THREE.Vector3> = {
    rf: () => wp(N + '_Foot').lerp(wp(N + '_Toe0'), 0.7).addScaledVector(UP, 0.07),
    lf: () => wp(F + '_Foot').lerp(wp(F + '_Toe0'), 0.7).addScaledVector(UP, 0.07),
    rk: () => wp(N + '_Calf').addScaledVector(facing(), 0.04).addScaledVector(UP, 0.08),
    h: () => wp('Head').addScaledVector(UP, headTopY * 0.98).addScaledVector(facing(), 0.07),
  };

  // ---------- Ball: textured panels, real gravity between touches, spin from each touch ----------
  const BALL_R = 0.11;
  function ballTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d')!; g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 512, 256);
    const hex = (x: number, y: number, r: number, col: string) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); g.fillStyle = col; g.fill(); };
    [[64, 64], [192, 128], [320, 64], [448, 128], [64, 200], [320, 200]].forEach(([x, y], i) => hex(x, y, 34, i % 2 ? '#0f172a' : '#10b981'));
    g.strokeStyle = 'rgba(15,23,42,.25)'; g.lineWidth = 2; for (let x = 0; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, 256); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.35 }));
  ball.castShadow = true; scene.add(ball);
  const spin = new THREE.Vector3();
  const G = new THREE.Vector3(0, -9.81, 0);

  // Touch rhythm: real flight times (0.7 s foot to foot ≈ 0.6 m rise)
  const RHYTHM: [Touch, number][] = [['rf', 0.72], ['lf', 0.72], ['rf', 0.72], ['rk', 0.8], ['rf', 0.95], ['h', 0.6], ['lf', 0.72], ['rf', 0.72], ['lf', 0.72]];
  const contact = {} as Record<Touch, THREE.Vector3>;
  function measureContacts() {
    player.rotation.y = phone() ? -0.55 : -0.8; player.updateMatrixWorld(true);
    for (const kind of Object.keys(PEAK) as Touch[]) {
      applyPose(blendPose([[kind, 1]]));
      const p = EFFECTOR[kind](); p.y += BALL_R * 0.95;
      contact[kind] = p;
    }
    applyPose(REST);
  }

  // ---------- Floodlight glare + drifting particles ----------
  function glowTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(220,235,255,.55)'); r.addColorStop(1, 'rgba(220,235,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  const glow = glowTex();
  const glares = [[-7, 7.5, -9], [-3.5, 8, -11], [3.5, 8, -11], [7, 7.5, -9]].map(([x, y, z]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xe8f1ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(x, y, z); s.scale.setScalar(3.2); scene.add(s); return s;
  });
  const PCOUNT = phone() ? 160 : 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PCOUNT * 3), pSpd = new Float32Array(PCOUNT);
  for (let i = 0; i < PCOUNT; i++) { pPos[i * 3] = (Math.random() - 0.5) * 14; pPos[i * 3 + 1] = Math.random() * 6; pPos[i * 3 + 2] = -6 + Math.random() * 8; pSpd[i] = 0.05 + Math.random() * 0.12; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glow, size: 0.07, color: 0xbff7e0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(particles);

  const FEET_PX = 34; // in the hero his soles sit this far above the canvas bottom, on the patch of pitch
  // ---------- Layout ----------
  function layout() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit about 2.24 m of height and at least 1.9 m of width, his soles FEET_PX above the canvas bottom
    const k = Math.tan(THREE.MathUtils.degToRad(15)), d = Math.max(1.12 / k, 0.95 / (k * camera.aspect)), half = d * k;
    const x = 0.15, cy = half * (1 - 2 * FEET_PX / h);
    player.position.set(x, 0, 0); camBase.set(0, cy, d); camLook.set(0, cy, 0); camera.fov = 30;
    ground.position.x = x;
    camera.position.copy(camBase); camera.lookAt(camLook); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    key.target.position.copy(player.position); fill.target.position.copy(player.position);
    measureContacts();
  }

  // ---------- Theme: follows <html data-theme> ----------
  function applyTheme() {
    const light = isLight();
    groundMat.map?.dispose(); groundMat.map = pitchTexture(light); groundMat.needsUpdate = true;
    hemi.intensity = light ? 1.1 : 0.35; key.intensity = light ? 160 : 120; rim.intensity = light ? 0.6 : 1.6;
    renderer.toneMappingExposure = light ? 1.0 : 1.05;
    glares.forEach(s => (s.material.opacity = light ? 0.25 : 1));
    particles.material.opacity = light ? 0.35 : 0.55;
    particles.material.color.set(light ? 0xffffff : 0xbff7e0);
    if (!running) renderOnce();
  }

  // ---------- Main loop ----------
  let step = 0, t0 = 0, clock = 0, running = false, visible = false, raf = 0, last = 0;
  const pointer = new THREE.Vector2();
  const onMove = (e: PointerEvent) => { const r = band.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5); };
  const onLeave = () => pointer.set(0, 0);

  const gauss = (dt: number, w = 0.15) => Math.exp(-((dt / w) ** 2));
  function ballAt(time: number) {
    const [kind, T] = RHYTHM[step];
    const next = RHYTHM[(step + 1) % RHYTHM.length][0];
    const p0 = contact[kind], p1 = contact[next];
    const dt = time - t0;
    const v = p1.clone().sub(p0).divideScalar(T).addScaledVector(G, -0.5 * T);
    return p0.clone().addScaledVector(v, dt).addScaledVector(G, 0.5 * dt * dt);
  }

  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), headLocal = new THREE.Vector3(0, 1.7, 0);
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dtReal = Math.min((now - (last || now)) / 1000, 1 / 20); last = now;
    trackFps(dtReal);
    clock += dtReal;
    let [kind, T] = RHYTHM[step];
    if (clock - t0 >= T) {
      t0 += T; step = (step + 1) % RHYTHM.length; [kind, T] = RHYTHM[step];
      const k = kind === 'h' ? 1 : -1; spin.set(k * (14 + Math.random() * 6), (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
    }
    const nextT = t0 + T, nextKind = RHYTHM[(step + 1) % RHYTHM.length][0];
    const pose = blendPose([[kind, gauss(clock - t0)], [nextKind, gauss(clock - nextT)]]);
    const b = ballAt(clock);
    ball.position.copy(b);
    // Eyes on the ball; a little breathing sway in the body
    const toBall = player.worldToLocal(b.clone()).sub(headLocal);
    pose.headY = THREE.MathUtils.clamp(Math.atan2(toBall.x, Math.max(toBall.z, 0.1) + 0.4), -1.1, 1.1) * 0.8;
    pose.headX = Math.max(pose.headX, THREE.MathUtils.clamp(-Math.atan2(toBall.y, 0.8), -0.5, 0.5));
    pose.spineX += Math.sin(clock * 2.1) * 0.015;
    applyPose(pose);
    // Spin decays with air drag
    spin.multiplyScalar(1 - 0.25 * dtReal);
    ball.rotateOnWorldAxis(X, spin.x * dtReal);
    ball.rotateOnWorldAxis(Y, spin.y * dtReal);
    driftParticles(dtReal);
    // Camera: a small pointer parallax, kept small so his feet stay on the patch of pitch
    camera.position.set(camBase.x + pointer.x * 0.125, camBase.y - pointer.y * 0.06, camBase.z);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  }
  function driftParticles(dt: number) {
    const a = pGeo.attributes.position.array;
    for (let i = 0; i < PCOUNT; i++) { a[i * 3 + 1] += pSpd[i] * dt; a[i * 3] += Math.sin(clock + i) * 0.02 * dt; if (a[i * 3 + 1] > 6) a[i * 3 + 1] = 0; }
    pGeo.attributes.position.needsUpdate = true;
  }

  // Adaptive quality: if frames run slow for two seconds, drop the pixel ratio, then shadows and particles.
  let acc = 0, n = 0, slow = 0, tier = 0;
  function trackFps(dt: number) {
    acc += dt; n++;
    if (acc < 0.5) return;
    slow = n / acc < 50 ? slow + 1 : 0;
    if (slow >= 4 && tier < 2) {
      tier++; slow = 0;
      if (tier === 1) { dprCap = 1.25; renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap)); layout(); }
      if (tier === 2) { renderer.shadowMap.enabled = false; particles.visible = false; dprCap = 1; renderer.setPixelRatio(1); layout(); }
    }
    acc = 0; n = 0;
  }

  function renderOnce() {
    // The resting frame (also all that reduced motion shows): ball at the top of a juggle, nothing moving
    step = 0; t0 = 0; clock = 0.36;
    applyPose(blendPose([])); ball.position.copy(ballAt(0.36)); ball.rotation.set(0.4, 0.6, 0);
    camera.position.copy(camBase); camera.lookAt(camLook);
    renderer.render(scene, camera);
  }
  function start() { if (running || reduce.matches) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function sync() { if (visible && !document.hidden && !reduce.matches) start(); else stop(); if (reduce.matches) renderOnce(); }

  layout();
  applyTheme();
  host.appendChild(renderer.domElement);
  const ro = new ResizeObserver(() => { layout(); if (!running) renderOnce(); });
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '100px' });
  io.observe(band);
  const mo = new MutationObserver(applyTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', sync);
  band.addEventListener('pointermove', onMove);
  band.addEventListener('pointerleave', onLeave);

  return () => {
    stop(); ro.disconnect(); io.disconnect(); mo.disconnect();
    document.removeEventListener('visibilitychange', sync);
    reduce.removeEventListener('change', sync);
    band.removeEventListener('pointermove', onMove);
    band.removeEventListener('pointerleave', onLeave);
    band.removeEventListener('fb-kit', onKit); bodyTex.dispose();
    scene.traverse(o => {
      const m = o as THREE.Mesh; m.geometry?.dispose();
      for (const mat of [m.material].flat() as (THREE.MeshStandardMaterial | undefined)[]) { mat?.map?.dispose(); mat?.alphaMap?.dispose(); mat?.dispose(); }
    });
    renderer.dispose(); renderer.domElement.remove();
  };
}
