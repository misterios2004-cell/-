// Процедурные 3D-модели: свиньи, оружие, техника, постройки, растительность, ящики.
import { THREE, rnd, clamp } from './core.js';

/* ---------------- текстуры, нарисованные на canvas ---------------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}
export const TEX = {};
export function initTextures() {
  // Зернистость земли: травинки и комья, умножается на цвет вершин.
  TEX.ground = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#e8e8e8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { const v = 200 + Math.random() * 55 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1;
    for (let i = 0; i < 900; i++) { const px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-2, 2), py - rnd(3, 7)); x.stroke(); }
    x.strokeStyle = 'rgba(120,120,120,.35)';
    for (let i = 0; i < 500; i++) { const px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-2, 2), py - rnd(2, 5)); x.stroke(); }
  }, 56);
  TEX.soft = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });
  TEX.smoke = canvasTex(128, 128, (x) => {
    for (let i = 0; i < 14; i++) {
      const cx = 64 + rnd(-24, 24), cy = 64 + rnd(-24, 24), r = rnd(18, 34);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
  });
  TEX.flash = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.25, 'rgba(255,210,90,.95)'); g.addColorStop(0.6, 'rgba(240,110,30,.5)'); g.addColorStop(1, 'rgba(200,60,10,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });
  TEX.wood = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#8a6238'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#7c5630' : '#946a3e'; x.fillRect(0, i * 32, w, 30); }
    x.strokeStyle = 'rgba(40,24,10,.5)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); }
    x.strokeStyle = 'rgba(40,24,10,.25)'; x.lineWidth = 1;
    for (let i = 0; i < 30; i++) { const y = Math.random() * h; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(40, y + 3, 80, y - 3, w, y); x.stroke(); }
  });
  TEX.stone = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#7d766a'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 5; col++) {
      const v = 105 + Math.random() * 40 | 0; x.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      x.fillRect(col * 28 + (row % 2) * 14 - 14, row * 16, 26, 14);
    }
  });
  TEX.concrete = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#8e8b82'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 110 + Math.random() * 50 | 0; x.fillStyle = `rgba(${v},${v},${v - 5},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = 'rgba(60,55,50,.35)'; x.fillRect(0, 60, w, 3);
  });
  TEX.sandbag = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#b39d6c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,40' : '220,200,150'},.3)`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    x.strokeStyle = 'rgba(80,60,30,.5)'; x.beginPath(); x.moveTo(0, 32); x.lineTo(w, 32); x.stroke();
  });
  const crateTex = (bg, draw) => canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.lineWidth = 4; x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, h - 8); x.stroke();
    draw(x, w, h);
  });
  TEX.crateWeapon = crateTex('#5f6b3a', (x) => {
    x.fillStyle = '#efe5c8'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillRect(30, 50, 68, 28); x.fillStyle = '#5f6b3a'; x.fillText('?', 64, 66);
  });
  TEX.crateHealth = crateTex('#e8e2d2', (x) => { x.fillStyle = '#c8322a'; x.fillRect(52, 28, 24, 72); x.fillRect(28, 52, 72, 24); });
}

/* ---------------- материалы ---------------- */
const matCache = new Map();
export function mat(color, opts = {}) {
  const { unique, ...rest } = opts;
  const key = color + JSON.stringify(rest);
  if (!unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, ...rest });
  if (!unique) matCache.set(key, m);
  return m;
}
const G = {};
function geo() {
  if (G.sphere) return G;
  G.sphere = new THREE.SphereGeometry(1, 16, 12);
  G.sphereLo = new THREE.SphereGeometry(1, 8, 6);
  G.box = new THREE.BoxGeometry(1, 1, 1);
  G.cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  G.cylLo = new THREE.CylinderGeometry(1, 1, 1, 7);
  G.cone = new THREE.ConeGeometry(1, 1, 10);
  G.coneLo = new THREE.ConeGeometry(1, 1, 7);
  G.dome = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  G.torus = new THREE.TorusGeometry(1, 0.12, 6, 18);
  G.ico = new THREE.IcosahedronGeometry(1, 0);
  G.dodeca = new THREE.DodecahedronGeometry(1, 0);
  return G;
}
function M(g, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(g, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; return m;
}

/* ---------------- свинья ---------------- */
const PINK = 0xF2A7AC, PINK_D = 0xD9808B, HOOF = 0x3b2a22;
export class HogModel {
  constructor(nation, rankId, rankLine) {
    geo();
    this.nation = nation; this.rankId = rankId;
    const root = this.root = new THREE.Group();
    const uni = mat(nation.color, { unique: true });
    this.uniMat = uni;
    const pink = mat(PINK), pinkD = mat(PINK_D), hoof = mat(HOOF), dark = mat(0x1d140e), white = mat(0xffffff), belt = mat(0x4a3322);
    // корпус
    const torso = this.torso = new THREE.Group(); torso.position.y = 0.78; root.add(torso);
    torso.add(M(G.sphere, pink, 0, 0, 0, 0.52, 0.47, 0.72));
    // китель закрывает грудь и плечи, круп остаётся розовым
    const coat = M(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), uni, 0, 0.0, 0.16, 0.555, 0.5, 0.58);
    coat.rotation.x = 0.35; torso.add(coat);
    torso.add(M(G.box, mat(0x5a4a2e), 0, 0.42, -0.12, 0.42, 0.26, 0.34)); // вещмешок
    torso.add(M(G.box, mat(0x4a3322), 0, 0.42, -0.12, 0.44, 0.05, 0.36));
    const beltM = M(G.torus, belt, 0, -0.06, 0, 0.53, 0.53, 0.74); beltM.rotation.x = Math.PI / 2; beltM.scale.set(0.53, 0.74, 0.53 * 0.5); torso.add(beltM);
    torso.add(M(G.box, mat(0xb8913a), 0, -0.07, 0.72, 0.12, 0.1, 0.04)); // пряжка
    if (rankLine === 'medic') { const band = M(G.cyl, white, 0.44, 0.08, 0.2, 0.2, 0.12, 0.2); band.rotation.z = Math.PI / 2; torso.add(band); torso.add(M(G.box, mat(0xc8322a), 0.55, 0.08, 0.2, 0.02, 0.08, 0.03)); torso.add(M(G.box, mat(0xc8322a), 0.55, 0.08, 0.2, 0.02, 0.03, 0.08)); }
    // хвостик
    const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.05, -0.7), new THREE.Vector3(0, 0.15, -0.82), new THREE.Vector3(0.08, 0.25, -0.78), new THREE.Vector3(0.02, 0.28, -0.7), new THREE.Vector3(-0.05, 0.2, -0.74), new THREE.Vector3(0, 0.3, -0.86)]);
    torso.add(M(new THREE.TubeGeometry(tailCurve, 16, 0.035, 5), pinkD));
    // голова
    const head = this.head = new THREE.Group(); head.position.set(0, 0.36, 0.6); torso.add(head);
    head.add(M(G.sphere, pink, 0, 0, 0, 0.4, 0.38, 0.4));
    head.add(M(G.sphere, pink, 0, -0.12, 0.08, 0.3, 0.22, 0.3)); // щёки
    const snout = M(G.cyl, pinkD, 0, -0.05, 0.4, 0.17, 0.2, 0.15); snout.rotation.x = Math.PI / 2; head.add(snout);
    head.add(M(G.cyl, mat(0xc26a76), 0, -0.05, 0.505, 0.15, 0.01, 0.13).rotateX(Math.PI / 2));
    for (const s of [-1, 1]) head.add(M(G.sphere, dark, s * 0.055, -0.05, 0.51, 0.03, 0.045, 0.02));
    this.eyes = []; this.pupils = [];
    for (const s of [-1, 1]) {
      const e = M(G.sphere, white, s * 0.15, 0.09, 0.3, 0.095, 0.1, 0.07); head.add(e); this.eyes.push(e);
      const p = M(G.sphere, dark, s * 0.15, 0.08, 0.36, 0.045, 0.05, 0.03); head.add(p); this.pupils.push(p);
      const brow = M(G.box, dark, s * 0.15, 0.21, 0.33, 0.14, 0.03, 0.03); brow.rotation.z = -s * 0.25; head.add(brow);
    }
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * 0.25, 0.26, -0.05);
      const e = M(G.cone, pinkD, 0, 0.12, 0, 0.13, 0.28, 0.06); ear.add(e);
      ear.rotation.z = -s * 0.7; ear.rotation.x = -0.3; head.add(ear); this.ears.push(ear);
    }
    this.hat = buildHat(nation, rankLine, rankId); head.add(this.hat);
    // ноги
    this.legs = [];
    for (const [lx, lz] of [[-0.26, 0.38], [0.26, 0.38], [-0.26, -0.36], [0.26, -0.36]]) {
      const leg = new THREE.Group(); leg.position.set(lx, 0.46, lz);
      leg.add(M(G.cyl, lz > 0 ? uni : pink, 0, -0.15, 0, 0.1, 0.3, 0.1));
      leg.add(M(G.cyl, pink, 0, -0.33, 0, 0.085, 0.14, 0.085));
      leg.add(M(G.cyl, hoof, 0, -0.43, 0, 0.09, 0.07, 0.09));
      root.add(leg); this.legs.push(leg);
    }
    // держатель оружия
    this.gunPivot = new THREE.Group(); this.gunPivot.position.set(0.3, 0.95, 0.2); root.add(this.gunPivot);
    this.backPivot = new THREE.Group(); this.backPivot.position.set(0, 1.12, -0.25); root.add(this.backPivot);
    this.weaponId = null;
    // состояние анимации
    this.t = Math.random() * 10; this.blinkT = rnd(1, 4); this.anim = 'idle'; this.hitT = 0; this.deadT = 0; this.lookT = 0; this.lookYaw = 0;
    this.bush = null;
    root.traverse(o => { if (o.isMesh) o.userData.hogPart = true; });
  }
  setWeapon(id) {
    if (this.weaponId === id) return;
    this.weaponId = id;
    this.gunPivot.clear(); this.backPivot.clear();
    if (!id) return;
    const w = buildWeaponModel(id);
    if (w.back) this.backPivot.add(w.back);
    if (w.hand) this.gunPivot.add(w.hand);
  }
  setHidden(on) {
    if (on && !this.bush) {
      this.bush = new THREE.Group();
      const leaf = mat(0x4d6b2d), leaf2 = mat(0x5f7d35);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; this.bush.add(M(G.ico, i % 2 ? leaf : leaf2, Math.cos(a) * 0.5, rnd(0.5, 1.1), Math.sin(a) * 0.5, rnd(0.45, 0.65))); }
      this.bush.add(M(G.ico, leaf, 0, 1.3, 0, 0.6));
      this.root.add(this.bush);
    }
    if (this.bush) this.bush.visible = on;
  }
  // state: idle | walk | run | air | swim | aim | dead | celebrate | sleep
  update(dt, state, pitch = 0) {
    this.t += dt;
    const t = this.t;
    const legs = this.legs, torso = this.torso;
    let swing = 0, freq = 0, bob = 0, tilt = 0, baseY = 0.78;
    if (state === 'walk') { freq = 9; swing = 0.55; bob = 0.04; }
    else if (state === 'run') { freq = 15; swing = 0.9; bob = 0.07; tilt = 0.12; }
    else if (state === 'swim') { freq = 10; swing = 0.9; baseY = 0.25; }
    const ph = t * freq;
    if (state === 'air') {
      legs[0].rotation.x = -0.7; legs[1].rotation.x = -0.7; legs[2].rotation.x = 0.7; legs[3].rotation.x = 0.7;
    } else if (state === 'dead' || state === 'sleep') {
      legs.forEach(l => { l.rotation.x = 0; });
    } else {
      legs[0].rotation.x = Math.sin(ph) * swing; legs[3].rotation.x = Math.sin(ph) * swing;
      legs[1].rotation.x = -Math.sin(ph) * swing; legs[2].rotation.x = -Math.sin(ph) * swing;
    }
    torso.position.y = baseY + Math.abs(Math.sin(ph)) * bob + (state === 'idle' || state === 'aim' ? Math.sin(t * 2.2) * 0.012 : 0);
    torso.rotation.x = tilt;
    const breathe = state === 'idle' || state === 'aim' ? 1 + Math.sin(t * 2.2) * 0.015 : 1;
    torso.scale.set(breathe, breathe, 1);
    // уши
    this.ears.forEach((e, i) => { const s = i ? 1 : -1; e.rotation.z = -s * (0.7 + Math.sin(t * (state === 'run' ? 20 : 3) + i) * (state === 'run' ? 0.25 : 0.05)); });
    // взгляд
    if (state === 'idle') {
      this.lookT -= dt; if (this.lookT <= 0) { this.lookT = rnd(1.5, 4); this.lookYaw = rnd(-0.5, 0.5); }
      this.head.rotation.y += (this.lookYaw - this.head.rotation.y) * dt * 3;
      this.head.rotation.x += (0 - this.head.rotation.x) * dt * 3;
    } else {
      this.head.rotation.y += (0 - this.head.rotation.y) * dt * 6;
      this.head.rotation.x += ((state === 'aim' ? -pitch * 0.4 : 0) - this.head.rotation.x) * dt * 6;
    }
    // моргание
    this.blinkT -= dt;
    const closed = state === 'sleep' || (this.blinkT < 0 && this.blinkT > -0.12);
    if (this.blinkT < -0.12) this.blinkT = rnd(2, 5);
    this.eyes.forEach(e => { e.scale.y = closed ? 0.015 : 0.1; });
    this.pupils.forEach(p => { p.visible = !closed && state !== 'dead'; });
    // оружие
    this.gunPivot.rotation.x = -pitch;
    this.gunPivot.visible = state !== 'swim' && state !== 'dead' && state !== 'sleep';
    // ранение
    if (this.hitT > 0) { this.hitT -= dt; this.root.rotation.z = Math.sin(this.hitT * 40) * 0.15 * this.hitT; }
    // смерть: свинья заваливается на бок
    if (state === 'dead') { this.deadT = Math.min(1, this.deadT + dt * 2); this.root.rotation.z = this.deadT * Math.PI / 2 * 0.95; this.eyes.forEach(e => { e.scale.y = 0.02; }); }
    else if (state === 'sleep') { this.root.rotation.z = Math.PI / 2 * 0.9; }
    else if (this.hitT <= 0) this.root.rotation.z *= 0.8;
    if (state === 'celebrate') { this.torso.position.y = baseY + Math.abs(Math.sin(t * 8)) * 0.35; this.root.rotation.y += dt * 4; }
  }
  hit() { this.hitT = 0.5; }
}
function buildHat(nation, line, rankId) {
  const g = new THREE.Group(), hat = nation.hat;
  const c = nation.color, darker = new THREE.Color(c).multiplyScalar(0.75).getHex();
  const brass = mat(0xC9A13A), fur = mat(0x5a4632), dark = mat(0x222222);
  if (hat === 'brodie') {
    g.add(M(G.cyl, mat(0x5d6636), 0, 0.3, 0, 0.5, 0.03, 0.5));
    g.add(M(G.dome, mat(0x5d6636), 0, 0.3, 0, 0.3, 0.2, 0.3));
  } else if (hat === 'adrian') {
    g.add(M(G.dome, mat(darker), 0, 0.28, 0, 0.36, 0.3, 0.38));
    g.add(M(G.cyl, mat(darker), 0, 0.27, 0.02, 0.44, 0.03, 0.46));
    g.add(M(G.box, mat(darker), 0, 0.58, 0, 0.04, 0.08, 0.42));
  } else if (hat === 'pickel') {
    g.add(M(G.dome, dark, 0, 0.26, 0, 0.37, 0.34, 0.39));
    g.add(M(G.cyl, dark, 0, 0.27, 0.1, 0.38, 0.03, 0.4));
    g.add(M(G.cone, brass, 0, 0.72, 0, 0.06, 0.24, 0.06));
    g.add(M(G.cyl, brass, 0, 0.58, 0, 0.08, 0.04, 0.08));
    g.add(M(G.box, brass, 0, 0.4, 0.36, 0.14, 0.12, 0.02));
  } else if (hat === 'cowboy') {
    const tan = mat(0x9a6a3a);
    const brim = M(G.cyl, tan, 0, 0.3, 0, 0.62, 0.035, 0.56); g.add(brim);
    g.add(M(G.cyl, tan, 0, 0.47, 0, 0.26, 0.32, 0.28));
    g.add(M(G.cyl, mat(0x4a2e18), 0, 0.37, 0, 0.27, 0.06, 0.29));
    g.add(M(G.box, mat(0x7c522a), 0, 0.64, 0, 0.05, 0.03, 0.4));
  } else if (hat === 'ushanka' || hat === 'horned') {
    const f = hat === 'horned' ? mat(0x4a2a5c) : fur;
    g.add(M(G.cyl, f, 0, 0.36, 0, 0.36, 0.3, 0.36));
    g.add(M(G.dome, f, 0, 0.5, 0, 0.36, 0.12, 0.36));
    for (const s of [-1, 1]) g.add(M(G.box, f, s * 0.36, 0.12, 0, 0.1, 0.34, 0.3));
    g.add(M(G.box, f, 0, 0.3, 0.32, 0.5, 0.18, 0.1));
    if (hat === 'ushanka') { const star = M(G.cone, mat(0xd42a1e), 0, 0.33, 0.38, 0.08, 0.02, 0.08); star.rotation.x = Math.PI / 2; g.add(star); }
    else for (const s of [-1, 1]) { const h = M(G.cone, mat(0xeee4d0), s * 0.34, 0.66, 0, 0.07, 0.36, 0.07); h.rotation.z = -s * 0.5; g.add(h); }
  } else if (hat === 'visor') {
    const y = mat(0xcaa04a);
    g.add(M(G.cyl, y, 0, 0.36, 0, 0.36, 0.2, 0.37));
    const v = M(new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, -Math.PI / 2, Math.PI), y, 0, 0.28, 0.18, 0.34, 0.03, 0.34); g.add(v);
    g.add(M(G.box, mat(0xd42a1e), 0, 0.4, 0.36, 0.06, 0.06, 0.02));
    for (const s of [-1, 1]) g.add(M(G.box, y, s * 0.3, 0.1, -0.1, 0.03, 0.26, 0.3));
  }
  if (line === 'medic') { const b = M(G.cyl, mat(0xffffff), 0, 0.36, 0, 0.375, 0.07, 0.375); g.add(b); g.add(M(G.box, mat(0xc8322a), 0, 0.36, 0.38, 0.1, 0.035, 0.02)); g.add(M(G.box, mat(0xc8322a), 0, 0.36, 0.38, 0.035, 0.07, 0.02)); }
  if (line === 'officer') { const star = M(G.ico, mat(0xE8B84A, { emissive: 0x3a2a00 }), 0, 0.5, 0.38, 0.07, 0.07, 0.03); g.add(star); }
  if (rankId === 'grunt') g.scale.setScalar(0.96);
  return g;
}

