// Мир: рельеф, вода, небо, погода, постройки и столкновения.
import { THREE, clamp, smooth, mulberry, makeNoise, hash, rnd } from './core.js';
import { THEMES } from './data.js';
import * as MD from './models.js';
import { VFX } from './theme.js';

export const N = 129, SIZE = 160, HALF = SIZE / 2, CELL = SIZE / (N - 1), WATER_Y = 0;

export class World {
  constructor(scene, def, quality) {
    this.scene = scene; this.def = def; this.quality = quality;
    this.theme = THEMES[def.theme];
    this.rng = mulberry(def.seed || 1);
    this.heights = new Float32Array(N * N);
    this.scorch = new Uint8Array(N * N);
    this.colliders = [];   // {kind, x, z, hx, hz, r, rot, y0, y1, walk, ent}
    this.ents = [];        // разрушаемые объекты {kind, hp, maxHp, obj, col, onDestroy}
    this.trees = [];
    this.anim = [];        // объекты с анимацией (мельница, флаги)
    this.t = 0;
    this.spawnZones = [{ x: [-62, -22], z: [-50, 50] }, { x: [22, 62], z: [-50, 50] }];
    this.genHeights();
    this.buildLights();
    this.buildSky();
    this.placeProps();
    this.buildTerrainMesh();
    this.buildWater();
    this.buildWeather();
  }
  srnd(a, b) { return a + this.rng() * (b - a); }

