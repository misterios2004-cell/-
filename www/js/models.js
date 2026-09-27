// Процедурные 3D-модели: лисы-солдаты (двуногий скелет), оружие, техника, постройки, растительность, ящики.
// Материалы — PBR (MeshStandardMaterial) с предустановками из theme.js; на низком качестве — Lambert.
import { THREE, rnd, clamp } from './core.js';
import { MATERIALS, FOX_PALETTE } from './theme.js';

/* ================= текстуры, нарисованные на canvas ================= */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}
// Карта нормалей из карты высот (яркость канала R).
function normalFromHeight(src, strength = 2, repeat) {
  const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  const H = (i, j) => sd[(((j + h) % h) * w + ((i + w) % w)) * 4] / 255;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * strength, dy = (H(i, j + 1) - H(i, j - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (-dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
function heightCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

export const TEX = {};
export function initTextures() {
  // Земля: комья, камешки, стебли — умножается на цвет вершин рельефа.
  const groundH = heightCanvas(256, 256, (x, w, h) => {
    x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const v = 150 + Math.random() * 105 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let i = 0; i < 160; i++) { const v = 90 + Math.random() * 60 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, rnd(1.5, 4), 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1;
    for (let i = 0; i < 1100; i++) { const px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-2, 2), py - rnd(3, 8)); x.stroke(); }
  });
  TEX.ground = new THREE.CanvasTexture(groundH); TEX.ground.wrapS = TEX.ground.wrapT = THREE.RepeatWrapping; TEX.ground.repeat.set(56, 56); TEX.ground.anisotropy = 8;
  TEX.groundNormal = normalFromHeight(groundH, 3, 56);
  // Ткань формы: саржевое плетение.
  const fabricH = heightCanvas(128, 128, (x, w, h) => {
    x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let i = 0; i < w; i += 4) { x.fillStyle = (y / 2 + i / 4) % 2 ? '#a8a8a8' : '#e0e0e0'; x.fillRect((i + y) % w, y, 3, 1); }
    for (let i = 0; i < 900; i++) { const v = 150 + Math.random() * 100 | 0; x.fillStyle = `rgba(${v},${v},${v},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  });
  TEX.fabric = new THREE.CanvasTexture(fabricH); TEX.fabric.wrapS = TEX.fabric.wrapT = THREE.RepeatWrapping; TEX.fabric.repeat.set(3, 3);
  TEX.fabricNormal = normalFromHeight(fabricH, 1.5, 3);
  // Мех: продольные пряди.
  const furH = heightCanvas(128, 128, (x, w, h) => {
    x.fillStyle = '#c0c0c0'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { const v = 130 + Math.random() * 125 | 0, px = Math.random() * w, py = Math.random() * h; x.strokeStyle = `rgba(${v},${v},${v},.8)`; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-1, 1), py + rnd(4, 10)); x.stroke(); }
  });
  TEX.fur = new THREE.CanvasTexture(furH); TEX.fur.wrapS = TEX.fur.wrapT = THREE.RepeatWrapping; TEX.fur.repeat.set(2, 2);
  TEX.furNormal = normalFromHeight(furH, 2, 2);
  TEX.soft = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });
  TEX.smoke = canvasTex(128, 128, (x) => {
    for (let i = 0; i < 18; i++) {
      const cx = 64 + rnd(-26, 26), cy = 64 + rnd(-26, 26), r = rnd(16, 36);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
  });
  TEX.flash = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,244,220,1)'); g.addColorStop(0.2, 'rgba(255,196,120,.9)'); g.addColorStop(0.55, 'rgba(200,90,30,.45)'); g.addColorStop(1, 'rgba(120,40,10,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });
  TEX.wood = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#4a3522'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#3f2d1c' : '#503a25'; x.fillRect(0, i * 32, w, 30); }
    x.strokeStyle = 'rgba(15,8,2,.55)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); }
    x.strokeStyle = 'rgba(15,8,2,.25)'; x.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const y = Math.random() * h; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(40, y + 3, 80, y - 3, w, y); x.stroke(); }
  });
  TEX.stone = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#3d3a35'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 5; col++) {
      const v = 70 + Math.random() * 35 | 0; x.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
      x.fillRect(col * 28 + (row % 2) * 14 - 14, row * 16, 26, 14);
    }
    for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  });
  TEX.concrete = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#5c5a55'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { const v = 70 + Math.random() * 40 | 0; x.fillStyle = `rgba(${v},${v},${v - 4},.55)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = 'rgba(20,18,16,.45)'; x.fillRect(0, 60, w, 3);
    x.strokeStyle = 'rgba(20,18,16,.35)'; for (let i = 0; i < 6; i++) { x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += rnd(-12, 12); py += rnd(-12, 12); x.lineTo(px, py); } x.stroke(); }
  });
  TEX.sandbag = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#6e6148'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,24,14' : '140,125,95'},.3)`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    x.strokeStyle = 'rgba(30,24,14,.5)'; x.beginPath(); x.moveTo(0, 32); x.lineTo(w, 32); x.stroke();
  });
  const crateTex = (bg, draw) => canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    draw(x, w, h);
  });
  TEX.crateWeapon = crateTex('#3b3f2c', (x) => {
    x.fillStyle = 'rgba(220,210,180,.8)'; x.font = '600 18px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('БОЕПРИПАСЫ', 64, 58); x.fillRect(22, 72, 84, 3);
  });
  TEX.crateHealth = crateTex('#4a4c4a', (x) => { x.fillStyle = '#9a2e22'; x.fillRect(54, 34, 20, 60); x.fillRect(34, 54, 60, 20); });
}