/* ---------------- оружие в руках ---------------- */
export function buildWeaponModel(id) {
  geo();
  const metal = mat(0x2f2f2a), wood = mat(0x6b4526), olive = mat(0x4E5B31), steel = mat(0x8a8d90), red = mat(0xb8322a);
  const hand = new THREE.Group(); let back = null;
  const barrel = (len, r, z0 = 0) => { const b = M(G.cyl, metal, 0, 0, z0 + len / 2, r, len, r); b.rotation.x = Math.PI / 2; return b; };
  switch (id) {
    case 'rifle': case 'rifleburst': case 'tranq':
      hand.add(M(G.box, wood, 0, -0.03, 0.1, 0.07, 0.1, 0.7)); hand.add(barrel(0.6, 0.025, 0.3)); break;
    case 'sniper':
      hand.add(M(G.box, wood, 0, -0.03, 0.1, 0.07, 0.1, 0.75)); hand.add(barrel(0.8, 0.025, 0.3));
      { const s = M(G.cyl, metal, 0, 0.08, 0.25, 0.04, 0.3, 0.04); s.rotation.x = Math.PI / 2; hand.add(s); } break;
    case 'pistol': hand.add(M(G.box, metal, 0, 0, 0.12, 0.06, 0.08, 0.24)); hand.add(M(G.box, wood, 0, -0.08, 0.04, 0.05, 0.12, 0.06)); break;
    case 'mg': case 'hmg':
      hand.add(M(G.box, metal, 0, 0, 0.15, 0.12, 0.14, 0.6)); hand.add(barrel(0.6, 0.04, 0.4));
      hand.add(M(G.cyl, metal, 0, -0.12, 0.15, 0.12, 0.06, 0.12)); break;
    case 'shotgun': case 'supershotgun':
      hand.add(M(G.box, wood, 0, -0.03, 0.05, 0.08, 0.1, 0.5));
      for (const s of (id === 'supershotgun' ? [-1, 1] : [0])) { const b = barrel(0.55, 0.035, 0.25); b.position.x = s * 0.035; hand.add(b); } break;
    case 'bazooka': case 'airburst': case 'firerain': {
      const tube = M(G.cyl, olive, 0, 0.12, 0.05, 0.1, 1.3, 0.1); tube.rotation.x = Math.PI / 2; hand.add(tube);
      hand.add(M(G.box, metal, 0, 0.25, 0.2, 0.03, 0.08, 0.06)); hand.add(M(G.box, metal, 0, 0.0, 0.1, 0.05, 0.14, 0.05)); break; }
    case 'mortar': { const t = M(G.cyl, olive, 0, 0, 0.2, 0.09, 0.6, 0.09); t.rotation.x = Math.PI / 2; hand.add(t); break; }
    case 'flamethrower':
      hand.add(M(G.box, metal, 0, 0, 0.2, 0.06, 0.08, 0.55)); hand.add(M(G.cyl, red, 0, 0.0, 0.5, 0.05, 0.05, 0.05));
      back = new THREE.Group(); for (const s of [-1, 1]) back.add(M(G.cyl, red, s * 0.13, 0, 0, 0.11, 0.55, 0.11)); break;
    case 'grenade': case 'shrapnel': case 'cluster':
      hand.add(M(G.sphere, olive, 0, 0.05, 0.15, 0.1, 0.12, 0.1)); hand.add(M(G.cyl, metal, 0, 0.18, 0.15, 0.03, 0.05, 0.03)); break;
    case 'gas': hand.add(M(G.cyl, mat(0x6b8a2a), 0, 0.05, 0.15, 0.07, 0.2, 0.07)); break;
    case 'medball': hand.add(M(G.sphere, mat(0xffffff), 0, 0.05, 0.15, 0.12)); hand.add(M(G.box, red, 0, 0.05, 0.27, 0.03, 0.12, 0.01)); break;
    case 'meddart': hand.add(M(G.box, mat(0xeeeeee), 0, 0, 0.15, 0.06, 0.08, 0.4)); hand.add(barrel(0.3, 0.02, 0.3)); break;
    case 'knife': hand.add(M(G.box, steel, 0, 0.0, 0.2, 0.01, 0.05, 0.3)); hand.add(M(G.box, wood, 0, 0, 0.0, 0.03, 0.05, 0.12)); break;
    case 'sword': hand.add(M(G.box, steel, 0, 0.0, 0.45, 0.012, 0.06, 0.8)); hand.add(M(G.box, mat(0xC9A13A), 0, 0, 0.05, 0.03, 0.16, 0.04)); break;
    case 'prod': hand.add(M(G.cyl, wood, 0, 0, 0.4, 0.025, 0.8, 0.025).rotateX(Math.PI / 2)); hand.add(M(G.box, mat(0xE8D24A, { emissive: 0x554400 }), 0, 0, 0.82, 0.12, 0.02, 0.05)); break;
    case 'tnt': for (let i = 0; i < 3; i++) hand.add(M(G.cyl, red, (i - 1) * 0.07, 0.05, 0.15, 0.035, 0.26, 0.035)); break;
    case 'mine': hand.add(M(G.cyl, olive, 0, 0.05, 0.2, 0.16, 0.06, 0.16)); break;
    case 'medkit': case 'selfheal': case 'healhands':
      hand.add(M(G.box, mat(0xffffff), 0, 0.05, 0.15, 0.2, 0.16, 0.08)); hand.add(M(G.box, red, 0, 0.05, 0.2, 0.12, 0.04, 0.01)); hand.add(M(G.box, red, 0, 0.05, 0.2, 0.04, 0.12, 0.01)); break;
    case 'jetpack': back = new THREE.Group(); for (const s of [-1, 1]) { back.add(M(G.cyl, steel, s * 0.14, 0, 0, 0.1, 0.5, 0.1)); back.add(M(G.cone, metal, s * 0.14, -0.3, 0, 0.08, 0.12, 0.08).rotateX(Math.PI)); } break;
    case 'airstrike': hand.add(M(G.box, mat(0x3a3a2a), 0, 0.05, 0.12, 0.12, 0.16, 0.06)); hand.add(M(G.cyl, metal, 0.04, 0.2, 0.12, 0.01, 0.2, 0.01)); break;
    default: break;
  }
  hand.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { hand, back };
}