  /* ---------- рельеф ---------- */
  genHeights() {
    const T = this.def.terrain, noise = makeNoise(this.rng), H = this.heights;
    const isl = [];
    if (T === 'islands') for (let i = 0; i < 7; i++) isl.push({ x: i === 0 ? -42 : i === 1 ? 42 : this.srnd(-40, 40), z: i < 2 ? this.srnd(-10, 10) : this.srnd(-45, 45), r: i < 2 ? 20 : this.srnd(9, 15) });
    this.islands = isl;
    const riverX = z => Math.sin(z * 0.045 + 1) * 8;
    this.riverX = riverX;
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
      const n = noise(x * 0.018 + 50, z * 0.018 + 50, 4), n2 = noise(x * 0.06 + 9, z * 0.06 + 3, 2);
      let h;
      switch (T) {
        case 'trenches': {
          h = 3.2 + n * 3;
          for (const cx of [-24, 24]) {
            const tx = cx + Math.sin(z * 0.2) * 2.4, d = Math.abs(x - tx);
            if (d < 1.8) h = Math.max(0.8, h - 2.6);
            else if (d < 2.6) h -= (1 - (d - 1.8) / 0.8) * 2.6;
            else if (d < 4.5) h += (1 - (d - 2.6) / 1.9) * 0.8;
          }
          if (Math.abs(x) < 16) h -= (1 - Math.abs(x) / 16) * 1.2 - n2 * 0.4;
          break;
        }
        case 'plateau': h = 3 + n * 4 + smooth(4, 26, x) * 8 + n2 * 0.5; break;
        case 'islands': {
          h = -3 + n * 1.5;
          for (const s of isl) { const d = Math.hypot(x - s.x, z - s.z); h = Math.max(h, 3 + n * 2.5 - Math.pow(Math.max(0, d / s.r), 2) * 6); }
          break;
        }
        case 'river': {
          h = 4 + n * 5;
          const d = Math.abs(x - riverX(z));
          if (d < 6) h = Math.min(h, -2.2 + d * 0.1); else if (d < 12) h = Math.min(h, lerp2(-1.6, h, (d - 6) / 6));
          break;
        }
        case 'valley': h = 2 + n * 3 + smooth(18, 42, Math.abs(x)) * 10 + n2 * 0.6; break;
        case 'canyon': { const d = Math.abs(x + Math.sin(z * 0.05) * 5); h = d < 9 ? -2.5 + n * 0.6 : d < 16 ? lerp2(-2.5, 9 + n * 2, smooth(9, 16, d)) : 9 + n * 2.5; break; }
        case 'dunes': h = 3 + Math.sin(x * 0.09 + Math.sin(z * 0.05) * 2) * 2.4 + n * 2.5 + n2 * 0.6; break;
        case 'island': h = 5 + n * 6; break;
        default: h = 4 + n * 7.5 + n2 * 0.4;
      }
      const r = Math.hypot(x, z) / HALF, edge = T === 'island' ? 0.7 : 0.8;
      const f = smooth(edge, 1.0, r);
      H[iz * N + ix] = h * (1 - f) - 6 * f;
    }
  }
  getH(x, z) {
    const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
    if (gx < 0 || gz < 0 || gx > N - 1 || gz > N - 1) return -12;
    const ix = Math.min(N - 2, gx | 0), iz = Math.min(N - 2, gz | 0), fx = gx - ix, fz = gz - iz, H = this.heights;
    const a = H[iz * N + ix], b = H[iz * N + ix + 1], c = H[(iz + 1) * N + ix], d = H[(iz + 1) * N + ix + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  normalAt(x, z) {
    const e = 0.6;
    return new THREE.Vector3(this.getH(x - e, z) - this.getH(x + e, z), 2 * e, this.getH(x, z - e) - this.getH(x, z + e)).normalize();
  }
  slope(x, z) { return 1 - this.normalAt(x, z).y; }
  inside(x, z) { return Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1; }
  flatten(x, z, rx, rz, rot = 0) {
    const pts = [], c = Math.cos(rot), s = Math.sin(rot);
    let sum = 0, n = 0;
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const vx = -HALF + ix * CELL - x, vz = -HALF + iz * CELL - z;
      const lx = vx * c - vz * s, lz = vx * s + vz * c;
      if (Math.abs(lx) < rx + 1.5 && Math.abs(lz) < rz + 1.5) { pts.push(iz * N + ix); sum += this.heights[iz * N + ix]; n++; }
    }
    const avg = n ? sum / n : 0;
    for (const i of pts) this.heights[i] = avg;
    return avg;
  }

  /* ---------- освещение и небо ---------- */
  buildLights() {
    const th = this.theme;
    this.scene.fog = new THREE.Fog(th.sky[1], th.fog[0], th.fog[1]);
    this.scene.background = new THREE.Color(th.sky[1]);
    this.scene.add(new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]));
    const sun = this.sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
    sun.position.set(-60, 95, 45);
    if (this.quality !== 'low') {
      sun.castShadow = true;
      const sz = this.quality === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(sz, sz);
      Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 280 });
      sun.shadow.bias = -0.0008;
    }
    this.scene.add(sun);
    this.flashLight = new THREE.PointLight(VFX.explosion.lightColor, 0, 30, 2);
    this.scene.add(this.flashLight);
  }
  buildSky() {
    const th = this.theme;
    const g = new THREE.SphereGeometry(450, 24, 12), col = [], top = new THREE.Color(th.sky[0]), hor = new THREE.Color(th.sky[1]);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 450, 0, 1); const c = hor.clone().lerp(top, Math.pow(t, 0.6)); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    this.scene.add(this.sky);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: MD.TEX.soft, color: th.sun[0], fog: false, depthWrite: false }));
    sunSprite.position.set(-240, 300, 180); sunSprite.scale.setScalar(90); this.scene.add(sunSprite);
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: MD.TEX.smoke, color: this.def.theme === 'ash' ? 0x5a4a50 : 0xb8bcc0, transparent: true, opacity: 0.6, fog: false, depthWrite: false }));
      s.position.set(this.srnd(-200, 200), this.srnd(55, 90), this.srnd(-200, 200)); s.scale.set(this.srnd(30, 60), this.srnd(12, 20), 1);
      this.scene.add(s); this.clouds.push(s);
    }
  }

  /* ---------- декорации и постройки ---------- */
  addCollider(c) { this.colliders.push(c); return c; }
  removeCollider(c) { const i = this.colliders.indexOf(c); if (i >= 0) this.colliders.splice(i, 1); }
  addEnt(e) { this.ents.push(e); return e; }
  findSpot(xr, zr, minD, opts = {}) {
    for (let t = 0; t < 800; t++) {
      const x = this.srnd(xr[0], xr[1]), z = this.srnd(zr[0], zr[1]), h = this.getH(x, z);
      if (h < (opts.minH ?? 1.0) || !this.inside(x, z)) continue;
      if (this.slope(x, z) > (opts.maxSlope ?? 0.18)) continue;
      if (this.colliders.some(c => Math.hypot(c.x - x, c.z - z) < minD + (c.r || Math.max(c.hx || 0, c.hz || 0)))) continue;
      if (opts.avoid && opts.avoid.some(p => Math.hypot(p.x - x, p.z - z) < minD)) continue;
      return { x, z };
    }
    return null;
  }
  place(obj, x, z, rot = 0, y) { obj.position.set(x, y ?? this.getH(x, z), z); obj.rotation.y = rot; this.scene.add(obj); return obj; }
  placeProps() {
    const P = this.def.props || {}, th = this.theme, T = this.def.terrain;
    // мосты
    if (T === 'river') {
      const zs = [-28, 22, 0].slice(0, P.bridges || 2);
      for (const z of zs) this.addBridge(this.riverX(z), z, 20, Math.PI / 2);
    }
    if (T === 'islands') {
      const isl = this.islands, used = new Set();
      const pairs = [];
      for (let i = 0; i < isl.length; i++) for (let j = i + 1; j < isl.length; j++) pairs.push([i, j, Math.hypot(isl[i].x - isl[j].x, isl[i].z - isl[j].z) - isl[i].r - isl[j].r]);
      pairs.sort((a, b) => a[2] - b[2]);
      // соединяем острова так, чтобы из лагеря в лагерь был путь (упрощённое остовное дерево)
      const parent = isl.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
      for (const [i, j] of pairs) {
        if (find(i) === find(j)) continue; parent[find(i)] = find(j); used.add(i + '-' + j);
        const a = isl[i], b = isl[j], ang = Math.atan2(b.x - a.x, b.z - a.z), d = Math.hypot(b.x - a.x, b.z - a.z);
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        this.addBridge(mx, mz, d * 0.72, ang);
      }
    }
    if (T === 'canyon') { this.addBridge(Math.sin(-20 * 0.05) * -5, -20, 24, Math.PI / 2, 9.2); this.addBridge(Math.sin(25 * 0.05) * -5, 25, 24, Math.PI / 2, 9.2); }
    // мельница
    if (P.mill) { const s = this.findSpot([25, 60], [-40, 40], 6); if (s) { this.flatten(s.x, s.z, 2, 2); const m = this.place(MD.buildMill(), s.x, s.z, this.srnd(0, 6)); this.anim.push({ type: 'mill', obj: m }); this.addStatic(m, { kind: 'cyl', x: s.x, z: s.z, r: 1.9, y0: m.position.y - 1, y1: m.position.y + 8, walk: false }, 400, 'mill'); } }
    // дома
    for (let i = 0; i < (P.houses || 0); i++) {
      const side = i % 2 ? 1 : -1, s = this.findSpot(side > 0 ? [18, 62] : [-62, -18], [-55, 55], 7);
      if (!s) continue;
      const w = this.srnd(5, 7), d = this.srnd(4, 5.5), h = this.srnd(2.8, 3.5), rot = Math.round(this.srnd(0, 3)) * Math.PI / 2;
      const y = this.flatten(s.x, s.z, w / 2, d / 2, rot);
      const house = this.place(MD.buildHouse(w, d, h), s.x, s.z, rot, y);
      this.addStatic(house, { kind: 'box', x: s.x, z: s.z, hx: w / 2, hz: d / 2, rot, y0: y - 1, y1: y + h + 0.2, walk: true }, 180, 'house');
    }
    // мешки с песком: перед лагерями, лицом к противнику
    for (let i = 0; i < (P.sandbags || 0); i++) {
      const side = i % 2 ? 1 : -1, s = this.findSpot(side > 0 ? [14, 45] : [-45, -14], [-48, 48], 3.5, { maxSlope: 0.25 });
      if (!s) continue;
      const len = this.srnd(3, 5), rot = Math.PI / 2 + this.srnd(-0.4, 0.4);
      const y = this.getH(s.x, s.z);
      const sb = this.place(MD.buildSandbags(len), s.x, s.z, rot, y - 0.05);
      this.addStatic(sb, { kind: 'box', x: s.x, z: s.z, hx: len / 2, hz: 0.45, rot, y0: y - 1, y1: y + 0.9, walk: true }, 70, 'sandbags');
    }
    // окопы: бруствер из мешков вдоль траншей
    if (T === 'trenches') for (const cx of [-24, 24]) for (let z = -45; z <= 45; z += 15) {
      const x = cx + Math.sin(z * 0.2) * 2.4 + (cx < 0 ? 3.2 : -3.2), y = this.getH(x, z);
      const sb = this.place(MD.buildSandbags(4), x, z, Math.PI / 2, y - 0.1);
      this.addStatic(sb, { kind: 'box', x, z, hx: 2, hz: 0.45, rot: Math.PI / 2, y0: y - 1, y1: y + 0.8, walk: true }, 70, 'sandbags');
    }
    // изгороди
    for (let i = 0; i < (P.fences || 0); i++) {
      const s = this.findSpot([-60, 60], [-55, 55], 3, { maxSlope: 0.2 }); if (!s) continue;
      const len = this.srnd(4, 8), rot = this.srnd(0, Math.PI), y = this.getH(s.x, s.z);
      const f = this.place(MD.buildFence(len), s.x, s.z, rot, y);
      this.addStatic(f, { kind: 'box', x: s.x, z: s.z, hx: len / 2, hz: 0.12, rot, y0: y - 1, y1: y + 1.1, walk: false }, 20, 'fence');
    }
    // колючая проволока на ничейной земле
    this.wires = [];
    for (let i = 0; i < (P.wire || 0); i++) {
      const s = this.findSpot([-16, 16], [-50, 50], 3, { maxSlope: 0.3 }); if (!s) continue;
      const len = this.srnd(4, 7), rot = Math.PI / 2 + this.srnd(-0.3, 0.3);
      const w = this.place(MD.buildWire(len), s.x, s.z, rot);
      this.wires.push({ x: s.x, z: s.z, hx: len / 2, hz: 0.5, rot, obj: w });
    }
    // деревья и камни
    const treeCount = { farm: 40, swamp: 26, snow: 36, desert: 16, ash: 20 }[this.def.theme] ?? 30;
    for (let i = 0; i < treeCount; i++) {
      const s = this.findSpot([-72, 72], [-72, 72], 3, { maxSlope: 0.3 }); if (!s) continue;
      const type = th.trees[Math.floor(this.rng() * th.trees.length)];
      const tr = this.place(MD.buildTree(type), s.x, s.z, this.srnd(0, 6));
      const c = { kind: 'cyl', x: s.x, z: s.z, r: tr.userData.trunkR || 0.35, y0: tr.position.y - 1, y1: tr.position.y + 4, walk: false, tree: tr };
      this.addCollider(c); this.trees.push({ obj: tr, col: c });
    }
    for (let i = 0; i < 14; i++) {
      const s = this.findSpot([-72, 72], [-72, 72], 3, { maxSlope: 0.4, minH: -1 }); if (!s) continue;
      const r = this.srnd(0.6, 1.6), rock = this.place(MD.buildRock(r), s.x, s.z);
      this.addCollider({ kind: 'cyl', x: s.x, z: s.z, r: r * 0.9, y0: rock.position.y - 1, y1: rock.position.y + r * 0.9, walk: true });
    }
  }
  addBridge(x, z, len, rot, yDeck) {
    const y = yDeck ?? 1.0;
    const b = this.place(MD.buildBridge(len, 3), x, z, rot, y);
    this.addStatic(b, { kind: 'box', x, z, hx: 1.5, hz: len / 2, rot, y0: y - 0.2, y1: y + 0.13, walk: true, bridge: true }, 9999, 'bridge');
  }
  addStatic(obj, col, hp, kind) {
    this.addCollider(col);
    const e = { kind, hp, maxHp: hp, obj, col };
    col.ent = e;
    if (hp < 9000) this.addEnt(e);
    return e;
  }

  /* ---------- сетка рельефа ---------- */
  colorVertex(ix, iz, col) {
    const i = iz * N + ix, h = this.heights[i], th = this.theme;
    const hx = this.heights[iz * N + Math.min(N - 1, ix + 1)] - this.heights[iz * N + Math.max(0, ix - 1)];
    const hz = this.heights[Math.min(N - 1, iz + 1) * N + ix] - this.heights[Math.max(0, iz - 1) * N + ix];
    const s = Math.hypot(hx, hz) / (2 * CELL), v = (hash(i) - 0.5) * 0.07;
    let c;
    if (this.scorch[i]) c = [0.09, 0.075, 0.06];
    else if (h < 0.6) c = th.sand;
    else if (s > 1.0) c = th.dirt;
    else if (h > 12) c = th.rock;
    else { const t = clamp(s / 1.0, 0, 1); c = [th.grass[0] + (th.dry[0] - th.grass[0]) * t, th.grass[1] + (th.dry[1] - th.grass[1]) * t, th.grass[2] + (th.dry[2] - th.grass[2]) * t]; }
    col[i * 3] = c[0] + v; col[i * 3 + 1] = c[1] + v; col[i * 3 + 2] = c[2] + v;
  }
  buildTerrainMesh() {
    const geo = this.terrGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), idx = [];
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix;
      pos[i * 3] = -HALF + ix * CELL; pos[i * 3 + 1] = this.heights[i]; pos[i * 3 + 2] = -HALF + iz * CELL;
      uv[i * 2] = ix / (N - 1); uv[i * 2 + 1] = iz / (N - 1);
      this.colorVertex(ix, iz, col);
    }
    for (let iz = 0; iz < N - 1; iz++) for (let ix = 0; ix < N - 1; ix++) { const a = iz * N + ix, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, MD.mat(0xffffff, { preset: 'terrain', vertexColors: true, map: MD.TEX.ground, normalMap: MD.TEX.groundNormal, normalScale: new THREE.Vector2(0.9, 0.9), unique: true }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    // «юбка» под картой, чтобы не было видно края
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), MD.mat(new THREE.Color(...this.theme.sand).multiplyScalar(0.4).getHex(), { preset: 'terrain' }));
    skirt.rotation.x = -Math.PI / 2; skirt.position.y = -12; this.scene.add(skirt);
  }
  crater(x, y, z, r) {
    const ix0 = Math.max(0, Math.floor((x - r + HALF) / CELL)), ix1 = Math.min(N - 1, Math.ceil((x + r + HALF) / CELL));
    const iz0 = Math.max(0, Math.floor((z - r + HALF) / CELL)), iz1 = Math.min(N - 1, Math.ceil((z + r + HALF) / CELL));
    const pos = this.terrGeo.attributes.position.array, col = this.terrGeo.attributes.color.array;
    let changed = false;
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const vx = -HALF + ix * CELL, vz = -HALF + iz * CELL, d = Math.hypot(vx - x, vz - z);
      if (d >= r) continue;
      const i = iz * N + ix, bottom = y - Math.sqrt(r * r - d * d) * 0.55;
      if (this.heights[i] > bottom) { this.heights[i] = Math.max(-9, bottom); pos[i * 3 + 1] = this.heights[i]; changed = true; }
      if (this.heights[i] > y - r - 0.5 && d < r * 0.85) this.scorch[i] = 1;
    }
    if (!changed) return;
    for (let iz = Math.max(0, iz0 - 1); iz <= Math.min(N - 1, iz1 + 1); iz++) for (let ix = Math.max(0, ix0 - 1); ix <= Math.min(N - 1, ix1 + 1); ix++) this.colorVertex(ix, iz, col);
    this.terrGeo.attributes.position.needsUpdate = true; this.terrGeo.attributes.color.needsUpdate = true;
    this.terrGeo.computeVertexNormals();
    // деревья и камни проседают вместе с землёй
    for (const t of this.trees) if (t.obj.visible && Math.hypot(t.obj.position.x - x, t.obj.position.z - z) < r + 1) { t.obj.position.y = this.getH(t.obj.position.x, t.obj.position.z); t.col.y0 = t.obj.position.y - 1; t.col.y1 = t.obj.position.y + 4; }
  }

  /* ---------- вода ---------- */
  buildWater() {
    const g = new THREE.PlaneGeometry(SIZE + 120, SIZE + 120, 48, 48);
    g.rotateX(-Math.PI / 2);
    this.waterGeo = g;
    this.waterBase = Float32Array.from(g.attributes.position.array);
    const th = this.theme;
    this.water = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: th.water, transparent: true, opacity: th.poison ? 0.92 : 0.86, shininess: 120, specular: 0x5a6a6a }));
    this.water.position.y = WATER_Y; this.water.receiveShadow = true;
    this.scene.add(this.water);
  }
  isPoisonWater() { return this.theme.poison; }

  /* ---------- погода ---------- */
  buildWeather() {
    const w = this.theme.weather; if (!w) return;
    const n = this.quality === 'low' ? 300 : 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-90, 90); pos[i * 3 + 1] = rnd(0, 50); pos[i * 3 + 2] = rnd(-90, 90); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = { snow: 0xffffff, dust: 0xe8d0a0, spores: 0xc8e070, embers: 0xff9040 }[w];
    const size = { snow: 0.35, dust: 0.25, spores: 0.22, embers: 0.25 }[w];
    this.weather = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: MD.TEX.soft, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.weather.userData.kind = w;
    this.scene.add(this.weather);
  }

  update(dt, wind) {
    this.t += dt;
    const t = this.t;
    // волны
    const p = this.waterGeo.attributes.position, b = this.waterBase;
    for (let i = 0; i < p.count; i++) { const x = b[i * 3], z = b[i * 3 + 2]; p.array[i * 3 + 1] = Math.sin(x * 0.18 + t * 1.3) * 0.08 + Math.cos(z * 0.21 + t * 1.1) * 0.08; }
    p.needsUpdate = true;
    for (const c of this.clouds) { c.position.x += (0.6 + wind.x * 0.3) * dt; c.position.z += wind.z * 0.3 * dt; if (c.position.x > 220) c.position.x = -220; if (Math.abs(c.position.z) > 220) c.position.z *= -0.98; }
    for (const a of this.anim) if (a.type === 'mill') a.obj.userData.hub.rotation.z += dt * 0.6;
    if (this.weather) {
      const kind = this.weather.userData.kind, wp = this.weather.geometry.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        let x = wp.array[i * 3], y = wp.array[i * 3 + 1], z = wp.array[i * 3 + 2];
        if (kind === 'snow') { y -= dt * 3; x += (wind.x * 0.3 + Math.sin(t + i) * 0.3) * dt; z += wind.z * 0.3 * dt; }
        else if (kind === 'dust') { x += (4 + wind.x) * dt; y += Math.sin(t * 2 + i) * dt * 0.3; }
        else if (kind === 'spores') { y += Math.sin(t + i * 0.7) * dt * 0.4; x += Math.cos(t * 0.5 + i) * dt * 0.4; }
        else if (kind === 'embers') { y += dt * 1.5; x += Math.sin(t * 2 + i) * dt * 0.6; }
        if (y < 0) y = 50; if (y > 50) y = 0; if (x > 90) x = -90; if (x < -90) x = 90; if (z > 90) z = -90; if (z < -90) z = 90;
        wp.array[i * 3] = x; wp.array[i * 3 + 1] = y; wp.array[i * 3 + 2] = z;
      }
      wp.needsUpdate = true;
    }
    if (this.flashLight.intensity > 0) this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 12);
  }

  /* ---------- столкновения ---------- */
  local(c, x, z) {
    const dx = x - c.x, dz = z - c.z;
    if (!c.rot) return [dx, dz];
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    return [dx * cs - dz * sn, dx * sn + dz * cs];
  }
  inFoot(c, x, z, pad = 0) {
    if (c.kind === 'cyl') return (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2;
    const [lx, lz] = this.local(c, x, z);
    return Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad;
  }
  // Высота поверхности под точкой: рельеф, крыши, мосты, мешки.
  groundAt(x, z, y = 99) {
    let h = this.getH(x, z);
    for (const c of this.colliders) if (c.walk && y >= c.y1 - 0.75 && this.inFoot(c, x, z, 0.1) && c.y1 > h) h = c.y1;
    return h;
  }
  // Проверка вертикальной капсулы (рост height, радиус pad) против построек.
  blocked(x, z, y, height = 1.82, pad = 0.34) {
    for (const c of this.colliders) {
      if (!this.inFoot(c, x, z, pad)) continue;
      if (y + height <= c.y0 || y >= c.y1 - 0.01) continue;
      if (c.walk && y >= c.y1 - 0.75) continue;
      return c;
    }
    return null;
  }
  solidAt(x, y, z) {
    if (y <= this.getH(x, z)) return 'terrain';
    for (const c of this.colliders) if (y > c.y0 && y < c.y1 && this.inFoot(c, x, z)) return c;
    return null;
  }
  // Луч до первого препятствия (рельеф или постройка).
  ray(o, dir, maxD, step = 0.25) {
    const p = o.clone();
    for (let d = 0; d < maxD; d += step) {
      p.addScaledVector(dir, step);
      if (!this.inside(p.x, p.z) && p.y < 0) return { d, point: p.clone(), hit: 'out' };
      const s = this.solidAt(p.x, p.y, p.z);
      if (s) return { d, point: p.clone(), hit: s === 'terrain' ? 'terrain' : 'solid', col: s === 'terrain' ? null : s };
      if (p.y < WATER_Y && this.getH(p.x, p.z) < WATER_Y) return { d, point: p.clone(), hit: 'water' };
    }
    return null;
  }
  inWire(x, z) { return this.wires.find(w => { const [lx, lz] = this.local(w, x, z); return Math.abs(lx) < w.hx && Math.abs(lz) < w.hz; }); }
  dispose() { this.terrGeo.dispose(); this.waterGeo.dispose(); }
}
function lerp2(a, b, t) { return a + (b - a) * t; }