/* ================= материалы (PBR) ================= */
let PBR = true;
const matCache = new Map();
// low — Lambert (быстро на слабых телефонах), иначе MeshStandardMaterial.
export function setMaterialQuality(q) { const p = q !== 'low'; if (p !== PBR) { PBR = p; matCache.clear(); } }
export function mat(color, opts = {}) {
  const { unique, preset, ...rest } = opts;
  const key = color + (preset || '') + JSON.stringify(rest, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!unique && matCache.has(key)) return matCache.get(key);
  let m;
  if (PBR) {
    const p = MATERIALS[preset || 'gear'];
    m = new THREE.MeshStandardMaterial({ color, roughness: p.roughness, metalness: p.metalness, ...rest });
  } else {
    const { normalMap, roughness, metalness, ...lam } = rest; void normalMap; void roughness; void metalness;
    m = new THREE.MeshLambertMaterial({ color, ...lam });
  }
  if (!unique) matCache.set(key, m);
  return m;
}
const G = {};
function geo() {
  if (G.sphere) return G;
  G.sphere = new THREE.SphereGeometry(1, 18, 14);
  G.sphereLo = new THREE.SphereGeometry(1, 8, 6);
  G.box = new THREE.BoxGeometry(1, 1, 1);
  G.cyl = new THREE.CylinderGeometry(1, 1, 1, 16);
  G.cylLo = new THREE.CylinderGeometry(1, 1, 1, 7);
  G.cone = new THREE.ConeGeometry(1, 1, 12);
  G.coneLo = new THREE.ConeGeometry(1, 1, 7);
  G.dome = new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  G.torus = new THREE.TorusGeometry(1, 0.12, 6, 18);
  G.ico = new THREE.IcosahedronGeometry(1, 0);
  G.dodeca = new THREE.DodecahedronGeometry(1, 0);
  G.limb = new THREE.CylinderGeometry(1, 0.85, 1, 12);       // сужающийся сегмент конечности
  G.snout = new THREE.ConeGeometry(1, 1, 14).rotateX(Math.PI / 2); // остриё вдоль +z
  return G;
}
function M(g, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(g, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; return m;
}
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

/* ================= лиса-солдат: двуногий скелет ================= */
// Габариты капсулы столкновений (м). Используются боем, ИИ и камерой.
export const FOX_BODY = Object.freeze({ height: 1.82, radius: 0.34, pelvis: 0.95, chest: 1.3, shoulder: 1.45, eye: 1.64, muzzle: 1.36 });
// Состояния аниматора (длительные) и действия (одноразовые, накладываются поверх).
export const FoxAnim = Object.freeze({ IDLE: 'idle', WALK: 'walk', RUN: 'run', AIR: 'air', SWIM: 'swim', AIM: 'aim', DEATH: 'dead', CELEBRATE: 'celebrate', SLEEP: 'sleep' });
export const FoxAction = Object.freeze({ ATTACK: 'attack', THROW: 'throw', FIRE: 'fire', HIT: 'hit', PLACE: 'place' });
const ACTION_TIME = { attack: 0.45, throw: 0.6, fire: 0.18, hit: 0.4, place: 0.7 };
// Оружие, которое держат двумя руками у груди; остальное — в правой руке.
const TWO_HANDED = new Set(['rifle', 'rifleburst', 'tranq', 'sniper', 'mg', 'hmg', 'shotgun', 'supershotgun', 'bazooka', 'airburst', 'firerain', 'mortar', 'flamethrower', 'meddart']);

const POSE_KEYS = ['pelvisY', 'spineX', 'spineY', 'neckX', 'headY', 'shLX', 'shLZ', 'elL', 'shRX', 'shRZ', 'elR', 'hipL', 'hipR', 'knL', 'knR', 'tailX', 'tailY', 'rootX', 'rootZ', 'lift'];

export class BipedalFox {
  constructor(nation, rankId, rankLine) {
    geo();
    this.nation = nation; this.rankId = rankId; this.line = rankLine;
    const P = FOX_PALETTE;
    const root = this.root = new THREE.Group();
    const fur = mat(P.fur, { preset: 'fur', map: TEX.fur, normalMap: TEX.furNormal });
    const furDark = mat(P.furDark, { preset: 'fur', map: TEX.fur });
    const furLight = mat(P.furLight, { preset: 'fur', map: TEX.fur, normalMap: TEX.furNormal });
    const socks = mat(P.socks, { preset: 'fur', map: TEX.fur });
    const uni = this.uniMat = mat(nation.color, { preset: 'fabric', map: TEX.fabric, normalMap: TEX.fabricNormal, unique: true });
    const trousers = mat(shade(nation.color, 0.78), { preset: 'fabric', map: TEX.fabric, normalMap: TEX.fabricNormal });
    const boots = mat(P.boots, { preset: 'leather' }), belt = mat(P.belt, { preset: 'leather' });
    const vest = mat(P.vest, { preset: 'gear', map: TEX.fabric, normalMap: TEX.fabricNormal }), pouch = mat(P.pouch, { preset: 'gear', map: TEX.fabric });
    const eyeM = mat(P.eye, { preset: 'eye' }), pupil = mat(P.pupil, { preset: 'eye' }), nose = mat(P.nose, { preset: 'eye' }), inner = mat(P.innerEar, { preset: 'fur' });
    const j = this.j = {};

    // таз — корень скелета
    const pelvis = j.pelvis = new THREE.Group(); pelvis.position.y = FOX_BODY.pelvis; root.add(pelvis);
    pelvis.add(M(G.sphere, trousers, 0, 0.02, 0, 0.17, 0.12, 0.12));
    pelvis.add(M(G.cyl, belt, 0, 0.08, 0, 0.172, 0.05, 0.128));
    pelvis.add(M(G.box, pouch, 0.12, 0.05, -0.1, 0.07, 0.09, 0.05));
    pelvis.add(M(G.box, pouch, -0.13, 0.05, 0.02, 0.05, 0.1, 0.08)); // кобура/подсумок на бедре
    // ноги: бедро → колено → голень → ботинок
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
      const hip = j['hip' + k] = new THREE.Group(); hip.position.set(s * 0.095, -0.02, 0); pelvis.add(hip);
      hip.add(M(G.limb, trousers, 0, -0.22, 0, 0.078, 0.44, 0.084));
      hip.add(M(G.box, pouch, s * 0.07, -0.2, 0.02, 0.03, 0.1, 0.08)); // карман
      const knee = j['kn' + k] = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
      knee.add(M(G.sphere, trousers, 0, 0, 0.01, 0.07, 0.07, 0.075)); // наколенник
      knee.add(M(G.limb, trousers, 0, -0.18, 0, 0.064, 0.36, 0.066));
      knee.add(M(G.cyl, boots, 0, -0.37, 0, 0.07, 0.13, 0.072));
      knee.add(M(G.box, boots, 0, -0.44, 0.045, 0.11, 0.08, 0.23));
      knee.add(M(G.box, mat(0x0c0a08, { preset: 'leather' }), 0, -0.475, 0.045, 0.115, 0.02, 0.24)); // подошва
    }
    // хвост: цепочка сегментов, пушистый, кончик светлый
    const tail = j.tail = new THREE.Group(); tail.position.set(0, 0.02, -0.11); pelvis.add(tail);
    let parent = tail; j.tailSeg = [];
    const tailR = [0.06, 0.085, 0.095, 0.085, 0.06];
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group(); if (i) seg.position.z = -0.13; parent.add(seg); j.tailSeg.push(seg);
      seg.add(M(G.sphere, i === 4 ? furLight : i === 3 ? furDark : fur, 0, 0, -0.07, tailR[i], tailR[i] * 0.95, 0.1));
      parent = seg;
    }
    // позвоночник: торс, разгрузка, шея, голова
    const spine = j.spine = new THREE.Group(); spine.position.y = 0.1; pelvis.add(spine);
    spine.add(M(new THREE.CylinderGeometry(0.2, 0.165, 0.46, 16), uni, 0, 0.22, 0, 1, 1, 0.72));
    spine.add(M(G.sphere, uni, 0, 0.4, 0, 0.21, 0.08, 0.15)); // плечевой пояс
    spine.add(M(G.box, vest, 0, 0.25, 0.005, 0.37, 0.32, 0.25));
    for (const x of [-0.11, 0, 0.11]) spine.add(M(G.box, pouch, x, 0.17, 0.135, 0.085, 0.1, 0.045));
    spine.add(M(G.box, pouch, 0.1, 0.33, 0.13, 0.06, 0.07, 0.03)); // рация
    spine.add(M(G.cyl, mat(0x111111, { preset: 'metal' }), -0.11, 0.52, -0.2, 0.006, 0.3, 0.006)); // антенна рации на ранце
    spine.add(M(G.box, mat(0x2e2a22, { preset: 'gear', map: TEX.fabric }), 0, 0.28, -0.17, 0.3, 0.3, 0.12)); // ранец
    spine.add(M(G.sphere, furLight, 0, 0.44, 0.075, 0.06, 0.04, 0.03)); // белая грудка у ворота
    spine.add(M(G.cyl, uni, 0, 0.45, 0, 0.11, 0.05, 0.095)); // воротник
    // знаки различия
    if (rankLine === 'officer') for (const s of [-1, 1]) spine.add(M(G.box, mat(0x8a7440, { preset: 'metal' }), s * 0.16, 0.44, 0, 0.07, 0.012, 0.1));
    const neck = j.neck = new THREE.Group(); neck.position.y = 0.47; spine.add(neck);
    neck.add(M(G.cyl, fur, 0, 0.04, 0, 0.058, 0.1, 0.058));
    const head = this.head = j.head = new THREE.Group(); head.position.set(0, 0.12, 0.02); neck.add(head);
    head.add(M(G.sphere, fur, 0, 0, -0.005, 0.118, 0.112, 0.128));
    const cheek = mat(0xb8aa92, { preset: 'fur', map: TEX.fur });
    for (const s of [-1, 1]) head.add(M(G.sphere, cheek, s * 0.085, -0.05, 0.02, 0.04, 0.034, 0.05)); // «баки»
    head.add(M(G.snout, fur, 0, -0.035, 0.17, 0.066, 0.056, 0.25)); // вытянутая морда
    head.add(M(G.snout, cheek, 0, -0.062, 0.14, 0.046, 0.026, 0.17)); // светлая нижняя челюсть
    head.add(M(G.sphere, nose, 0, -0.03, 0.292, 0.016, 0.013, 0.014));
    this.eyes = []; this.pupils = [];
    for (const s of [-1, 1]) {
      const e = M(G.sphere, eyeM, s * 0.056, 0.024, 0.098, 0.023, 0.014, 0.012); e.rotation.y = s * 0.4; head.add(e); this.eyes.push(e);
      const p = M(G.box, pupil, s * 0.059, 0.024, 0.109, 0.004, 0.013, 0.003); p.rotation.y = s * 0.4; head.add(p); this.pupils.push(p);
      const brow = M(G.box, furDark, s * 0.055, 0.045, 0.1, 0.05, 0.011, 0.02); brow.rotation.z = -s * 0.22; head.add(brow);
    }
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * 0.066, 0.095, -0.02); ear.rotation.z = -s * 0.28; ear.rotation.x = -0.1;
      ear.add(M(G.cone, fur, 0, 0.085, 0, 0.052, 0.18, 0.024));
      ear.add(M(G.cone, inner, 0, 0.078, 0.009, 0.036, 0.13, 0.01));
      ear.add(M(G.cone, socks, 0, 0.16, 0, 0.022, 0.05, 0.012));
      head.add(ear); this.ears.push(ear);
    }
    head.add(buildHelmet(nation, rankLine));
    // руки: плечо → локоть → предплечье → кисть (тёмные «чулки»)
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
      const sh = j['sh' + k] = new THREE.Group(); sh.position.set(s * 0.225, 0.4, 0); spine.add(sh);
      sh.add(M(G.sphere, uni, 0, -0.01, 0, 0.068, 0.068, 0.068));
      sh.add(M(G.limb, uni, 0, -0.14, 0, 0.058, 0.28, 0.058));
      if (rankLine === 'medic' && s === 1) {
        sh.add(M(G.cyl, mat(0xc9c4b8, { preset: 'fabric' }), 0, -0.1, 0, 0.061, 0.07, 0.061));
        sh.add(M(G.box, mat(0x8e2a20, { preset: 'fabric' }), 0.061, -0.1, 0, 0.004, 0.045, 0.015));
        sh.add(M(G.box, mat(0x8e2a20, { preset: 'fabric' }), 0.061, -0.1, 0, 0.004, 0.015, 0.045));
      }
      const el = j['el' + k] = new THREE.Group(); el.position.set(0, -0.28, 0); sh.add(el);
      el.add(M(G.limb, uni, 0, -0.1, 0, 0.05, 0.2, 0.05));
      el.add(M(G.cyl, socks, 0, -0.22, 0, 0.044, 0.06, 0.044));
      el.add(M(G.sphere, socks, 0, -0.27, 0.012, 0.045, 0.05, 0.04));
    }
    // точка крепления оружия (у груди) и ранца
    this.gunPivot = new THREE.Group(); this.gunPivot.position.set(-0.08, 0.3, 0.16); spine.add(this.gunPivot);
    this.backPivot = new THREE.Group(); this.backPivot.position.set(0, 0.3, -0.2); spine.add(this.backPivot);
    this.weaponId = null; this.twoHanded = false;
    // аниматор
    this.state = FoxAnim.IDLE; this.action = null; this.t = rnd(0, 10); this.phase = 0; this.blinkT = rnd(1, 4); this.lookT = 0; this.lookYaw = 0;
    this.pose = Object.fromEntries(POSE_KEYS.map(k => [k, 0])); this.pose.pelvisY = FOX_BODY.pelvis;
    this.bush = null;
    root.traverse(o => { if (o.isMesh) o.userData.foxPart = true; });
  }
  setWeapon(id) {
    if (this.weaponId === id) return;
    this.weaponId = id; this.twoHanded = TWO_HANDED.has(id);
    this.gunPivot.clear(); this.backPivot.clear();
    this.gunPivot.position.set(this.twoHanded ? -0.08 : -0.2, this.twoHanded ? 0.3 : 0.22, this.twoHanded ? 0.16 : 0.24);
    if (!id) return;
    const w = buildWeaponModel(id);
    if (w.back) this.backPivot.add(w.back);
    if (w.hand) this.gunPivot.add(w.hand);
  }
  setHidden(on) {
    if (on && !this.bush) {
      this.bush = new THREE.Group();
      const net = mat(0x2e3a22, { preset: 'foliage' }), net2 = mat(0x3a4428, { preset: 'foliage' });
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; this.bush.add(M(G.ico, i % 2 ? net : net2, Math.cos(a) * 0.4, rnd(0.4, 1.5), Math.sin(a) * 0.4, rnd(0.35, 0.55))); }
      this.bush.add(M(G.ico, net, 0, 1.75, 0, 0.45));
      this.root.add(this.bush);
    }
    if (this.bush) this.bush.visible = on;
  }
  // Одноразовое действие поверх текущего состояния (удар, бросок, выстрел, ранение, установка).
  play(action) { this.action = { name: action, t: 0, dur: ACTION_TIME[action] || 0.4 }; }
  hit() { this.play(FoxAction.HIT); }

  // Целевая поза для состояния. Углы в радианах; отрицательный угол плеча/бедра — вперёд.
  targetPose(state, pitch, armed) {
    const t = this.t, ph = this.phase, T = Object.fromEntries(POSE_KEYS.map(k => [k, 0]));
    T.pelvisY = FOX_BODY.pelvis;
    const armedArms = () => {
      if (this.twoHanded) { T.shRX = -0.95 - pitch * 0.75; T.shRZ = 0.32; T.elR = -1.15; T.shLX = -1.25 - pitch * 0.85; T.shLZ = -0.38; T.elL = -0.55; }
      else { T.shRX = -1.2 - pitch * 0.9; T.shRZ = 0.12; T.elR = -0.35; T.shLX = 0.1; T.shLZ = -0.12; T.elL = -0.25; }
    };
    T.tailX = -0.55; T.tailY = Math.sin(t * 1.4) * 0.22;
    switch (state) {
      case FoxAnim.WALK: case FoxAnim.RUN: {
        const run = state === FoxAnim.RUN, s = Math.sin(ph), c = Math.cos(ph);
        const hipA = run ? 0.85 : 0.5, knA = run ? 1.35 : 0.8;
        T.hipL = -hipA * s; T.hipR = hipA * s;
        T.knL = 0.1 + knA * Math.max(0, c); T.knR = 0.1 + knA * Math.max(0, -c);
        T.pelvisY = FOX_BODY.pelvis - (run ? 0.06 : 0.025) + Math.abs(c) * (run ? 0.06 : 0.025);
        T.spineX = run ? 0.28 : 0.06; T.spineY = s * (run ? 0.12 : 0.06);
        if (armed) { armedArms(); if (run) { T.shRX += 0.35; T.shLX += 0.35; } }
        else { T.shLX = (run ? 0.9 : 0.4) * s; T.shRX = -(run ? 0.9 : 0.4) * s; T.shLZ = -0.08; T.shRZ = 0.08; T.elL = T.elR = run ? -1.3 : -0.2; }
        T.tailX = run ? -0.25 : -0.45; T.tailY = s * 0.3;
        break;
      }
      case FoxAnim.AIR:
        T.hipL = -0.8; T.hipR = -0.25; T.knL = 1.3; T.knR = 0.6; T.spineX = 0.1;
        if (armed) armedArms(); else { T.shLX = T.shRX = -0.7; T.shLZ = -0.45; T.shRZ = 0.45; T.elL = T.elR = -0.4; }
        T.tailX = 0;
        break;
      case FoxAnim.SWIM: {
        const s = Math.sin(ph);
        T.spineX = 0.45; T.hipL = -0.3 + 0.5 * s; T.hipR = -0.3 - 0.5 * s; T.knL = 0.6 + 0.4 * s; T.knR = 0.6 - 0.4 * s;
        T.shLX = T.shRX = -1.3 + 0.5 * s; T.shLZ = -(0.5 + 0.5 * Math.cos(ph)); T.shRZ = 0.5 + 0.5 * Math.cos(ph); T.elL = T.elR = -0.3;
        T.neckX = -0.45; T.tailX = 0.1;
        break;
      }
      case FoxAnim.DEATH:
        T.rootX = -1.45; T.knL = 0.35; T.knR = 0.9; T.hipL = -0.3; T.hipR = -0.6;
        T.shLX = -0.4; T.shRX = -0.2; T.shLZ = -1.2; T.shRZ = 1.1; T.elL = T.elR = -0.2; T.neckX = 0.35; T.tailX = 0; T.tailY = 0.4;
        break;
      case FoxAnim.SLEEP:
        T.rootZ = 1.45; T.hipL = T.hipR = -1.0; T.knL = T.knR = 1.5; T.spineX = 0.4; T.shLX = T.shRX = -0.8; T.elL = T.elR = -1.2; T.tailX = -0.2; T.tailY = 1.3;
        break;
      case FoxAnim.CELEBRATE: {
        const j = Math.abs(Math.sin(t * 6));
        T.lift = j * 0.3; T.knL = T.knR = (1 - j) * 0.7; T.hipL = T.hipR = -(1 - j) * 0.4;
        T.shRX = -2.9; T.shRZ = 0.2; T.elR = -0.2; T.shLX = -0.4; T.shLZ = -0.3;
        T.tailY = Math.sin(t * 10) * 0.5;
        break;
      }
      case FoxAnim.AIM:
        T.pelvisY = FOX_BODY.pelvis - 0.03; T.hipL = -0.22; T.hipR = 0.12; T.knL = 0.3; T.knR = 0.12; T.spineX = 0.1; T.spineY = -0.12;
        T.neckX = -pitch * 0.5 - 0.05; T.headY = 0.12;
        if (armed) armedArms(); else { T.shLX = T.shRX = -0.1; T.shLZ = -0.1; T.shRZ = 0.1; T.elL = T.elR = -0.3; }
        break;
      default: // IDLE
        T.spineX = 0.02 + Math.sin(t * 2.1) * 0.015; T.hipL = 0.04; T.hipR = -0.05; T.knL = 0.06; T.knR = 0.1;
        T.headY = this.lookYaw;
        if (armed) { armedArms(); T.shRX += 0.35; T.shLX += 0.35; } // оружие опущено в «готовность»
        else { T.shLZ = -0.1; T.shRZ = 0.1; T.elL = T.elR = -0.15; }
    }
    // наложение одноразового действия
    const a = this.action;
    if (a) {
      const p = a.t / a.dur, e = 1 - p;
      switch (a.name) {
        case FoxAction.ATTACK: T.shRX = p < 0.35 ? -2.5 : -2.5 + (p - 0.35) / 0.65 * 2.2; T.shRZ = 0.25; T.elR = p < 0.35 ? -1.4 : -0.2; T.spineY = p < 0.35 ? 0.35 : -0.35; T.spineX = 0.15; break;
        case FoxAction.THROW: T.shRX = p < 0.5 ? -2.7 : -2.7 + (p - 0.5) * 3.6; T.shRZ = 0.2; T.elR = p < 0.5 ? -1.3 : -0.2; T.spineY = p < 0.5 ? 0.35 : -0.3; T.hipL = -0.4; T.knR = 0.4; break;
        case FoxAction.FIRE: T.spineX -= 0.12 * e; T.neckX += 0.08 * e; break;
        case FoxAction.HIT: T.spineX -= 0.4 * e; T.neckX += 0.35 * e; T.shLZ -= 0.4 * e; T.shRZ += 0.4 * e; T.pelvisY -= 0.05 * e; break;
        case FoxAction.PLACE: { const d = Math.sin(p * Math.PI); T.pelvisY = FOX_BODY.pelvis - 0.4 * d; T.hipL = T.hipR = -1.3 * d; T.knL = T.knR = 1.9 * d; T.spineX = 0.7 * d; T.shRX = -0.9 * d; T.elR = -0.3; break; }
      }
    }
    return T;
  }
  // state — одно из FoxAnim; pitch — угол ствола; armed — держит ли оружие.
  update(dt, state, pitch = 0, armed = !!this.weaponId) {
    this.t += dt;
    const speed = state === FoxAnim.RUN ? 11 : state === FoxAnim.WALK ? 7.2 : state === FoxAnim.SWIM ? 3.5 : 0;
    this.phase += dt * speed;
    if (state !== this.state) { if (state === FoxAnim.DEATH) this.action = null; this.state = state; }
    if (this.action) { this.action.t += dt; if (this.action.t >= this.action.dur) this.action = null; }
    if (state === FoxAnim.IDLE) { this.lookT -= dt; if (this.lookT <= 0) { this.lookT = rnd(1.5, 4); this.lookYaw = rnd(-0.5, 0.5); } }
    const T = this.targetPose(state, pitch, armed && state !== FoxAnim.SWIM);
    // плавный переход между позами (кроссфейд)
    const k = 1 - Math.exp(-(state === FoxAnim.DEATH || state === FoxAnim.SLEEP ? 5 : this.action ? 22 : 13) * dt);
    const P = this.pose;
    for (const key of POSE_KEYS) P[key] += (T[key] - P[key]) * k;
    const j = this.j;
    j.pelvis.position.y = P.pelvisY + P.lift;
    j.spine.rotation.set(P.spineX, P.spineY, 0);
    j.neck.rotation.x = P.neckX; j.head.rotation.y = P.headY;
    j.shL.rotation.set(P.shLX, 0, P.shLZ); j.shR.rotation.set(P.shRX, 0, P.shRZ);
    j.elL.rotation.x = P.elL; j.elR.rotation.x = P.elR;
    j.hipL.rotation.x = P.hipL; j.hipR.rotation.x = P.hipR; j.knL.rotation.x = P.knL; j.knR.rotation.x = P.knR;
    j.tail.rotation.set(P.tailX, P.tailY, 0);
    j.tailSeg.forEach((s, i) => { if (i) { s.rotation.x = 0.16 + Math.sin(this.t * 2 + i) * 0.04; s.rotation.y = P.tailY * 0.3; } });
    this.root.rotation.x = P.rootX; this.root.rotation.z = P.rootZ;
    // уши подрагивают, на бегу прижаты
    this.ears.forEach((e, i) => { const s = i ? 1 : -1; e.rotation.z = -s * (0.28 + (state === FoxAnim.RUN ? 0.35 : 0) + Math.sin(this.t * 3 + i * 2) * 0.03); });
    // моргание
    this.blinkT -= dt;
    const closed = state === FoxAnim.SLEEP || state === FoxAnim.DEATH || (this.blinkT < 0 && this.blinkT > -0.12);
    if (this.blinkT < -0.12) this.blinkT = rnd(2.5, 6);
    this.eyes.forEach(e => { e.scale.y = closed ? 0.002 : 0.014; });
    this.pupils.forEach(p => { p.visible = !closed; });
    // оружие следует за наводкой, отдача при выстреле
    this.gunPivot.rotation.x = -pitch + (armed ? 0 : 0);
    this.gunPivot.rotation.y = this.twoHanded ? 0.06 : 0;
    const recoil = this.action && this.action.name === FoxAction.FIRE ? (1 - this.action.t / this.action.dur) * 0.06 : 0;
    this.gunPivot.children.forEach(c => { c.position.z = -recoil; });
    this.gunPivot.visible = state !== FoxAnim.SWIM && state !== FoxAnim.SLEEP && state !== FoxAnim.DEATH;
  }
}

