// Доспехи героев в духе коллекционных фэнтези-RPG: латы с окантовкой, многослойные наплечники,
// плащ с физикой ткани, геральдика фракции, светящиеся камни по редкости. Всё процедурное.
// Модели и текстуры собственные; стиль — только ориентир, ассеты сторонних игр не используются.
import { THREE } from './core.js';
import { HERALDRY, rarityOf } from './theme.js';
import { mat, M, geo, TEX } from './models.js';

const RIM = 0x39434f; // холодный контровой свет по силуэту

// Вес доспеха по ветке званий: тяжёлые — полные латы, разведчики — кожа и капюшон.
const WEIGHT = { base: 0.85, heavy: 1.28, eng: 1.05, spy: 0.7, medic: 0.8, officer: 1.15 };

/* ---------- общие геометрии ---------- */
const H = {};
function hgeo() {
  if (H.ring) return H;
  H.ring = new THREE.TorusGeometry(1, 0.045, 6, 36).rotateX(Math.PI / 2);         // горизонтальная окантовка
  H.bandOpen = new THREE.CylinderGeometry(1, 1.07, 1, 28, 1, true);               // кольцевая пластина
  H.cap = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42); // купол наплечника
  H.gem = new THREE.OctahedronGeometry(1, 0);
  H.furRing = new THREE.TorusGeometry(1, 0.22, 8, 28).rotateX(Math.PI / 2);        // меховая опушка
  H.lame = [1, -1].map(s => new THREE.CylinderGeometry(1, 1.07, 1, 16, 1, true, s * Math.PI / 2 - 1.35, 2.7)); // пластина наплечника снаружи
  H.backGuard = new THREE.CylinderGeometry(1, 1.25, 1, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9); // назатыльник (только сзади)
  H.spike = new THREE.ConeGeometry(1, 1, 10);
  // Кираса: профиль вращения (радиус, высота) — талия, грудь, плечевой срез.
  H.cuirass = new THREE.LatheGeometry([
    [0.168, 0.04], [0.186, 0.1], [0.206, 0.18], [0.222, 0.27], [0.224, 0.33], [0.21, 0.385], [0.178, 0.425], [0.13, 0.452], [0.09, 0.462],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  // Лисий герб: голова с ушами (выдавленный контур с фаской).
  const fox = new THREE.Shape();
  fox.moveTo(0, -1); fox.lineTo(0.5, -0.2); fox.lineTo(0.62, 0.35); fox.lineTo(0.8, 1); fox.lineTo(0.32, 0.5);
  fox.lineTo(-0.32, 0.5); fox.lineTo(-0.8, 1); fox.lineTo(-0.62, 0.35); fox.lineTo(-0.5, -0.2); fox.closePath();
  H.sigil = new THREE.ExtrudeGeometry(fox, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  // Табард: трапеция с заострённым низом.
  const tab = new THREE.Shape();
  tab.moveTo(-0.1, 0); tab.lineTo(0.1, 0); tab.lineTo(0.085, -0.34); tab.lineTo(0, -0.42); tab.lineTo(-0.085, -0.34); tab.closePath();
  H.tabard = new THREE.ExtrudeGeometry(tab, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 });
  // Перо (крылья шлема): вытянутый лист.
  const f = new THREE.Shape();
  f.moveTo(0, 0); f.quadraticCurveTo(0.3, 0.25, 1, 0.12); f.quadraticCurveTo(0.35, -0.02, 0, 0);
  H.feather = new THREE.ExtrudeGeometry(f, { depth: 0.04, bevelEnabled: false });
  // Луковичный купол шишака.
  H.onion = new THREE.LatheGeometry([[0.001, 0.26], [0.03, 0.2], [0.09, 0.14], [0.15, 0.07], [0.158, 0.02], [0.15, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 24);
  // Рог: изогнутая труба с сужением.
  const horn = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; horn.push(new THREE.Vector3(Math.sin(t * 1.9) * 0.2, t * 0.16 + Math.sin(t * 2.4) * 0.06, -Math.sin(t * 1.4) * 0.07)); }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(horn), 16, 1, 8, false);
  const pos = tube.attributes.position, nrm = tube.attributes.normal, pts = new THREE.CatmullRomCurve3(horn);
  for (let i = 0; i < pos.count; i++) { // сужение к кончику: сдвигаем вершины к оси
    const seg = Math.floor(i / 9) / 16, c = pts.getPointAt(Math.min(1, seg)), r = 0.034 * (1 - seg * 0.92);
    pos.setXYZ(i, c.x + nrm.getX(i) * r, c.y + nrm.getY(i) * r, c.z + nrm.getZ(i) * r);
  }
  tube.computeVertexNormals(); H.horn = tube;
  return H;
}

/* ---------- комплект материалов героя ---------- */
export function heroKit(nation, level, line) {
  const her = HERALDRY[nation.id] || HERALDRY.uk, rar = rarityOf(level);
  const w = WEIGHT[line] || 1;
  const gold = rar.id !== 'common';
  return {
    her, rar, w, line, level,
    steel: mat(her.steel, { preset: 'armor', rim: RIM }),
    steelDark: mat(new THREE.Color(her.steel).multiplyScalar(0.55).getHex(), { preset: 'armor', rim: RIM }),
    trim: mat(rar.trim, { preset: gold ? 'gold' : 'armor' }),
    gem: mat(rar.glow, { preset: 'gem', emissive: rar.glow, emissiveIntensity: level >= 1 ? 1.6 : 0.2 }),
    cloth: mat(her.cloth, { preset: 'cloth', map: TEX.fabric, normalMap: TEX.fabricNormal, rim: RIM }),
    cloth2: mat(her.cloth2, { preset: 'cloth', map: TEX.fabric, rim: RIM }),
    leather: mat(0x2a1d14, { preset: 'leather', rim: RIM }),
    plume: mat(her.plume, { preset: 'fur', map: TEX.fur, rim: RIM }),
    fur: mat(0x3a2c22, { preset: 'fur', map: TEX.fur, normalMap: TEX.furNormal, rim: RIM }),
    glowEye: nation.id === 'ash',
    helmeted: line !== 'medic',
  };
}

// Камень редкости в золотой оправе.
function gemAt(g, k, x, y, z, s = 1) {
  const h = hgeo();
  g.add(M(h.ring, k.trim, x, y, z, 0.03 * s, 0.03 * s, 0.03 * s).rotateX(Math.PI / 2));
  const gem = M(h.gem, k.gem, x, y, z + 0.004 * s, 0.022 * s, 0.03 * s, 0.014 * s); g.add(gem);
  if (k.level >= 1) { // ореол свечения вокруг камня
    const halo = new THREE.Sprite(haloMat(k.rar.glow)); halo.position.set(x, y, z + 0.01 * s); halo.scale.setScalar(0.075 * s * (0.8 + k.level * 0.1));
    halo.userData.dynamic = true; g.add(halo);
  }
}
const haloCache = new Map();
function haloMat(color) {
  if (!haloCache.has(color)) haloCache.set(color, new THREE.SpriteMaterial({ map: TEX.soft, color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  return haloCache.get(color);
}

/* ---------- броня, крепится к суставам скелета лисы ---------- */
// j — суставы BipedalFox; возвращает анимируемые детали (табард, наплечники).
export function buildHeroArmor(j, k) {
  geo(); const h = hgeo();
  const w = k.w, heavy = w >= 1.1, light = k.line === 'spy' || k.line === 'medic';
  const plate = light ? k.leather : k.steel;
  const sp = j.spine, pv = j.pelvis;
  // поддоспешник-гамбезон цвета фракции
  sp.add(M(new THREE.CylinderGeometry(0.2, 0.165, 0.46, 20), k.cloth, 0, 0.22, 0, 1, 1, 0.72));
  // кираса (у лёгких — кожаная бригантина с заклёпками)
  sp.add(M(h.cuirass, plate, 0, 0, 0, 1 + (w - 1) * 0.12, 1, 0.78));
  sp.add(M(h.ring, k.trim, 0, 0.045, 0, 0.17, 0.3, 0.135));
  sp.add(M(h.ring, k.trim, 0, 0.455, 0, 0.115, 0.3, 0.092));
  sp.add(M(G_box(), k.trim, 0, 0.26, 0.176, 0.012, 0.24, 0.012)); // рёбро жёсткости
  if (light) for (let i = 0; i < 10; i++) { const a = -0.9 + i * 0.2; sp.add(M(h.gem, k.trim, Math.sin(a) * 0.2, 0.16 + (i % 2) * 0.1, Math.cos(a) * 0.162, 0.008)); }
  // герб на груди
  sp.add(M(h.sigil, k.trim, 0, 0.3, 0.166, 0.045, 0.045, 0.05));
  if (k.level >= 1) gemAt(sp, k, 0, 0.29, 0.182, 0.8);
  // горжет вокруг шеи
  sp.add(M(h.bandOpen, heavy ? k.steel : k.steelDark, 0, 0.475, 0, 0.1, 0.07, 0.092));
  sp.add(M(h.ring, k.trim, 0, 0.51, 0, 0.1, 0.3, 0.092));
  if (k.her === HERALDRY.ru || k.line === 'officer') sp.add(M(h.furRing, k.fur, 0, 0.47, -0.01, 0.13, 0.12, 0.11)); // меховой ворот
  // наплечники: неподвижны относительно корпуса, рука ходит под ними
  const pw = 0.9 + w * 0.32;
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.235, 0.43, 0); p.rotation.z = -s * 0.38; sp.add(p);
    p.add(M(h.cap, plate, 0, -0.02, 0, 0.12 * pw, 0.1 * pw, 0.125 * pw));
    p.add(M(h.ring, k.trim, 0, 0.05 * pw - 0.02, 0, 0.087 * pw, 0.3, 0.09 * pw));
    for (let i = 1; i <= (heavy ? 3 : 2); i++) {
      const r = (0.118 + i * 0.006) * pw, y = -0.02 - i * 0.034 * pw;
      const lg = h.lame[s > 0 ? 0 : 1];
      p.add(M(lg, i % 2 ? k.steelDark : plate, 0, y, 0, r, 0.036 * pw, r * 1.02));
      p.add(M(lg, k.trim, 0, y - 0.019 * pw, 0, r * 1.075, 0.008, r * 1.095));
    }
    if (heavy || k.level >= 4 || k.her === HERALDRY.ash) for (let i = -1; i <= 1; i++) {
      const sp2 = M(h.spike, k.trim, i * 0.035 * pw, 0.07 * pw, 0, 0.018 * pw, (i ? 0.07 : 0.1) * pw, 0.018 * pw); sp2.rotation.z = i * 0.3; p.add(sp2);
    }
    if (k.level >= 2) gemAt(p, k, 0, 0.0, 0.1 * pw, 0.75);
    if (k.her === HERALDRY.ru) p.add(M(G_sph(), k.fur, 0, 0.02, 0, 0.1 * pw, 0.05 * pw, 0.11 * pw));
  }
  // пояс, пряжка, табард спереди
  pv.add(M(h.bandOpen, k.leather, 0, 0.08, 0, 0.178, 0.06, 0.136));
  pv.add(M(G_box(), k.trim, 0, 0.08, 0.137, 0.07, 0.055, 0.014));
  if (k.level >= 1) gemAt(pv, k, 0, 0.08, 0.146, 0.7);
  // набедренные пластины-фолды
  for (let i = 0; i < (heavy ? 2 : 1); i++) {
    pv.add(M(h.bandOpen, i ? k.steelDark : plate, 0, 0.02 - i * 0.05, 0, 0.18 + i * 0.008, 0.05, 0.14 + i * 0.008));
    pv.add(M(h.ring, k.trim, 0, -0.005 - i * 0.05, 0, 0.19 + i * 0.008, 0.3, 0.15 + i * 0.008));
  }
  const tabard = new THREE.Group(); tabard.position.set(0, 0.05, 0.13); pv.add(tabard);
  tabard.add(M(H.tabard, k.level >= 2 ? k.trim : k.cloth2, 0, 0, -0.004, 1.12, 1.03, 1));
  tabard.add(M(H.tabard, k.cloth, 0, -0.01, 0.004, 1, 1, 1));
  tabard.add(M(h.sigil, k.trim, 0, -0.17, 0.02, 0.03, 0.03, 0.03));
  // ноги: набедренники, наколенники, поножи, латные носки
  for (const [s, key] of [[1, 'L'], [-1, 'R']]) {
    const hip = j['hip' + key], kn = j['kn' + key];
    const outer = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i < (heavy ? 3 : 2); i++) {
      const g = new THREE.CylinderGeometry(0.105 + i * 0.004, 0.11 + i * 0.004, 0.08, 14, 1, true, outer - 1.25, 2.5);
      hip.add(M(g, i % 2 ? k.steelDark : plate, 0, -0.06 - i * 0.065, 0, 1, 1, 1));
    }
    hip.add(M(h.ring, k.trim, 0, -0.1 - (heavy ? 2 : 1) * 0.065, 0, 0.112, 0.3, 0.114));
    kn.add(M(h.cap, k.steel, 0, 0.0, 0.03, 0.075, 0.07, 0.07).rotateX(Math.PI / 2));
    kn.add(M(h.spike, k.trim, 0, 0, 0.1, 0.018, 0.05, 0.018).rotateX(Math.PI / 2));
    kn.add(M(G_limb(), light ? k.leather : k.steel, 0, -0.2, 0.005, 0.078, 0.3, 0.08));
    kn.add(M(h.ring, k.trim, 0, -0.06, 0.005, 0.08, 0.3, 0.082));
    kn.add(M(G_box(), light ? k.leather : k.steelDark, 0, -0.44, 0.08, 0.1, 0.07, 0.17));
    kn.add(M(G_box(), k.trim, 0, -0.41, 0.12, 0.08, 0.012, 0.1));
  }
  // руки: наручи с окантовкой, налокотники, латные манжеты
  for (const key of ['L', 'R']) {
    const el = j['el' + key], sh = j['sh' + key];
    sh.add(M(G_limb(), k.cloth, 0, -0.14, 0, 0.064, 0.28, 0.064));
    el.add(M(G_sph(), k.steel, 0, 0, -0.01, 0.06, 0.055, 0.06));
    el.add(M(G_limb(), light ? k.leather : k.steel, 0, -0.12, 0, 0.062, 0.18, 0.062));
    el.add(M(h.ring, k.trim, 0, -0.035, 0, 0.064, 0.3, 0.064));
    el.add(M(h.ring, k.trim, 0, -0.205, 0, 0.056, 0.3, 0.056));
    if (k.level >= 3) gemAt(el, k, 0, -0.12, 0.062, 0.55);
  }
  return { tabard };
}

/* ---------- шлемы фракций ---------- */
export function buildHeroHelm(nation, k) {
  geo(); const h = hgeo();
  const g = new THREE.Group(); g.position.set(0, 0.062, -0.012);
  const her = k.her, st = k.steel, tr = k.trim;
  const dome = (m = st, sy = 0.13) => g.add(M(G_dome(), m, 0, 0.0, 0, 0.148, sy, 0.16));
  const brow = () => g.add(M(h.ring, tr, 0, 0.0, 0, 0.152, 0.3, 0.164));
  if (k.line === 'spy') { // капюшон и маска вместо шлема
    g.add(M(G_dome(), k.cloth2, 0, -0.03, -0.01, 0.172, 0.19, 0.185));
    g.add(M(G_cone(), k.cloth2, 0, 0.13, -0.16, 0.08, 0.14, 0.06).rotateX(-1.1));
    g.add(M(h.backGuard, k.cloth2, 0, -0.07, -0.01, 0.17, 0.16, 0.18));
    g.add(M(h.ring, tr, 0, 0.03, 0.01, 0.172, 0.3, 0.182));
    return g;
  }
  if (k.line === 'medic') { // целительница-жрица: золотой обруч с камнем
    g.add(M(h.ring, tr, 0, 0.0, 0.0, 0.132, 0.5, 0.142));
    g.add(M(h.spike, tr, 0, 0.04, 0.14, 0.02, 0.06, 0.012));
    gemAt(g, k, 0, 0.012, 0.146, 0.7);
    return g;
  }
  switch (her.helm) {
    case 'greathelm': // бацинет с наносником и плюмажем
      dome(); brow();
      g.add(M(h.backGuard, st, 0, -0.02, 0, 0.15, 0.1, 0.162));
      for (let i = 0; i < 6; i++) g.add(M(G_sph(), k.plume, 0, 0.19 + Math.sin(i / 5 * 2.6) * 0.07, 0.07 - i * 0.05, 0.03, 0.06, 0.045));
      break;
    case 'crested': { // галеа с поперечным гребнем
      dome(); brow();
      const crest = M(new THREE.TorusGeometry(0.15, 0.028, 8, 20, Math.PI), k.plume, 0, 0.06, 0, 1, 1, 1); crest.rotation.y = Math.PI / 2; g.add(crest);
      const base = M(new THREE.TorusGeometry(0.15, 0.012, 6, 20, Math.PI), tr, 0, 0.06, 0, 1, 1, 1); base.rotation.y = Math.PI / 2; g.add(base);
      g.add(M(h.backGuard, st, 0, -0.02, 0, 0.15, 0.1, 0.162));
      break;
    }
    case 'sallet': // салад с длинным назатыльником и козырьком
      dome(k.steel, 0.12); brow();
      g.add(M(G_cone(), st, 0, 0.02, -0.14, 0.13, 0.18, 0.05).rotateX(-1.25));
      g.add(M(G_box(), k.steelDark, 0, 0.06, 0.148, 0.24, 0.035, 0.03));
      g.add(M(G_box(), tr, 0, 0.078, 0.162, 0.24, 0.008, 0.01));
      break;
    case 'winged': // крылатый шлем со звездой
      dome(); brow();
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const f = M(H.feather, i ? st : tr, s * 0.14, 0.07 + i * 0.03, -0.02 - i * 0.02, 0.22 - i * 0.03, 0.26, 0.4);
        f.rotation.set(0, s > 0 ? -0.15 : Math.PI + 0.15, 0.55 + i * 0.22); g.add(f);
      }
      gemAt(g, k, 0, 0.1, 0.148, 0.9);
      break;
    case 'spangen': // шишак: луковичный купол, шпиль, меховая опушка, бармица
      g.add(M(H.onion, st, 0, 0.05, 0, 1, 1, 1.05));
      g.add(M(h.spike, tr, 0, 0.36, 0, 0.012, 0.1, 0.012));
      g.add(M(h.furRing, k.fur, 0, 0.05, 0, 0.15, 0.15, 0.16));
      g.add(M(h.backGuard, k.steelDark, 0, -0.04, 0, 0.15, 0.13, 0.15));
      break;
    case 'kabuto': // кабуто: рёбра купола, широкий ярусный назатыльник, золотой полумесяц
      dome(k.steelDark, 0.12);
      brow();
      for (let i = 0; i < 3; i++) g.add(M(h.backGuard, i % 2 ? k.cloth2 : k.steelDark, 0, 0.03 - i * 0.04, -0.01, 0.16 + i * 0.025, 0.045, 0.17 + i * 0.025));
      for (const s of [-1, 1]) { const fk = M(G_box(), k.steelDark, s * 0.15, 0.05, 0.08, 0.012, 0.06, 0.07); fk.rotation.y = s * 0.7; g.add(fk); } // фукигаэси
      { const c = M(new THREE.TorusGeometry(0.1, 0.012, 6, 24, Math.PI), tr, 0, 0.17, 0.14, 1, 1, 1); c.rotation.set(-0.2, 0, Math.PI); g.add(c); }
      gemAt(g, k, 0, 0.07, 0.152, 0.7);
      break;
    case 'horned': // Орден Пепла: чёрный шлем, рога, светящиеся прорези
      dome(k.steel);
      g.add(M(h.backGuard, k.steel, 0, -0.04, 0, 0.152, 0.12, 0.162));
      for (const s of [-1, 1]) { const hr = M(H.horn, k.steelDark, s * 0.11, 0.1, -0.02, 1, 1, 1); hr.scale.x = s; g.add(hr); }
      g.add(M(G_box(), mat(0xff3a1a, { preset: 'gem', emissive: 0xff2a10, emissiveIntensity: 2.2 }), 0, 0.035, 0.158, 0.14, 0.01, 0.01));
      for (const s of [-1, 1]) { const e = new THREE.Sprite(haloMat(0xff3a1a)); e.position.set(s * 0.04, 0.035, 0.165); e.scale.setScalar(0.07); e.userData.dynamic = true; g.add(e); }
      for (let i = -2; i <= 2; i++) g.add(M(h.spike, tr, i * 0.045, 0.16 - Math.abs(i) * 0.02, 0.07, 0.012, 0.06, 0.012));
      break;
    default: dome(); brow();
  }
  if (k.line === 'officer' || k.level >= 4) { // корона-гребень героя
    for (let i = -2; i <= 2; i++) g.add(M(h.spike, tr, i * 0.05, 0.11 - Math.abs(i) * 0.015, 0.12 - Math.abs(i) * 0.02, 0.012, 0.05, 0.012));
  }
  if (k.line === 'eng') g.add(M(G_box(), mat(0x1c2a30, { preset: 'gem', emissive: k.rar.glow, emissiveIntensity: 0.5 }), 0, 0.075, 0.14, 0.2, 0.04, 0.03)); // очки-гогглы
  return g;
}

