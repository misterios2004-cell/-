// Частицы и визуальные эффекты.
import { THREE, rnd } from './core.js';
import { TEX, mat } from './models.js';
import { VFX } from './theme.js';

export class Effects {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.items = [];
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.sphere = new THREE.SphereGeometry(1, 8, 6);
  }
  sprite(tex, color, pos, scale, life, opts = {}) {
    const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: opts.opacity ?? 1, blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.setScalar(scale);
    this.scene.add(s);
    this.items.push({ o: s, life, max: life, vel: opts.vel || new THREE.Vector3(), grow: opts.grow ?? 0, fade: opts.fade ?? 1, grav: opts.grav || 0, base: scale, op: opts.opacity ?? 1, sprite: true });
    return s;
  }
  chunk(pos, vel, color, size, life) {
    const m = new THREE.Mesh(this.box, mat(color)); m.position.copy(pos); m.scale.setScalar(size); m.castShadow = false;
    this.scene.add(m);
    this.items.push({ o: m, life, max: life, vel, grav: 20, spin: rnd(-10, 10), ground: true, shared: true });
  }
  explosion(p, r, opts = {}) {
    const q = p.clone();
    const E = VFX.explosion;
    this.sprite(TEX.flash, E.flash, q, r * 1.3, 0.22, { grow: r * 2.8, add: true });
    for (let i = 0; i < 6 + r; i++) {
      const v = new THREE.Vector3(rnd(-1, 1), rnd(0.2, 1.2), rnd(-1, 1)).multiplyScalar(r * 1.2);
      this.sprite(TEX.flash, E.fire[i % 2], q.clone().addScaledVector(v, 0.15), r * rnd(0.45, 0.8), rnd(0.25, 0.45), { vel: v, grow: r * 0.7, add: true, opacity: 0.8 });
    }
    for (let i = 0; i < 8 + r * 1.5; i++) {
      const v = new THREE.Vector3(rnd(-1, 1) * 1.5, rnd(1.2, 3), rnd(-1, 1) * 1.5);
      this.sprite(TEX.smoke, opts.gas ? VFX.gas : E.smoke, q.clone().add(new THREE.Vector3(rnd(-1, 1) * r * 0.4, rnd(0, r * 0.4), rnd(-1, 1) * r * 0.4)), r * rnd(0.8, 1.3), rnd(2.6, 4.5), { vel: v, grow: r * 1.1, opacity: E.smokeOpacity });
    }
    if (!opts.air) {
      const c = this.world.theme.dirt.map(x => Math.round(x * 255));
      const col = (c[0] << 16) | (c[1] << 8) | c[2];
      for (let i = 0; i < 10 + r * 2; i++) this.chunk(q.clone(), new THREE.Vector3(rnd(-1, 1) * r * 2, rnd(5, 13), rnd(-1, 1) * r * 2), i % 3 ? col : E.dirt, rnd(0.1, 0.28), rnd(1.4, 2.4));
    }
    const L = this.world.flashLight; L.position.copy(q).y += 2; L.intensity = 4 + r; L.distance = r * 8;
    // кольцо ударной волны
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: E.ring, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(q).y += 0.2; this.scene.add(ring);
    this.items.push({ o: ring, life: 0.4, max: 0.4, vel: new THREE.Vector3(), ring: r * 2.2 });
  }
  gasCloud(p, r) {
    for (let i = 0; i < 10; i++) this.sprite(TEX.smoke, VFX.gas, p.clone().add(new THREE.Vector3(rnd(-r, r) * 0.6, rnd(0, 1.5), rnd(-r, r) * 0.6)), r * rnd(0.6, 1), rnd(3, 5), { vel: new THREE.Vector3(rnd(-0.3, 0.3), 0.2, rnd(-0.3, 0.3)), grow: r * 0.3, opacity: 0.55 });
  }
  healBurst(p) {
    this.sprite(TEX.soft, VFX.heal, p.clone().setY(p.y + 1.0), 1.6, 0.9, { grow: 1.2, add: true, opacity: 0.45 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: VFX.heal, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(p).y += 0.08; this.scene.add(ring);
    this.items.push({ o: ring, life: 0.8, max: 0.8, vel: new THREE.Vector3(), ring: 1.2 });
  }
  splash(p, big = 1) {
    for (let i = 0; i < 16 * big; i++) {
      const m = new THREE.Mesh(this.sphere, mat(VFX.splash, { preset: 'eye' })); m.position.set(p.x, 0.1, p.z); m.scale.setScalar(rnd(0.1, 0.22));
      this.scene.add(m); this.items.push({ o: m, life: 1.2, max: 1.2, vel: new THREE.Vector3(rnd(-3, 3), rnd(5, 10) * big, rnd(-3, 3)), grav: 20, shared: true, water: true });
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.12, p.z); this.scene.add(ring);
    this.items.push({ o: ring, life: 0.9, max: 0.9, vel: new THREE.Vector3(), ring: 3 * big });
  }
  puff(p, color = 0x8a857c, size = 0.5, life = 0.8) { this.sprite(TEX.smoke, color, p, size, life, { vel: new THREE.Vector3(rnd(-0.2, 0.2), 0.6, rnd(-0.2, 0.2)), grow: size, opacity: 0.6 }); }
  muzzle(p) { this.sprite(TEX.flash, VFX.muzzle, p, 0.55, 0.06, { add: true }); this.puff(p, 0x6a665e, 0.2, 0.6); }
  tracer(a, b, color = VFX.tracer) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(l); this.items.push({ o: l, life: 0.18, max: 0.18, vel: new THREE.Vector3(), line: true });
  }
  impact(p, kind) {
    if (kind === 'water') { this.splash(p, 0.3); return; }
    this.puff(p, kind === 'fox' ? 0x5a1c16 : 0x6a5e4c, 0.3, 0.5);
    for (let i = 0; i < 4; i++) this.chunk(p.clone(), new THREE.Vector3(rnd(-2, 2), rnd(2, 5), rnd(-2, 2)), kind === 'fox' ? 0x4a1410 : 0x3a3024, 0.06, 0.6);
  }
  flame(o, dir, len) {
    for (let i = 0; i < 3; i++) {
      const v = dir.clone().multiplyScalar(len * rnd(1.6, 2.2)).add(new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)));
      this.sprite(TEX.flash, VFX.explosion.fire[i % 2], o.clone(), 0.5, 0.5, { vel: v, grow: 2.5, add: true });
    }
  }
  fireOn(p) { this.sprite(TEX.flash, VFX.explosion.fire[0], p.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), rnd(0.4, 1.7), rnd(-0.3, 0.3))), 0.5, 0.5, { vel: new THREE.Vector3(0, 1.5, 0), grow: 0.3, add: true }); }
  trail(p) { this.sprite(TEX.smoke, 0x8a8680, p.clone(), 0.45, 1.1, { vel: new THREE.Vector3(0, 0.3, 0), grow: 1.1, opacity: 0.55 }); }
  sparks(p) { for (let i = 0; i < 6; i++) this.sprite(TEX.soft, 0xffc27a, p.clone(), 0.12, 0.4, { vel: new THREE.Vector3(rnd(-4, 4), rnd(1, 5), rnd(-4, 4)), add: true, grav: 10 }); }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.life -= dt;
      const a = Math.max(0, it.life / it.max);
      if (it.vel) { it.vel.y -= (it.grav || 0) * dt; it.o.position.addScaledVector(it.vel, dt); }
      if (it.sprite) {
        it.vel.multiplyScalar(1 - dt * 1.5);
        it.o.scale.setScalar(it.base + (1 - a) * it.grow);
        it.o.material.opacity = it.op * Math.min(1, a * 1.8);
      } else if (it.ring) {
        const s = 1 + (1 - a) * it.ring; it.o.scale.set(s, s, s); it.o.material.opacity = a * 0.6;
      } else if (it.line) {
        it.o.material.opacity = a;
      } else {
        it.o.rotation.x += (it.spin || 0) * dt; it.o.rotation.z += (it.spin || 0) * dt;
        if (it.ground) { const h = this.world.getH(it.o.position.x, it.o.position.z); if (it.o.position.y < h) { it.o.position.y = h; it.vel.set(0, 0, 0); it.spin = 0; } }
        if (it.water && it.o.position.y < 0) it.life = 0;
      }
      if (it.life <= 0) {
        this.scene.remove(it.o);
        if (!it.shared) { it.o.material.dispose(); if (it.ring || it.line) it.o.geometry.dispose(); }
        this.items.splice(i, 1);
      }
    }
  }
  clear() { for (const it of this.items) this.scene.remove(it.o); this.items = []; }
}