/* ================= шлемы и головные уборы ================= */
function buildHelmet(nation, line) {
  const g = new THREE.Group(), hat = nation.hat;
  const steel = c => mat(c, { preset: 'helmet' }), cloth = c => mat(c, { preset: 'fabric', map: TEX.fabric });
  const strap = mat(0x1e1a14, { preset: 'leather' });
  g.position.set(0, 0.062, -0.012);
  const chin = () => { for (const s of [-1, 1]) g.add(M(G.box, strap, s * 0.105, -0.06, 0.02, 0.008, 0.12, 0.012)); };
  switch (hat) {
    case 'brodie': g.add(M(G.cyl, steel(0x3e4430), 0, 0.035, 0, 0.2, 0.012, 0.2)); g.add(M(G.dome, steel(0x3e4430), 0, 0.035, 0, 0.135, 0.095, 0.145)); chin(); break;
    case 'adrian': g.add(M(G.dome, steel(0x3a4150), 0, 0.06, 0, 0.14, 0.12, 0.15)); g.add(M(G.cyl, steel(0x3a4150), 0, 0.06, 0.01, 0.17, 0.01, 0.18)); g.add(M(G.box, steel(0x3a4150), 0, 0.18, 0, 0.012, 0.03, 0.16)); chin(); break;
    case 'stahlhelm': {
      const m = steel(0x3c3f40);
      g.add(M(G.dome, m, 0, 0.055, 0, 0.145, 0.13, 0.16));
      g.add(M(new THREE.CylinderGeometry(1, 1.12, 1, 18, 1, true), m, 0, 0.03, -0.01, 0.145, 0.06, 0.16));
      chin(); break;
    }
    case 'm1': { const m = steel(0x4a4a34); g.add(M(G.dome, m, 0, 0.05, 0, 0.15, 0.13, 0.16)); g.add(M(G.cyl, m, 0, 0.05, 0.01, 0.158, 0.012, 0.168)); g.add(M(G.sphere, mat(0x2a2a20, { preset: 'fabric' }), 0, 0.07, 0, 0.152, 0.11, 0.162)); chin(); break; }
    case 'ushanka': {
      const f = mat(0x3a342e, { preset: 'fur', map: TEX.fur });
      g.add(M(G.cyl, f, 0, 0.07, 0, 0.14, 0.11, 0.145)); g.add(M(G.dome, f, 0, 0.12, 0, 0.14, 0.05, 0.145));
      g.add(M(G.box, f, 0, 0.08, 0.13, 0.2, 0.06, 0.04));
      for (const s of [-1, 1]) g.add(M(G.box, f, s * 0.14, 0.0, 0, 0.035, 0.12, 0.11));
      g.add(M(G.cone, mat(0x7a2418, { preset: 'metal' }), 0, 0.085, 0.155, 0.025, 0.006, 0.025).rotateX(Math.PI / 2));
      break;
    }
    case 'type90': { const m = steel(0x4e4632); g.add(M(G.dome, m, 0, 0.055, 0, 0.145, 0.12, 0.155)); g.add(M(G.box, cloth(0x4a4230), 0, -0.02, -0.12, 0.2, 0.12, 0.02)); chin(); break; }
    case 'visor': { // Орден Пепла: чёрный шлем с узкой красной щелью визора
      const m = steel(0x17161a);
      g.add(M(G.dome, m, 0, 0.045, -0.005, 0.15, 0.13, 0.16));
      g.add(M(G.cyl, m, 0, 0.04, 0, 0.152, 0.03, 0.162));
      for (const s of [-1, 1]) g.add(M(G.box, m, s * 0.13, -0.04, 0.02, 0.025, 0.1, 0.1)); // щёчные пластины
      g.add(M(G.box, mat(0x1a0706, { preset: 'eye', emissive: 0x280403 }), 0, -0.04, 0.125, 0.17, 0.03, 0.02)); // тёмный визор на уровне глаз
      break;
    }
    default: g.add(M(G.dome, steel(0x3e4430), 0, 0.06, 0, 0.14, 0.12, 0.15));
  }
  if (line === 'medic') { g.add(M(G.cyl, cloth(0xc9c4b8), 0, 0.09, 0, 0.152, 0.03, 0.162)); g.add(M(G.box, mat(0x8e2a20, { preset: 'fabric' }), 0, 0.09, 0.163, 0.04, 0.014, 0.005)); g.add(M(G.box, mat(0x8e2a20, { preset: 'fabric' }), 0, 0.09, 0.163, 0.014, 0.03, 0.005)); }
  if (line === 'spy') g.add(M(G.box, mat(0x1a1c1a, { preset: 'eye' }), 0, 0.03, 0.15, 0.15, 0.04, 0.02)); // тактические очки
  return g;
}