/* ---------------- надгробие ---------------- */
export function buildGrave(nation) {
  geo();
  const g = new THREE.Group(), stone = mat(0x8d877c);
  g.add(M(G.box, stone, 0, 0.55, 0, 0.16, 1.1, 0.16));
  g.add(M(G.box, stone, 0, 0.8, 0, 0.6, 0.16, 0.16));
  g.add(M(G.box, mat(0x6b5a44), 0, 0.05, 0, 0.9, 0.1, 0.6));
  const hat = buildHat(nation, 'base', 'x'); hat.position.set(0, 0.8, 0); hat.scale.setScalar(0.7); g.add(hat);
  return g;
}

/* ---------------- техника ---------------- */
export function buildTank(nation) {
  geo();
  const g = new THREE.Group(), body = mat(new THREE.Color(nation.color).multiplyScalar(0.7).getHex()), dark = mat(0x2a2a26), metal = mat(0x4a4a44);
  g.add(M(G.box, body, 0, 0.95, 0, 2.2, 0.8, 3.4));
  g.add(M(G.box, body, 0, 1.35, -0.2, 1.9, 0.2, 2.6));
  for (const s of [-1, 1]) {
    g.add(M(G.box, dark, s * 1.2, 0.5, 0, 0.5, 0.8, 3.7));
    for (let i = 0; i < 5; i++) { const w = M(G.cyl, metal, s * 1.2, 0.45, -1.4 + i * 0.7, 0.32, 0.55, 0.32); w.rotation.z = Math.PI / 2; g.add(w); }
  }
  const turret = new THREE.Group(); turret.position.set(0, 1.45, -0.2); g.add(turret);
  turret.add(M(G.cyl, body, 0, 0.35, 0, 0.9, 0.6, 0.9));
  turret.add(M(G.dome, body, 0, 0.62, 0, 0.7, 0.25, 0.7));
  turret.add(M(G.cyl, dark, 0, 0.9, -0.2, 0.25, 0.12, 0.25));
  const gun = new THREE.Group(); gun.position.set(0, 0.4, 0.7); turret.add(gun);
  const b = M(G.cyl, metal, 0, 0, 1.0, 0.12, 2.0, 0.12); b.rotation.x = Math.PI / 2; gun.add(b);
  gun.add(M(G.cyl, metal, 0, 0, 2.0, 0.17, 0.25, 0.17).rotateX(Math.PI / 2));
  const star = M(G.box, mat(0xefe5c8), 1.11, 1.0, 0, 0.02, 0.4, 0.4); g.add(star);
  g.userData = { turret, gun };
  return g;
}
export function buildPillbox() {
  geo();
  const g = new THREE.Group();
  const c = new THREE.MeshLambertMaterial({ map: TEX.concrete });
  g.add(M(new THREE.CylinderGeometry(2.1, 2.4, 1.7, 8), c, 0, 0.85, 0));
  g.add(M(new THREE.CylinderGeometry(2.4, 2.3, 0.35, 8), c, 0, 1.85, 0));
  g.add(M(G.cyl, mat(0x141210), 0, 1.3, 0, 2.12, 0.28, 2.12));
  const pivot = new THREE.Group(); pivot.position.set(0, 1.3, 0); g.add(pivot);
  const gun = new THREE.Group(); gun.position.set(0, 0, 1.9); pivot.add(gun);
  const b = M(G.cyl, mat(0x2f2f2a), 0, 0, 0.5, 0.07, 1.0, 0.07); b.rotation.x = Math.PI / 2; gun.add(b);
  g.userData = { turret: pivot, gun };
  return g;
}
export function buildArtillery(nation) {
  geo();
  const g = new THREE.Group(), body = mat(new THREE.Color(nation ? nation.color : 0x5a6040).multiplyScalar(0.7).getHex()), metal = mat(0x3a3a34), wood = mat(0x6b4526);
  for (const s of [-1, 1]) {
    const w = M(G.cyl, wood, s * 0.9, 0.65, 0, 0.65, 0.12, 0.65); w.rotation.z = Math.PI / 2; g.add(w);
    const h = M(G.cyl, metal, s * 0.9, 0.65, 0, 0.14, 0.18, 0.14); h.rotation.z = Math.PI / 2; g.add(h);
  }
  g.add(M(G.box, body, 0, 0.5, -1.2, 0.3, 0.2, 2.2));
  const turret = new THREE.Group(); turret.position.set(0, 0.95, 0); g.add(turret);
  turret.add(M(G.box, body, 0, 0.3, 0.3, 1.6, 1.0, 0.08));
  const gun = new THREE.Group(); turret.add(gun);
  const b = M(G.cyl, metal, 0, 0, 1.2, 0.14, 2.6, 0.14); b.rotation.x = Math.PI / 2; gun.add(b);
  gun.add(M(G.cyl, body, 0, 0, 0, 0.3, 0.8, 0.3).rotateX(Math.PI / 2));
  g.userData = { turret, gun };
  return g;
}