/* ---------- плащ с физикой ткани ---------- */
const capeTexCache = new Map();
function capeTexture(k) {
  const key = k.her.cloth + ':' + k.rar.id;
  if (capeTexCache.has(key)) return capeTexCache.get(key);
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  const col = new THREE.Color(k.her.cloth), dk = col.clone().multiplyScalar(0.45);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#' + col.getHexString()); g.addColorStop(1, '#' + dk.getHexString());
  x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.05)`; x.fillRect(Math.random() * 128, Math.random() * 256, 1, 3); }
  const trim = '#' + new THREE.Color(k.rar.trim).getHexString(), c2 = '#' + new THREE.Color(k.her.cloth2).getHexString();
  if (k.level >= 1) { // кайма и орнамент
    x.fillStyle = c2; x.fillRect(0, 0, 10, 256); x.fillRect(118, 0, 10, 256); x.fillRect(0, 238, 128, 18);
    x.fillStyle = trim; x.fillRect(10, 0, 3, 238); x.fillRect(115, 0, 3, 238); x.fillRect(10, 235, 108, 3);
    for (let y = 12; y < 230; y += 14) { x.beginPath(); x.moveTo(5, y); x.lineTo(8, y + 5); x.lineTo(5, y + 10); x.lineTo(2, y + 5); x.fill(); x.beginPath(); x.moveTo(123, y); x.lineTo(126, y + 5); x.lineTo(123, y + 10); x.lineTo(120, y + 5); x.fill(); }
  }
  // лисий герб
  x.save(); x.translate(64, 108); x.fillStyle = k.level >= 1 ? trim : c2; x.globalAlpha = 0.9;
  x.beginPath(); x.moveTo(0, 34); x.lineTo(17, 7); x.lineTo(21, -12); x.lineTo(27, -34); x.lineTo(11, -17); x.lineTo(-11, -17); x.lineTo(-27, -34); x.lineTo(-21, -12); x.lineTo(-17, 7); x.closePath(); x.fill();
  x.fillStyle = '#' + dk.getHexString(); x.beginPath(); x.arc(-8, -2, 3, 0, 7); x.arc(8, -2, 3, 0, 7); x.fill();
  if (k.level >= 3) { x.strokeStyle = trim; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 44, 0, Math.PI * 2); x.stroke(); }
  x.restore();
  if (k.level === 0) { // у рядовых — рваный край
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) { const px = Math.random() * 128; x.beginPath(); x.moveTo(px - 8, 256); x.lineTo(px, 256 - Math.random() * 40 - 10); x.lineTo(px + 8, 256); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  capeTexCache.set(key, t); return t;
}
export class Cape {
  constructor(k) {
    this.len = 0.62 + Math.min(4, k.level) * 0.05; this.hw = 0.21 + k.w * 0.02;
    const g = this.geo = new THREE.PlaneGeometry(this.hw * 2, this.len, 6, 12);
    g.translate(0, -this.len / 2, 0);
    this.base = Float32Array.from(g.attributes.position.array);
    const m = mat(0xffffff, { preset: 'cloth', map: capeTexture(k), side: THREE.DoubleSide, alphaTest: 0.5, rim: RIM, unique: true });
    this.mesh = new THREE.Mesh(g, m); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.userData.dynamic = true;
    this.update(0, 0);
  }
  // move 0..1 — скорость (развевается), t — время.
  update(t, move) {
    const p = this.geo.attributes.position.array, b = this.base, L = this.len;
    for (let i = 0; i < p.length; i += 3) {
      const x0 = b[i], y0 = b[i + 1], v = -y0 / L, e = x0 / this.hw;
      const wave = Math.sin(t * 2.6 + v * 5 + x0 * 6) * (0.018 + move * 0.05) * v;
      p[i] = x0 * (1 + v * 0.38) + Math.sin(t * 1.7 + v * 4) * 0.008 * v;
      p[i + 1] = y0 + move * v * v * 0.16;
      p[i + 2] = 0.07 * e * e * Math.pow(1 - v, 3) - 0.03 - Math.sin(Math.PI * Math.min(1, v * 1.4)) * 0.05 - v * v * (0.12 + move * 0.4) - Math.max(0, v - 0.5) * 0.18 + wave;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

/* ---------- аура редкости: свечение под ногами и искры ---------- */
let auraTex = null;
function auraTexture() {
  if (auraTex) return auraTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,.08)'); g.addColorStop(0.8, 'rgba(255,255,255,.7)'); g.addColorStop(0.86, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5; x.translate(64, 64);
  for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, -44); x.lineTo(3, -38); x.lineTo(0, -32); x.lineTo(-3, -38); x.closePath(); x.stroke(); }
  auraTex = new THREE.CanvasTexture(c); return auraTex;
}
export class Aura {
  constructor(k) {
    this.group = new THREE.Group(); this.group.userData.dynamic = true;
    const col = k.rar.glow;
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: auraTexture(), color: col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; this.group.add(this.ring);
    this.motes = [];
    const sm = new THREE.SpriteMaterial({ map: TEX.soft, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(sm); s.scale.setScalar(0.07); this.group.add(s);
      this.motes.push({ s, a: Math.random() * 6.28, r: 0.35 + Math.random() * 0.25, v: 0.3 + Math.random() * 0.4, y: Math.random() * 1.8 });
    }
  }
  update(t, dt) {
    this.ring.rotation.z = t * 0.4; this.ring.material.opacity = 0.5 + Math.sin(t * 2.2) * 0.15;
    for (const m of this.motes) {
      m.y += m.v * dt; if (m.y > 2) m.y = 0;
      m.a += dt * 0.8; m.s.position.set(Math.cos(m.a) * m.r, m.y, Math.sin(m.a) * m.r);
      m.s.material.opacity = Math.sin(m.y / 2 * Math.PI) * 0.9;
    }
  }
}

/* ---------- украшение оружия: золотые кольца и камень по редкости ---------- */
export function ornamentWeapon(hand, k) {
  if (!hand || k.level < 1 || !hand.children.length) return;
  const box = new THREE.Box3().setFromObject(hand), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  if (size.z < 0.18) return; // гранаты, аптечки — без украшений
  const r = Math.max(0.02, Math.min(size.x, size.y) * 0.5) * 1.08, h = hgeo();
  for (const f of [0.28, 0.62]) {
    const ring = M(h.ring, k.trim, c.x, c.y, box.min.z + size.z * f, r, r * 1.2, r); ring.rotation.x = Math.PI / 2; hand.add(ring);
  }
  if (k.level >= 2) hand.add(M(h.gem, k.gem, c.x + size.x * 0.5 + 0.01, c.y, box.min.z + size.z * 0.45, 0.018, 0.025, 0.012));
}

/* ---------- запекание статических деталей: меньше вызовов отрисовки ---------- */
// Сливает меши-потомки узла (кроме помеченных dynamic и узлов из stops) в один меш на материал.
export function bakeStatic(node, stops) {
  const groups = new Map(), inv = new THREE.Matrix4();
  node.updateMatrixWorld(true); inv.copy(node.matrixWorld).invert();
  const victims = [];
  const walk = o => {
    for (const ch of o.children) {
      if (stops.has(ch) || ch.userData.dynamic) continue;
      if (ch.isMesh && !ch.isSkinnedMesh) {
        const mtx = new THREE.Matrix4().multiplyMatrices(inv, ch.matrixWorld);
        if (!groups.has(ch.material)) groups.set(ch.material, []);
        groups.get(ch.material).push({ geo: ch.geometry, mtx });
        victims.push(ch);
      }
      walk(ch);
    }
  };
  walk(node);
  for (const v of victims) {
    // потомков-узлов остановки переносим к родителю, чтобы не потерять
    for (const ch of [...v.children]) { if (stops.has(ch) || ch.userData.dynamic) { v.parent.attach(ch); } }
    v.parent.remove(v);
  }
  for (const [material, list] of groups) {
    const merged = mergeGeos(list);
    const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.foxPart = true;
    node.add(mesh);
  }
  // пустые группы без узлов остановки удаляем
  const prune = o => { for (const ch of [...o.children]) { if (stops.has(ch) || ch.userData.dynamic) continue; prune(ch); if (!ch.isMesh && ch.children.length === 0 && !ch.userData.keep) o.remove(ch); } };
  prune(node);
}
function mergeGeos(list) {
  let n = 0; const parts = [];
  for (const { geo: g, mtx } of list) {
    const ng = (g.index ? g.toNonIndexed() : g.clone()); ng.applyMatrix4(mtx);
    // отрицательный масштаб выворачивает треугольники — возвращаем порядок обхода
    if (mtx.determinant() < 0) { const p = ng.attributes.position.array, nn = ng.attributes.normal.array, uv = ng.attributes.uv && ng.attributes.uv.array; for (let i = 0; i < p.length; i += 9) { for (let c = 0; c < 3; c++) { const a = i + 3 + c, b = i + 6 + c; [p[a], p[b]] = [p[b], p[a]]; [nn[a], nn[b]] = [nn[b], nn[a]]; } if (uv) { const u = i / 9 * 6; for (let c = 0; c < 2; c++) { const a = u + 2 + c, b = u + 4 + c; [uv[a], uv[b]] = [uv[b], uv[a]]; } } } }
    parts.push(ng); n += ng.attributes.position.count;
  }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

/* ---------- карта окружения для отражений металла (PMREM) ---------- */
const envCache = new Map();
export function makeEnvironment(renderer, top, horizon, ground, key) {
  if (envCache.has(key)) return envCache.get(key);
  const scene = new THREE.Scene();
  const geo2 = new THREE.SphereGeometry(10, 32, 16), col = [];
  const cT = new THREE.Color(top), cH = new THREE.Color(horizon), cG = new THREE.Color(ground);
  const p = geo2.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; const c = y > 0 ? cH.clone().lerp(cT, Math.pow(y, 0.6)) : cH.clone().lerp(cG, Math.min(1, -y * 3)); col.push(c.r, c.g, c.b); }
  geo2.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // яркие «софтбоксы» дают блики на полированной стали и золоте
  const panel = (x, y, z, w, h, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m); };
  panel(5, 6, 5, 5, 3, 0xfff0dc); panel(-7, 3, -4, 3, 5, 0x9ab0d0); panel(0, 9, -3, 6, 2, 0xffffff); panel(-3, 2, 8, 2, 2, 0xffd8a8);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.03);
  pm.dispose();
  envCache.set(key, rt.texture);
  return rt.texture;
}

/* ---------- мелкие обёртки геометрий из models.js ---------- */
const G_box = () => geo().box, G_sph = () => geo().sphere, G_limb = () => geo().limb, G_dome = () => geo().dome, G_cone = () => geo().cone;
export { rarityOf };