/* ================= оружие ================= */
export function buildWeaponModel(id) {
  geo();
  const metal = mat(0x1e2022, { preset: 'gunmetal' }), wood = mat(0x3a2818, { preset: 'wood' }), olive = mat(0x33392a, { preset: 'gear' });
  const steel = mat(0x7a7e82, { preset: 'metal' }), red = mat(0x6e2218, { preset: 'gear' }), poly = mat(0x1a1a18, { preset: 'gear' });
  const hand = new THREE.Group(); let back = null;
  const barrel = (len, r, z0 = 0) => { const b = M(G.cyl, metal, 0, 0, z0 + len / 2, r, len, r); b.rotation.x = Math.PI / 2; return b; };
  switch (id) {
    case 'rifle': case 'rifleburst': case 'tranq':
      hand.add(M(G.box, poly, 0, -0.02, 0.12, 0.06, 0.09, 0.62)); hand.add(barrel(0.5, 0.018, 0.4)); hand.add(M(G.box, metal, 0, -0.08, 0.18, 0.04, 0.12, 0.06)); hand.add(M(G.box, metal, 0, 0.05, 0.2, 0.02, 0.03, 0.14)); break;
    case 'sniper':
      hand.add(M(G.box, mat(0x2a2c24, { preset: 'gear' }), 0, -0.02, 0.1, 0.065, 0.09, 0.78)); hand.add(barrel(0.75, 0.018, 0.45));
      { const s = M(G.cyl, metal, 0, 0.07, 0.22, 0.032, 0.34, 0.032); s.rotation.x = Math.PI / 2; hand.add(s); }
      hand.add(M(G.box, metal, 0, -0.1, 0.62, 0.01, 0.12, 0.01)); break;
    case 'pistol': hand.add(M(G.box, metal, 0, 0, 0.1, 0.035, 0.05, 0.2)); hand.add(M(G.box, poly, 0, -0.06, 0.03, 0.03, 0.09, 0.05)); break;
    case 'mg': case 'hmg':
      hand.add(M(G.box, metal, 0, 0, 0.15, 0.1, 0.12, 0.6)); hand.add(barrel(0.6, 0.03, 0.42));
      hand.add(M(G.box, olive, 0.02, -0.1, 0.15, 0.08, 0.1, 0.12)); break;
    case 'shotgun': case 'supershotgun':
      hand.add(M(G.box, wood, 0, -0.03, 0.05, 0.07, 0.09, 0.5));
      for (const s of (id === 'supershotgun' ? [-1, 1] : [0])) { const b = barrel(0.55, 0.028, 0.25); b.position.x = s * 0.03; hand.add(b); } break;
    case 'bazooka': case 'airburst': case 'firerain': {
      const tube = M(G.cyl, olive, 0.08, 0.14, 0.02, 0.085, 1.25, 0.085); tube.rotation.x = Math.PI / 2; hand.add(tube);
      hand.add(M(G.box, metal, 0.08, 0.25, 0.2, 0.025, 0.07, 0.06)); hand.add(M(G.box, poly, 0.08, 0.02, 0.1, 0.04, 0.13, 0.05)); break; }
    case 'mortar': { const t = M(G.cyl, olive, 0, 0, 0.2, 0.075, 0.6, 0.075); t.rotation.x = Math.PI / 2; hand.add(t); break; }
    case 'flamethrower':
      hand.add(M(G.box, metal, 0, 0, 0.2, 0.05, 0.07, 0.55)); hand.add(M(G.cyl, steel, 0, 0.0, 0.5, 0.04, 0.05, 0.04));
      back = new THREE.Group(); for (const s of [-1, 1]) back.add(M(G.cyl, olive, s * 0.1, 0, 0, 0.08, 0.45, 0.08)); break;
    case 'grenade': case 'shrapnel': case 'cluster':
      hand.add(M(G.sphere, olive, 0, 0.0, 0.1, 0.045, 0.055, 0.045)); hand.add(M(G.cyl, metal, 0, 0.06, 0.1, 0.015, 0.03, 0.015)); break;
    case 'gas': hand.add(M(G.cyl, mat(0x4a5230, { preset: 'gear' }), 0, 0.0, 0.1, 0.035, 0.12, 0.035)); break;
    case 'medball': hand.add(M(G.cyl, mat(0x5a5c58, { preset: 'gear' }), 0, 0.0, 0.1, 0.04, 0.12, 0.04)); hand.add(M(G.cyl, red, 0, 0.0, 0.1, 0.041, 0.03, 0.041)); break;
    case 'meddart': hand.add(M(G.box, mat(0x5a5c58, { preset: 'gear' }), 0, 0, 0.15, 0.05, 0.07, 0.4)); hand.add(barrel(0.3, 0.015, 0.3)); break;
    case 'knife': hand.add(M(G.box, steel, 0, 0.0, 0.18, 0.006, 0.035, 0.22)); hand.add(M(G.box, poly, 0, 0, 0.02, 0.022, 0.03, 0.1)); break;
    case 'sword': hand.add(M(G.box, steel, 0, 0.0, 0.42, 0.008, 0.045, 0.75)); hand.add(M(G.box, mat(0x5a4a2a, { preset: 'metal' }), 0, 0, 0.05, 0.02, 0.12, 0.03)); break;
    case 'prod': hand.add(M(G.cyl, poly, 0, 0, 0.35, 0.02, 0.7, 0.02).rotateX(Math.PI / 2)); hand.add(M(G.box, mat(0x3a4a5a, { preset: 'metal', emissive: 0x0a1822 }), 0, 0, 0.72, 0.08, 0.015, 0.04)); break;
    case 'knuckles': hand.add(M(G.torus, steel, 0, 0, 0.04, 0.04, 0.04, 0.12).rotateY(Math.PI / 2)); break;
    case 'tnt': for (let i = 0; i < 3; i++) hand.add(M(G.cyl, red, (i - 1) * 0.045, 0.0, 0.1, 0.022, 0.18, 0.022)); break;
    case 'mine': hand.add(M(G.cyl, olive, 0, 0.0, 0.14, 0.12, 0.05, 0.12)); break;
    case 'medkit': case 'selfheal': case 'healhands':
      hand.add(M(G.box, mat(0x5a5c58, { preset: 'gear' }), 0, 0.0, 0.1, 0.14, 0.1, 0.06)); hand.add(M(G.box, red, 0, 0.0, 0.132, 0.08, 0.025, 0.004)); hand.add(M(G.box, red, 0, 0.0, 0.132, 0.025, 0.08, 0.004)); break;
    case 'jetpack': back = new THREE.Group(); for (const s of [-1, 1]) { back.add(M(G.cyl, steel, s * 0.11, 0, 0, 0.08, 0.45, 0.08)); back.add(M(G.cone, metal, s * 0.11, -0.27, 0, 0.065, 0.1, 0.065).rotateX(Math.PI)); } break;
    case 'airstrike': hand.add(M(G.box, poly, 0, 0.0, 0.1, 0.07, 0.11, 0.04)); hand.add(M(G.cyl, metal, 0.025, 0.1, 0.1, 0.006, 0.12, 0.006)); break;
    default: break;
  }
  hand.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { hand, back };
}