/* ---------------- постройки ---------------- */
export function buildHouse(w, d, h) {
  geo();
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ map: TEX.stone.clone() });
  stone.map.needsUpdate = true; stone.map.wrapS = stone.map.wrapT = THREE.RepeatWrapping; stone.map.repeat.set(w / 3, h / 2);
  g.add(M(G.box, stone, 0, h / 2, 0, w, h, d));
  const roof = mat(0x5a3a2a);
  g.add(M(G.box, roof, 0, h + 0.1, 0, w + 0.3, 0.2, d + 0.3));
  for (const s of [-1, 1]) { g.add(M(G.box, roof, s * (w / 2 + 0.05), h + 0.4, 0, 0.2, 0.4, d + 0.3)); g.add(M(G.box, roof, 0, h + 0.4, s * (d / 2 + 0.05), w + 0.3, 0.4, 0.2)); }
  g.add(M(G.box, mat(0x6a5a4a), w * 0.3, h + 0.8, d * 0.2, 0.5, 1.0, 0.5));
  const win = mat(0x1f2a30), frame = mat(0xefe5c8);
  for (const s of [-1, 1]) {
    for (const k of [-0.25, 0.25]) {
      g.add(M(G.box, frame, w * k, h * 0.6, s * (d / 2 + 0.01), 0.9, 0.9, 0.04));
      g.add(M(G.box, win, w * k, h * 0.6, s * (d / 2 + 0.03), 0.7, 0.7, 0.04));
    }
  }
  g.add(M(G.box, mat(0x5a3a22), 0, 0.9, d / 2 + 0.02, 1.0, 1.8, 0.05));
  return g;
}
export function buildMill() {
  geo();
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ map: TEX.stone });
  g.add(M(new THREE.CylinderGeometry(1.4, 2.0, 7, 10), stone, 0, 3.5, 0));
  g.add(M(G.cone, mat(0x5a3a2a), 0, 7.8, 0, 1.7, 1.8, 1.7));
  const hub = new THREE.Group(); hub.position.set(0, 6.6, 1.6); g.add(hub);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group(); blade.rotation.z = i * Math.PI / 2;
    blade.add(M(G.box, mat(0x6b4526), 0, 2.5, 0, 0.15, 5, 0.1)); blade.add(M(G.box, mat(0xe8e0c8), 0.4, 3, 0, 0.7, 3.6, 0.04));
    hub.add(blade);
  }
  g.userData = { hub };
  return g;
}
export function buildSandbags(len) {
  geo();
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ map: TEX.sandbag });
  const n = Math.round(len / 0.7);
  for (let row = 0; row < 3; row++) for (let i = 0; i < n - (row % 2); i++) {
    g.add(M(G.sphere, m, -len / 2 + 0.35 + i * 0.7 + (row % 2) * 0.35, 0.18 + row * 0.3, rnd(-0.03, 0.03), 0.38, 0.17, 0.3));
  }
  return g;
}
export function buildFence(len) {
  geo();
  const g = new THREE.Group(), w = mat(0x7c5a36);
  const n = Math.max(2, Math.round(len / 1.5) + 1);
  for (let i = 0; i < n; i++) g.add(M(G.box, w, -len / 2 + i * len / (n - 1), 0.55, 0, 0.12, 1.1, 0.12));
  for (const y of [0.4, 0.85]) g.add(M(G.box, w, 0, y, 0, len, 0.1, 0.05));
  return g;
}
export function buildWire(len) {
  geo();
  const g = new THREE.Group(), w = mat(0x5a4a3a), wire = mat(0x3a3a38);
  const n = Math.max(2, Math.round(len / 1.6) + 1);
  for (let i = 0; i < n; i++) { const p = M(G.box, w, -len / 2 + i * len / (n - 1), 0.5, 0, 0.08, 1.0, 0.08); p.rotation.z = (i % 2 ? 0.2 : -0.2); g.add(p); }
  for (let k = 0; k < 3; k++) {
    const pts = []; for (let i = 0; i <= 40; i++) { const x = -len / 2 + i * len / 40; pts.push(new THREE.Vector3(x, 0.3 + k * 0.25 + Math.sin(i * 1.7 + k) * 0.08, Math.cos(i * 1.3 + k) * 0.12)); }
    g.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.012, 3), wire));
  }
  return g;
}
export function buildBridge(len, width) {
  geo();
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ map: TEX.wood }), dark = mat(0x4a3322);
  g.add(M(G.box, wood, 0, 0, 0, width, 0.25, len));
  for (const s of [-1, 1]) {
    g.add(M(G.box, dark, s * width / 2, 0.6, 0, 0.1, 0.1, len));
    for (let i = 0; i <= Math.floor(len / 2); i++) g.add(M(G.box, dark, s * width / 2, 0.3, -len / 2 + i * 2, 0.1, 0.7, 0.1));
    for (let i = 0; i <= Math.floor(len / 4); i++) g.add(M(G.cyl, dark, s * width / 2, -1.5, -len / 2 + i * 4, 0.15, 3, 0.15));
  }
  return g;
}
export function buildRock(r) {
  geo();
  const m = M(G.dodeca, mat(0x7d776c), 0, r * 0.4, 0, r, r * 0.7, r * rnd(0.8, 1.2));
  m.rotation.set(rnd(0, 1), rnd(0, 6), rnd(0, 1));
  const g = new THREE.Group(); g.add(m); return g;
}
export function buildBarrel() {
  geo();
  const g = new THREE.Group();
  g.add(M(G.cyl, mat(0xA33A26), 0, 0.55, 0, 0.42, 1.1, 0.42));
  for (const y of [0.25, 0.85]) g.add(M(G.cyl, mat(0x3a2a22), 0, y, 0, 0.43, 0.06, 0.43));
  g.add(M(G.cyl, mat(0xE8C23A), 0, 0.55, 0, 0.43, 0.14, 0.43));
  return g;
}
export function buildCrate(type) {
  geo();
  const g = new THREE.Group();
  if (type === 'medal') {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.2 : 0.45; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const s = M(new THREE.ExtrudeGeometry(star, { depth: 0.08, bevelEnabled: false }), mat(0xE8B84A, { emissive: 0x6a4a00 }), 0, 1.0, 0);
    g.add(s); g.add(M(G.box, mat(0xb8322a), 0, 1.55, 0, 0.3, 0.4, 0.04));
    g.userData.spin = s;
    return g;
  }
  const m = new THREE.MeshLambertMaterial({ map: type === 'health' ? TEX.crateHealth : TEX.crateWeapon });
  g.add(M(G.box, m, 0, 0.45, 0, 0.9, 0.9, 0.9));
  return g;
}
export function buildParachute() {
  geo();
  const g = new THREE.Group();
  const c = M(new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0xefe5c8, { side: THREE.DoubleSide }), 0, 3.0, 0, 1, 0.6, 1);
  g.add(c);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x333333 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * 1.4, 2.9, Math.sin(a) * 1.4), new THREE.Vector3(0, 0.9, 0)]), lineMat));
  }
  return g;
}
export function buildBlimp() {
  geo();
  const g = new THREE.Group();
  g.add(M(G.sphere, mat(0x9a9588), 0, 0, 0, 2.6, 2.6, 8));
  g.add(M(G.box, mat(0x5a4a3a), 0, -2.9, 0, 1.2, 0.8, 3));
  for (const s of [-1, 1]) g.add(M(G.box, mat(0x7a2a22), s * 1.8, 0, -6.5, 2.2, 0.15, 1.6));
  g.add(M(G.box, mat(0x7a2a22), 0, 1.8, -6.5, 0.15, 2.2, 1.6));
  return g;
}
export function buildPlane() {
  geo();
  const g = new THREE.Group(), body = mat(0x4a4d3a), dark = mat(0x2a2a26);
  g.add(M(G.cyl, body, 0, 0, 0, 0.8, 7, 0.8).rotateX(Math.PI / 2));
  g.add(M(G.cone, body, 0, 0, -4.2, 0.8, 1.6, 0.8).rotateX(-Math.PI / 2));
  g.add(M(G.box, body, 0, 0.2, 0.5, 14, 0.2, 2.2));
  g.add(M(G.box, body, 0, 0.3, -3.6, 4.5, 0.15, 1.2));
  g.add(M(G.box, body, 0, 1.0, -3.8, 0.15, 1.6, 1.2));
  for (const s of [-1, 1]) g.add(M(G.cyl, dark, s * 3.5, 0, 1.2, 0.35, 1.4, 0.35).rotateX(Math.PI / 2));
  return g;
}
export function buildFlag(color) {
  geo();
  const g = new THREE.Group();
  g.add(M(G.cyl, mat(0x6b4526), 0, 2.5, 0, 0.06, 5, 0.06));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 10, 4), mat(color, { side: THREE.DoubleSide, unique: true }));
  cloth.position.set(0.92, 4.4, 0); g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}