/* ================= могила бойца: винтовка штыком в землю, каска сверху ================= */
export function buildGrave(nation) {
  geo();
  const g = new THREE.Group();
  g.add(M(G.dome, mat(0x2a2218, { preset: 'terrain' }), 0, 0, 0, 0.6, 0.18, 0.9));
  const rifle = mat(0x1e2022, { preset: 'gunmetal' }), stock = mat(0x2a2c24, { preset: 'gear' });
  g.add(M(G.box, rifle, 0, 0.45, 0, 0.03, 0.9, 0.04));
  g.add(M(G.box, stock, 0, 0.95, 0, 0.05, 0.28, 0.1));
  const helm = buildHelmet(nation, 'base'); helm.position.set(0, 1.02, 0); helm.scale.setScalar(1.05); g.add(helm);
  const tags = mat(0x7a7e82, { preset: 'metal' });
  g.add(M(G.box, tags, 0.03, 0.72, 0.03, 0.002, 0.05, 0.03));
  return g;
}

/* ================= техника ================= */
export function buildTank(nation) {
  geo();
  const g = new THREE.Group(), body = mat(shade(nation.color, 0.75), { preset: 'helmet', map: TEX.fabric }), dark = mat(0x16171a, { preset: 'gear' }), metal = mat(0x2c2e30, { preset: 'metal' });
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
  g.add(M(G.box, mat(0x8a8474, { preset: 'fabric' }), 1.11, 1.0, 0, 0.02, 0.3, 0.3));
  g.userData = { turret, gun };
  return g;
}
export function buildPillbox() {
  geo();
  const g = new THREE.Group();
  const c = mat(0x9a968c, { preset: 'concrete', map: TEX.concrete });
  g.add(M(new THREE.CylinderGeometry(2.1, 2.4, 1.7, 8), c, 0, 0.85, 0));
  g.add(M(new THREE.CylinderGeometry(2.4, 2.3, 0.35, 8), c, 0, 1.85, 0));
  g.add(M(G.cyl, mat(0x0a0908, { preset: 'concrete' }), 0, 1.3, 0, 2.12, 0.28, 2.12));
  const pivot = new THREE.Group(); pivot.position.set(0, 1.3, 0); g.add(pivot);
  const gun = new THREE.Group(); gun.position.set(0, 0, 1.9); pivot.add(gun);
  const b = M(G.cyl, mat(0x1e2022, { preset: 'gunmetal' }), 0, 0, 0.5, 0.07, 1.0, 0.07); b.rotation.x = Math.PI / 2; gun.add(b);
  g.userData = { turret: pivot, gun };
  return g;
}
export function buildArtillery(nation) {
  geo();
  const g = new THREE.Group(), body = mat(shade(nation ? nation.color : 0x3a3e2c, 0.75), { preset: 'helmet' }), metal = mat(0x26282a, { preset: 'metal' }), wood = mat(0x3a2818, { preset: 'wood' });
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

/* ================= постройки ================= */
export function buildHouse(w, d, h) {
  geo();
  const g = new THREE.Group();
  const tex = TEX.stone.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(w / 3, h / 2);
  const stone = mat(0xb0aaa0, { preset: 'stone', map: tex, unique: true });
  g.add(M(G.box, stone, 0, h / 2, 0, w, h, d));
  const roof = mat(0x2a221c, { preset: 'wood' });
  g.add(M(G.box, roof, 0, h + 0.1, 0, w + 0.3, 0.2, d + 0.3));
  for (const s of [-1, 1]) { g.add(M(G.box, roof, s * (w / 2 + 0.05), h + 0.4, 0, 0.2, 0.4, d + 0.3)); g.add(M(G.box, roof, 0, h + 0.4, s * (d / 2 + 0.05), w + 0.3, 0.4, 0.2)); }
  g.add(M(G.box, mat(0x2e2a26, { preset: 'stone' }), w * 0.3, h + 0.8, d * 0.2, 0.5, 1.0, 0.5));
  const win = mat(0x0b0d0e, { preset: 'eye' }), frame = mat(0x3a332a, { preset: 'wood' });
  for (const s of [-1, 1]) {
    for (const k of [-0.25, 0.25]) {
      g.add(M(G.box, frame, w * k, h * 0.6, s * (d / 2 + 0.01), 0.9, 0.9, 0.04));
      g.add(M(G.box, win, w * k, h * 0.6, s * (d / 2 + 0.03), 0.7, 0.7, 0.04));
    }
  }
  g.add(M(G.box, mat(0x241a12, { preset: 'wood' }), 0, 0.9, d / 2 + 0.02, 1.0, 1.8, 0.05));
  return g;
}
export function buildMill() {
  geo();
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(1.4, 2.0, 7, 10), mat(0xa8a298, { preset: 'stone', map: TEX.stone }), 0, 3.5, 0));
  g.add(M(G.cone, mat(0x2a221c, { preset: 'wood' }), 0, 7.8, 0, 1.7, 1.8, 1.7));
  const hub = new THREE.Group(); hub.position.set(0, 6.6, 1.6); g.add(hub);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group(); blade.rotation.z = i * Math.PI / 2;
    blade.add(M(G.box, mat(0x33261a, { preset: 'wood' }), 0, 2.5, 0, 0.15, 5, 0.1)); blade.add(M(G.box, mat(0x6e685a, { preset: 'fabric' }), 0.4, 3, 0, 0.7, 3.6, 0.04));
    hub.add(blade);
  }
  g.userData = { hub };
  return g;
}
export function buildSandbags(len) {
  geo();
  const g = new THREE.Group(), m = mat(0xc8c0b0, { preset: 'fabric', map: TEX.sandbag });
  const n = Math.round(len / 0.7);
  for (let row = 0; row < 3; row++) for (let i = 0; i < n - (row % 2); i++) {
    g.add(M(G.sphere, m, -len / 2 + 0.35 + i * 0.7 + (row % 2) * 0.35, 0.18 + row * 0.3, rnd(-0.03, 0.03), 0.38, 0.17, 0.3));
  }
  return g;
}
export function buildFence(len) {
  geo();
  const g = new THREE.Group(), w = mat(0x3a2c1e, { preset: 'wood' });
  const n = Math.max(2, Math.round(len / 1.5) + 1);
  for (let i = 0; i < n; i++) g.add(M(G.box, w, -len / 2 + i * len / (n - 1), 0.55, 0, 0.12, 1.1, 0.12));
  for (const y of [0.4, 0.85]) g.add(M(G.box, w, 0, y, 0, len, 0.1, 0.05));
  return g;
}
export function buildWire(len) {
  geo();
  const g = new THREE.Group(), w = mat(0x2e2418, { preset: 'wood' }), wire = mat(0x2a2a2a, { preset: 'metal' });
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
  const g = new THREE.Group(), wood = mat(0xc0b8a8, { preset: 'wood', map: TEX.wood }), dark = mat(0x241a12, { preset: 'wood' });
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
  const m = M(G.dodeca, mat(0x46423c, { preset: 'stone', map: TEX.concrete }), 0, r * 0.4, 0, r, r * 0.7, r * rnd(0.8, 1.2));
  m.rotation.set(rnd(0, 1), rnd(0, 6), rnd(0, 1));
  const g = new THREE.Group(); g.add(m); return g;
}
export function buildBarrel() {
  geo();
  const g = new THREE.Group();
  g.add(M(G.cyl, mat(0x5a2418, { preset: 'helmet' }), 0, 0.55, 0, 0.42, 1.1, 0.42));
  for (const y of [0.25, 0.85]) g.add(M(G.cyl, mat(0x1c1612, { preset: 'metal' }), 0, y, 0, 0.43, 0.06, 0.43));
  g.add(M(G.cyl, mat(0x7a6420, { preset: 'helmet' }), 0, 0.55, 0, 0.43, 0.12, 0.43));
  return g;
}
export function buildCrate(type) {
  geo();
  const g = new THREE.Group();
  if (type === 'medal') {
    // наградной знак: бронзовый крест на ленте
    const bronze = mat(0x7a5a2a, { preset: 'metal' });
    const cross = new THREE.Group(); cross.position.y = 1.0;
    cross.add(M(G.box, bronze, 0, 0, 0, 0.12, 0.5, 0.04)); cross.add(M(G.box, bronze, 0, 0.04, 0, 0.42, 0.12, 0.04));
    cross.add(M(G.cyl, mat(0x4a3418, { preset: 'metal' }), 0, 0.04, 0.02, 0.07, 0.03, 0.07).rotateX(Math.PI / 2));
    g.add(cross); g.add(M(G.box, mat(0x3a1c1a, { preset: 'fabric' }), 0, 1.42, 0, 0.18, 0.3, 0.02));
    g.userData.spin = cross;
    return g;
  }
  const m = mat(0xffffff, { preset: 'wood', map: type === 'health' ? TEX.crateHealth : TEX.crateWeapon });
  g.add(M(G.box, m, 0, 0.45, 0, 0.9, 0.9, 0.9));
  return g;
}
export function buildParachute() {
  geo();
  const g = new THREE.Group();
  const c = M(new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0x5a5a48, { preset: 'fabric', side: THREE.DoubleSide }), 0, 3.0, 0, 1, 0.6, 1);
  g.add(c);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * 1.4, 2.9, Math.sin(a) * 1.4), new THREE.Vector3(0, 0.9, 0)]), lineMat));
  }
  return g;
}
export function buildBlimp() {
  geo();
  const g = new THREE.Group();
  g.add(M(G.sphere, mat(0x4a4a44, { preset: 'fabric' }), 0, 0, 0, 2.6, 2.6, 8));
  g.add(M(G.box, mat(0x26221c, { preset: 'gear' }), 0, -2.9, 0, 1.2, 0.8, 3));
  for (const s of [-1, 1]) g.add(M(G.box, mat(0x2e2a26, { preset: 'gear' }), s * 1.8, 0, -6.5, 2.2, 0.15, 1.6));
  g.add(M(G.box, mat(0x2e2a26, { preset: 'gear' }), 0, 1.8, -6.5, 0.15, 2.2, 1.6));
  return g;
}
export function buildPlane() {
  geo();
  const g = new THREE.Group(), body = mat(0x2e3228, { preset: 'helmet' }), dark = mat(0x151515, { preset: 'metal' });
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
  g.add(M(G.cyl, mat(0x2a2218, { preset: 'wood' }), 0, 2.5, 0, 0.06, 5, 0.06));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 10, 4), mat(color, { preset: 'fabric', side: THREE.DoubleSide, unique: true }));
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

/* ================= растительность ================= */
export function buildTree(type) {
  geo();
  const g = new THREE.Group(), s = rnd(0.8, 1.3);
  const trunk = mat(0x2e2218, { preset: 'wood' }), leaf = c => mat(c, { preset: 'foliage' });
  switch (type) {
    case 'oak':
      g.add(M(G.cylLo, trunk, 0, 1.2 * s, 0, 0.25 * s, 2.4 * s, 0.25 * s));
      for (let i = 0; i < 6; i++) g.add(M(G.ico, leaf(i % 2 ? 0x26341a : 0x2e3d1e), rnd(-0.9, 0.9) * s, (2.6 + rnd(0, 1.2)) * s, rnd(-0.9, 0.9) * s, rnd(1.0, 1.4) * s));
      break;
    case 'willow':
      g.add(M(G.cylLo, trunk, 0, 1.3 * s, 0, 0.3 * s, 2.6 * s, 0.3 * s));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(M(G.coneLo, leaf(0x333a1e), Math.cos(a) * 1.1 * s, 2.2 * s, Math.sin(a) * 1.1 * s, 0.8 * s, 2.4 * s, 0.8 * s).rotateX(Math.PI)); }
      g.add(M(G.ico, leaf(0x2c341c), 0, 3.2 * s, 0, 1.4 * s));
      break;
    case 'dead':
      g.add(M(G.cylLo, mat(0x221a14, { preset: 'wood' }), 0, 1.6 * s, 0, 0.2 * s, 3.2 * s, 0.2 * s));
      for (let i = 0; i < 4; i++) { const b = M(G.cylLo, mat(0x221a14, { preset: 'wood' }), 0, (1.6 + i * 0.4) * s, 0, 0.07 * s, 1.4 * s, 0.07 * s); b.rotation.set(rnd(-1, 1), rnd(0, 6), rnd(0.6, 1.1) * (i % 2 ? 1 : -1)); b.position.x = (i % 2 ? 0.4 : -0.4) * s; g.add(b); }
      break;
    case 'palm': {
      let y = 0, x = 0; const lean = rnd(-0.3, 0.3);
      for (let i = 0; i < 6; i++) { g.add(M(G.cylLo, mat(0x4a3a26, { preset: 'wood' }), x, y + 0.35 * s, 0, 0.18 * s, 0.75 * s, 0.18 * s)); y += 0.7 * s; x += lean * 0.3; }
      for (let i = 0; i < 7; i++) { const l = M(G.box, leaf(0x33401c), x, y, 0, 0.35 * s, 0.05, 2.2 * s); l.rotation.y = i / 7 * Math.PI * 2; l.rotation.x = 0.5; l.translateZ(1.0 * s); g.add(l); }
      break; }
    case 'cactus': {
      const c = leaf(0x2e3e24);
      g.add(M(G.cylLo, c, 0, 1.2 * s, 0, 0.3 * s, 2.4 * s, 0.3 * s));
      for (const sd of [-1, 1]) { g.add(M(G.cylLo, c, sd * 0.5 * s, 1.1 * s, 0, 0.18 * s, 0.2 * s, 0.18 * s).rotateZ(Math.PI / 2)); g.add(M(G.cylLo, c, sd * 0.65 * s, 1.5 * s, 0, 0.18 * s, 0.8 * s, 0.18 * s)); }
      break; }
    case 'snowpine':
    case 'pine':
    default: {
      g.add(M(G.cylLo, trunk, 0, 0.7 * s, 0, 0.2 * s, 1.4 * s, 0.2 * s));
      const green = leaf(0x1a2a1a), snow = leaf(0xb8bec4);
      for (let i = 0; i < 3; i++) {
        g.add(M(G.coneLo, green, 0, (1.6 + i * 1.05) * s, 0, (1.5 - i * 0.38) * s, 1.9 * s, (1.5 - i * 0.38) * s));
        if (type === 'snowpine') g.add(M(G.coneLo, snow, 0, (1.95 + i * 1.05) * s, 0, (1.15 - i * 0.3) * s, 1.1 * s, (1.15 - i * 0.3) * s));
      }
    }
  }
  g.userData.trunkR = 0.35 * s;
  return g;
}