export function waveFlag(flag, t) {
  const cloth = flag.userData.cloth; if (!cloth) return;
  const p = cloth.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.9; p.setZ(i, Math.sin(x * 3 - t * 5) * 0.15 * x); }
  p.needsUpdate = true;
}

/* ---------------- растительность ---------------- */
export function buildTree(type) {
  geo();
  const g = new THREE.Group(), s = rnd(0.8, 1.3);
  const trunk = mat(0x5a3e25);
  switch (type) {
    case 'oak':
      g.add(M(G.cylLo, trunk, 0, 1.2 * s, 0, 0.25 * s, 2.4 * s, 0.25 * s));
      for (let i = 0; i < 5; i++) g.add(M(G.ico, mat(i % 2 ? 0x4a6b2a : 0x5a7d32), rnd(-0.9, 0.9) * s, (2.6 + rnd(0, 1.2)) * s, rnd(-0.9, 0.9) * s, rnd(1.0, 1.4) * s));
      break;
    case 'willow':
      g.add(M(G.cylLo, trunk, 0, 1.3 * s, 0, 0.3 * s, 2.6 * s, 0.3 * s));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(M(G.coneLo, mat(0x6b7a3a), Math.cos(a) * 1.1 * s, 2.2 * s, Math.sin(a) * 1.1 * s, 0.8 * s, 2.4 * s, 0.8 * s).rotateX(Math.PI)); }
      g.add(M(G.ico, mat(0x5f7035), 0, 3.2 * s, 0, 1.4 * s));
      break;
    case 'dead':
      g.add(M(G.cylLo, mat(0x4a3a2a), 0, 1.6 * s, 0, 0.2 * s, 3.2 * s, 0.2 * s));
      for (let i = 0; i < 4; i++) { const b = M(G.cylLo, mat(0x4a3a2a), 0, (1.6 + i * 0.4) * s, 0, 0.07 * s, 1.4 * s, 0.07 * s); b.rotation.set(rnd(-1, 1), rnd(0, 6), rnd(0.6, 1.1) * (i % 2 ? 1 : -1)); b.position.x = (i % 2 ? 0.4 : -0.4) * s; g.add(b); }
      break;
    case 'palm': {
      let y = 0, x = 0; const lean = rnd(-0.3, 0.3);
      for (let i = 0; i < 6; i++) { g.add(M(G.cylLo, mat(0x8a6a42), x, y + 0.35 * s, 0, 0.18 * s, 0.75 * s, 0.18 * s)); y += 0.7 * s; x += lean * 0.3; }
      for (let i = 0; i < 7; i++) { const l = M(G.box, mat(0x4f7a2a), x, y, 0, 0.35 * s, 0.05, 2.2 * s); l.rotation.y = i / 7 * Math.PI * 2; l.rotation.x = 0.5; l.translateZ(1.0 * s); g.add(l); }
      break; }
    case 'cactus': {
      const c = mat(0x4f7a3a);
      g.add(M(G.cylLo, c, 0, 1.2 * s, 0, 0.3 * s, 2.4 * s, 0.3 * s));
      for (const sd of [-1, 1]) { g.add(M(G.cylLo, c, sd * 0.5 * s, 1.1 * s, 0, 0.18 * s, 0.2 * s, 0.18 * s).rotateZ(Math.PI / 2)); g.add(M(G.cylLo, c, sd * 0.65 * s, 1.5 * s, 0, 0.18 * s, 0.8 * s, 0.18 * s)); }
      break; }
    case 'snowpine':
    case 'pine':
    default: {
      g.add(M(G.cylLo, trunk, 0, 0.7 * s, 0, 0.2 * s, 1.4 * s, 0.2 * s));
      const green = mat(0x2f4f2a), snow = mat(0xf2f5f8);
      for (let i = 0; i < 3; i++) {
        g.add(M(G.coneLo, green, 0, (1.6 + i * 1.05) * s, 0, (1.5 - i * 0.38) * s, 1.9 * s, (1.5 - i * 0.38) * s));
        if (type === 'snowpine') g.add(M(G.coneLo, snow, 0, (1.95 + i * 1.05) * s, 0, (1.15 - i * 0.3) * s, 1.1 * s, (1.15 - i * 0.3) * s));
      }
    }
  }
  g.userData.trunkR = 0.35 * s;
  return g;
}

/* ---------------- портреты для меню ---------------- */
let portraitRenderer = null, portraitScene = null, portraitCam = null;
export function renderPortrait(nation, rankId, rankLine, size = 128) {
  if (!portraitRenderer) {
    const c = document.createElement('canvas');
    portraitRenderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    portraitScene = new THREE.Scene();
    portraitScene.add(new THREE.HemisphereLight(0xffffff, 0x6b5436, 0.9));
    const d = new THREE.DirectionalLight(0xffffff, 0.7); d.position.set(2, 3, 4); portraitScene.add(d);
    portraitCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  }
  portraitRenderer.setSize(size, size, false);
  const hog = new HogModel(nation, rankId, rankLine);
  hog.update(0.016, 'idle');
  hog.head.rotation.y = 0.35;
  hog.root.rotation.y = 0.5;
  portraitScene.add(hog.root);
  portraitCam.position.set(1.1, 1.6, 2.6); portraitCam.lookAt(0.15, 1.2, 0.3);
  portraitRenderer.render(portraitScene, portraitCam);
  portraitScene.remove(hog.root);
  return portraitRenderer.domElement.toDataURL('image/png');
}
export { clamp };