/* ================= портреты для меню: погрудный план ================= */
let portraitRenderer = null, portraitScene = null, portraitCam = null;
export function renderPortrait(nation, rankId, rankLine, size = 128) {
  if (!portraitRenderer) {
    const c = document.createElement('canvas');
    portraitRenderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping; portraitRenderer.toneMappingExposure = 1.15;
    portraitScene = new THREE.Scene();
    portraitScene.add(new THREE.HemisphereLight(0xc8ccd0, 0x2a2018, 0.9));
    const key = new THREE.DirectionalLight(0xffe2c0, 1.5); key.position.set(2, 3, 3); portraitScene.add(key);
    const rim = new THREE.DirectionalLight(0x8aa0c0, 0.9); rim.position.set(-3, 2, -2); portraitScene.add(rim);
    portraitCam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  }
  portraitRenderer.setSize(size, size, false);
  const fox = new BipedalFox(nation, rankId, rankLine);
  fox.setWeapon(null);
  fox.update(1, FoxAnim.IDLE, 0, false);
  fox.head.rotation.y = 0.2;
  fox.root.rotation.y = 0.45;
  portraitScene.add(fox.root);
  portraitCam.position.set(0.42, 1.74, 0.98); portraitCam.lookAt(0.02, 1.6, 0.06);
  portraitRenderer.render(portraitScene, portraitCam);
  portraitScene.remove(fox.root);
  return portraitRenderer.domElement.toDataURL('image/png');
}
export { clamp };
