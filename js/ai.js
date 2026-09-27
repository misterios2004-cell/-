// Искусственный интеллект противника.
import { THREE, clamp, angDiff, rnd } from './core.js';
import { WEAPONS } from './data.js';
import { WATER_Y } from './world.js';
import { FOX_BODY } from './models.js';

const G = 20;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const BALLISTIC = new Set(['ballistic', 'grenade']);

export class AI {
  constructor(b) { this.b = b; }
  begin(h) { this.h = h; this.stage = 'think'; this.t = 0; this.plan = null; this.moved = false; this.free = 0; this.stuckT = 0; this.lastPos = h.pos.clone(); }

  tick(dt) {
    const b = this.b, h = this.h;
    if (!h || !h.alive) return;
    this.t += dt;
    if (b.state === 'retreat') { this.retreat(dt); return; }
    if (b.state !== 'turn') return;
    switch (this.stage) {
      case 'think':
        if (this.t < 0.9) return;
        this.plan = this.evaluate();
        if ((!this.plan || this.plan.score < 14) && !this.moved) {
          const dest = this.chooseMove();
          if (dest) { this.dest = dest; this.stage = 'move'; this.t = 0; return; }
        }
        this.startAim(); break;
      case 'move': this.move(dt); break;
      case 'think2':
        if (this.t < 0.5) return;
        this.moved = true; this.plan = this.evaluate();
        if (!this.plan && h.swim && this.t < 8 && b.timer > 10) { const d = this.chooseMove(); if (d) { this.dest = d; this.stage = 'move'; this.t = 0; break; } }
        this.startAim(); break;
      case 'aim': this.aim(dt); break;
      case 'charge':
        if (!b.charging) { b.endTurn(); this.stage = 'done'; break; }
        if (b.power >= this.plan.power) { b.fire(); this.after(); }
        break;
      default: break;
    }
  }
  after() {
    const w = this.plan && WEAPONS[this.plan.weapon];
    if (w && w.free && this.b.state === 'turn' && this.free < 2) { this.free++; this.stage = 'think2'; this.t = 0; }
    else this.stage = 'done';
  }
  startAim() {
    const b = this.b, h = this.h;
    if (!this.plan) { b.msg(`${h.name} выжидает`, 'info'); b.endTurn(); this.stage = 'done'; return; }
    if (this.plan.weapon && !h.vehicle) b.selectWeapon(this.plan.weapon, true);
    if (this.plan.target) { b.target = this.plan.target.clone(); b.ring.visible = true; b.ring.position.copy(b.target).y += 0.3; }
    this.stage = 'aim'; this.t = 0;
  }
  aim(dt) {
    const b = this.b, h = this.h, p = this.plan;
    const v = h.vehicle;
    const cy = v ? v.aimYaw : h.yaw, cp = v ? v.pitch : h.pitch;
    const dy = angDiff(p.yaw, cy), dp = p.pitch - cp;
    const k = Math.min(1, dt * 3.5);
    if (v) { v.aimYaw += dy * k; v.pitch += dp * k; v.sync(); } else { h.yaw += dy * k; h.pitch += dp * k; }
    if (this.t > 1.1 && Math.abs(dy) < 0.01 && Math.abs(dp) < 0.01) {
      if (v) { v.aimYaw = p.yaw; v.pitch = p.pitch; v.sync(); } else { h.yaw = p.yaw; h.pitch = p.pitch; }
      const w = b.currentWeapon();
      if (!w) { b.endTurn(); this.stage = 'done'; return; }
      if (BALLISTIC.has(w.kind)) { b.pressFire(); this.stage = 'charge'; }
      else { b.pressFire(); this.after(); }
    }
  }
  move(dt) {
    const b = this.b, h = this.h, d = this.dest;
    const to = d.pos.clone().sub(h.pos).setY(0), dist = to.length();
    const want = Math.atan2(to.x, to.z), diff = angDiff(want, h.yaw);
    h.yaw += clamp(diff, -3 * dt, 3 * dt);
    if (Math.abs(diff) < 0.7) {
      const run = dist > 6 && b.stamina > 10 && !h.swim;
      h.running = run; if (run) b.stamina -= 22 * dt;
      b.moveFox(h, h.swim ? 1.9 : run ? 5.6 : 3.2, dt);
    }
    // застряли — прыгаем, потом сдаёмся
    this.stuckT = h.pos.distanceTo(this.lastPos) < 0.02 ? this.stuckT + dt : 0;
    this.lastPos.copy(h.pos);
    if (this.stuckT > 0.4 && h.ground && !h.swim && b.stamina >= 10) { const f = new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw)); h.vel.set(f.x * 3, 7, f.z * 3); h.ground = false; b.stamina -= 10; }
    const arrived = dist < (d.vehicle ? 3 : 1.2);
    if (arrived && d.vehicle && !d.vehicle.occupant && !d.vehicle.dead) b.enterVehicle(h, d.vehicle);
    if (arrived || this.t > 7 || b.timer < 12 || this.stuckT > 1.5) { this.stage = 'think2'; this.t = 0; }
  }
  retreat(dt) {
    const b = this.b, h = this.h, t = b.tnts[0];
    if (!t) return;
    const away = h.pos.clone().sub(t.pos).setY(0); if (away.lengthSq() < 0.01) away.set(1, 0, 0);
    h.yaw += clamp(angDiff(Math.atan2(away.x, away.z), h.yaw), -4 * dt, 4 * dt);
    h.running = b.stamina > 0; b.stamina -= 22 * dt;
    b.moveFox(h, h.running ? 5.6 : 3.2, dt);
  }

  /* ---------- куда пойти ---------- */
  chooseMove() {
    const b = this.b, h = this.h;
    if (h.vehicle) return null;
    // в воде — к ближайшему берегу, предпочитая сторону противника
    if (h.swim) {
      const foe = b.foxes.find(o => o.alive && o.team !== h.team);
      let best = null, bestScore = Infinity;
      for (let r = 3; r <= 24; r += 3) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, p = h.pos.clone().add(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
        if (!b.world.inside(p.x, p.z) || b.world.groundAt(p.x, p.z) < 0.3) continue;
        const s = r + (foe ? p.distanceTo(foe.pos) * 0.15 : 0);
        if (s < bestScore) { bestScore = s; best = p; }
      }
      if (best) return { pos: best };
    }
    const enemies = b.foxes.filter(o => o.alive && o.team !== h.team && !o.status.hidden);
    const v = b.vehicles.find(v => !v.dead && !v.occupant && v.pos.distanceTo(h.pos) < 26 && (v.nation === h.team.nation || v.pos.x * h.pos.x > 0));
    if (v) return { pos: v.pos, vehicle: v };
    const crate = b.crates.filter(c => !c.gone && !c.falling && c.pos.distanceTo(h.pos) < 16 && c.pos.y > 0).sort((a, c) => a.pos.distanceTo(h.pos) - c.pos.distanceTo(h.pos))[0];
    if (crate) return { pos: crate.pos.clone() };
    if (!enemies.length) return null;
    const e = enemies.sort((a, c) => a.pos.distanceTo(h.pos) - c.pos.distanceTo(h.pos))[0];
    const dir = e.pos.clone().sub(h.pos).setY(0); const dist = dir.length(); dir.normalize();
    // держимся суши: проверяем точки вдоль пути
    let best = null;
    for (const step of [16, 12, 9, 6, 4]) {
      if (step > dist - 2) continue;
      const p = h.pos.clone().addScaledVector(dir, step);
      let dry = true;
      for (let s = 1; s <= step; s += 1.5) { const q = h.pos.clone().addScaledVector(dir, s); if (b.world.getH(q.x, q.z) < 0.2) { dry = false; break; } }
      if (dry || h.swim) { best = p; break; }
    }
    // сухого пути нет: идём вброд/вплавь (в ядовитую воду — только если бой затянулся)
    if (!best && (h.swim || !b.world.isPoisonWater() || b.round > 12)) best = h.pos.clone().addScaledVector(dir, Math.min(12, Math.max(4, dist - 3)));
    return best ? { pos: best } : null;
  }

  /* ---------- оценка вариантов ---------- */
  evaluate() {
    const b = this.b, h = this.h, ai = h.team.ai;
    if (h.swim && !h.vehicle) return null;
    this.buildBuckets();
    const enemies = b.foxes.filter(o => o.alive && o.team !== h.team && !o.status.hidden);
    const allies = b.foxes.filter(o => o.alive && o.team === h.team);
    const cands = [];
    const origin = h.vehicle ? h.vehicle.pos.clone().setY(h.vehicle.pos.y + (h.vehicle.type === 'tank' ? 1.9 : 1.3)) : h.pos.clone().setY(h.pos.y + FOX_BODY.muzzle * h.scale);
    const aimAt = (target) => { const d = target.clone().sub(origin); return { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)), dist: d.length() }; };
    const direct = (w, id) => {
      for (const e of enemies) {
        if (e.vehicle) continue;
        const a = aimAt(e.center()); if (a.dist > w.range * 0.95) continue;
        const dir = new THREE.Vector3(Math.sin(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), Math.cos(a.yaw) * Math.cos(a.pitch));
        const tr = b.traceShot(h, origin.clone().addScaledVector(dir, 0.8), dir, a.dist + 1, h.vehicle);
        if (tr.fox !== e) continue;
        const prob = clamp(1 - a.dist / w.range * 0.55 * Math.max(0.5, ai), 0.25, 1);
        let dmg = w.kind === 'burst' ? w.dmg * w.shots * 0.7 : w.kind === 'spread' ? w.dmg * w.pellets * clamp(1.2 - a.dist / w.range, 0.3, 1) * 0.8 : w.dmg;
        let sc = dmg * prob + (e.hp <= dmg ? 28 : 0);
        if (w.sleep) sc = 10 + e.rank.level * 4;
        cands.push({ score: sc, weapon: id, yaw: a.yaw, pitch: a.pitch, direct: true });
      }
    };
    if (h.vehicle) {
      const w = h.vehicle.weapon;
      if (w.kind === 'burst') direct(w, null);
      else this.searchBallistic(w, null, origin, enemies, cands, h.vehicle);
    } else {
      const ballistic = [];
      for (const id of Object.keys(h.inv)) {
        if (!h.has(id)) continue;
        const w = WEAPONS[id];
        switch (w.kind) {
          case 'hitscan': case 'burst': case 'spread': direct(w, id); break;
          case 'melee':
            for (const e of enemies) {
              if (e.vehicle) continue;
              const d = e.pos.distanceTo(h.pos); if (d > w.range + 0.3) continue;
              const a = aimAt(e.center());
              let sc = w.dmg * 1.3 + (w.stun ? 15 : 0);
              const beyond = e.pos.clone().add(e.pos.clone().sub(h.pos).setY(0).normalize().multiplyScalar(w.push * 0.6));
              if (b.world.getH(beyond.x, beyond.z) < 0 && b.world.isPoisonWater()) sc += 20;
              if (b.world.getH(beyond.x, beyond.z) < e.pos.y - 5) sc += 12;
              cands.push({ score: sc, weapon: id, yaw: a.yaw, pitch: 0 });
            }
            break;
          case 'ballistic': case 'grenade':
            if (id === 'medball') { if (allies.some(a => a.hp < a.maxHp * 0.6 && a !== h)) ballistic.push(id); }
            else ballistic.push(id);
            break;
          case 'airstrike': {
            let best = null;
            for (const e of enemies) {
              let s = 0; for (const o of b.foxes) if (o.alive && o.pos.distanceTo(e.pos) < 6) s += (o.team === h.team ? -40 : 30 + (o.hp <= 30 ? 20 : 0));
              if (e.vehicle) s += 20;
              if (!best || s > best.s) best = { s, e };
            }
            if (best && best.s > 0) cands.push({ score: best.s * 0.9 + 5, weapon: id, target: best.e.pos.clone().add(new THREE.Vector3(gauss() * ai, 0, gauss() * ai)), yaw: h.yaw, pitch: h.pitch });
            break;
          }
          case 'healtouch': { const a = allies.filter(o => o !== h && o.pos.distanceTo(h.pos) < w.range && (o.hp < o.maxHp * 0.75 || o.status.poison)); if (a.length) cands.push({ score: 30, weapon: id, yaw: aimAt(a[0].center()).yaw, pitch: 0 }); break; }
          case 'healdart':
            for (const a of allies) {
              if (a === h || a.vehicle || (a.hp > a.maxHp * 0.6 && !a.status.poison)) continue;
              const t = aimAt(a.center()), dir = new THREE.Vector3(Math.sin(t.yaw) * Math.cos(t.pitch), Math.sin(t.pitch), Math.cos(t.yaw) * Math.cos(t.pitch));
              if (b.traceShot(h, origin.clone().addScaledVector(dir, 0.8), dir, t.dist + 1).fox === a) cands.push({ score: 28 + (a.maxHp - a.hp) * 0.2, weapon: id, yaw: t.yaw, pitch: t.pitch });
            }
            break;
          case 'selfheal': if (h.hp < h.maxHp * 0.5 || h.status.poison) cands.push({ score: 38, weapon: id, yaw: h.yaw, pitch: h.pitch }); break;
          case 'hide': if (h.hp < h.maxHp * 0.35) cands.push({ score: 17, weapon: id, yaw: h.yaw, pitch: h.pitch }); break;
          case 'place':
            if (id === 'tnt' && enemies.some(e => e.pos.distanceTo(h.pos) < 3.5)) cands.push({ score: 55, weapon: id, yaw: h.yaw, pitch: 0 });
            if (id === 'mine' && enemies.some(e => e.pos.distanceTo(h.pos) < 8)) cands.push({ score: 9, weapon: id, yaw: h.yaw, pitch: 0 });
            break;
          case 'suicide': { const n = enemies.filter(e => e.pos.distanceTo(h.pos) < 6).length; if (h.hp < 25 && n >= 2) cands.push({ score: 45 * n, weapon: id, yaw: h.yaw, pitch: 0 }); break; }
          case 'shockwave': { const n = enemies.filter(e => e.pos.distanceTo(h.pos) < 9).length; if (n) cands.push({ score: 28 * n, weapon: id, yaw: h.yaw, pitch: 0 }); break; }
          default: break;
        }
      }
      // навесной огонь: берём до трёх самых мощных вариантов
      ballistic.sort((a, c) => WEAPONS[c].dmg - WEAPONS[a].dmg);
      for (const id of ballistic.slice(0, 3)) this.searchBallistic(WEAPONS[id], id, origin, enemies, cands, null, allies);
    }
    if (!cands.length) return null;
    cands.sort((a, c) => c.score - a.score);
    const best = cands[0];
    // ошибка прицеливания зависит от уровня противника
    const err = ai;
    if (best.direct) { best.yaw += gauss() * 0.012 * err; best.pitch += gauss() * 0.01 * err; }
    else if (best.power) { best.yaw += gauss() * 0.02 * err; best.pitch += gauss() * 0.015 * err; best.power = clamp(best.power * (1 + gauss() * 0.03 * err), 0.12, 1); }
    return best;
  }
  searchBallistic(w, id, origin, enemies, cands, veh, allies = []) {
    const h = this.h;
    const heal = id === 'medball', gas = id === 'gas';
    const targets = heal ? allies.filter(a => a.hp < a.maxHp * 0.6 && a !== h) : enemies.slice().sort((a, c) => a.pos.distanceTo(h.pos) - c.pos.distanceTo(h.pos)).slice(0, 4);
    const high = w.high;
    const pMin = veh?.type === 'artillery' ? 0.1 : high ? 0.7 : -0.05, pMax = veh?.type === 'artillery' ? 1.2 : high ? 1.35 : veh ? 0.7 : 1.1;
    for (const e of targets) {
      const tp = veh || e.vehicle ? (e.vehicle ? e.vehicle.pos : e.pos) : e.pos;
      const base = Math.atan2(tp.x - origin.x, tp.z - origin.z);
      if (veh?.type === 'artillery' && Math.abs(angDiff(base, veh.yaw)) > 0.9) continue;
      for (const dy of [-0.06, -0.03, 0, 0.03, 0.06]) for (let pitch = pMin; pitch <= pMax; pitch += (pMax - pMin) / 11) {
        const dir = new THREE.Vector3(Math.sin(base + dy) * Math.cos(pitch), Math.sin(pitch), Math.cos(base + dy) * Math.cos(pitch));
        const o = origin.clone().addScaledVector(dir, veh ? 2.4 : 0.9);
        for (let power = 0.22; power <= 1.001; power += 0.065) {
          const hit = this.sim(o, dir, power, w, id, veh);
          if (!hit) continue;
          let sc = this.splash(hit, w, heal, gas);
          // промах: чем ближе к цели, тем лучше — пригодится, если ничего лучше нет
          if (sc <= 0 && !heal && !gas) { if (sc < 0) continue; sc = -Math.hypot(hit.x - tp.x, hit.z - tp.z) * 0.3; if (sc < -6) continue; }
          if (sc > 0 || !heal) cands.push({ score: sc, weapon: id, yaw: base + dy, pitch, power });
        }
      }
    }
  }
  buildBuckets() {
    const m = new Map();
    for (const c of this.b.world.colliders) {
      const r = c.kind === 'cyl' ? c.r : Math.hypot(c.hx, c.hz);
      for (let x = Math.floor((c.x - r) / 8); x <= Math.floor((c.x + r) / 8); x++) for (let z = Math.floor((c.z - r) / 8); z <= Math.floor((c.z + r) / 8); z++) {
        const k = x * 1000 + z; if (!m.has(k)) m.set(k, []); m.get(k).push(c);
      }
    }
    this.buckets = m;
  }
  sim(o, dir, power, w, id, veh) {
    const b = this.b, world = b.world, dt = 1 / 30;
    const p = o.clone(), v = dir.clone().multiplyScalar(w.speed * power);
    const wind = (w.wind || (veh && veh.type !== 'pillbox')) && b.cfg.wind;
    const airburst = id === 'airburst' || id === 'firerain';
    const foxes = b.foxes.filter(x => x.alive && !x.vehicle);
    for (let t = 0; t < 6; t += dt) {
      if (wind) v.addScaledVector(b.wind, dt);
      v.y -= G * dt; p.addScaledVector(v, dt);
      if (!world.inside(p.x, p.z)) return null;
      const g = world.getH(p.x, p.z);
      if (p.y < WATER_Y && g < WATER_Y) return null;
      if (airburst && v.y < 0 && p.y - g < 7) return p;
      if (p.y <= g) return p;
      const list = this.buckets.get(Math.floor(p.x / 8) * 1000 + Math.floor(p.z / 8));
      if (list) for (const c of list) if (p.y > c.y0 && p.y < c.y1 && world.inFoot(c, p.x, p.z) && !(veh && c === veh.col)) return p;
      if (w.kind !== 'grenade' && t > 0.25) for (const x of foxes) if (x !== this.h && Math.abs(x.pos.x - p.x) < 0.6 && Math.abs(x.pos.z - p.z) < 0.6 && x.capsuleDist(p) < 0.05) return p;
    }
    return null;
  }
  splash(p, w, heal, gas) {
    const h = this.h, b = this.b, r = w.r + 0.8;
    let sc = 0;
    for (const o of b.foxes) {
      if (!o.alive) continue;
      const c = o.vehicle ? o.vehicle.pos.clone().setY(o.vehicle.pos.y + 1) : o.center(), d = o.vehicle ? c.distanceTo(p) : Math.max(0, o.capsuleDist(p));
      if (d >= r) continue;
      const f = 1 - d / r;
      if (heal) { const need = Math.min(w.heal, o.maxHp - o.hp); sc += o.team === h.team ? need : -need; continue; }
      if (gas) { if (!o.status.poison) sc += o.team === h.team ? -25 : 18; continue; }
      let dmg = w.dmg * f + (w.burst ? w.burstDmg * 1.2 : 0) + (w.cluster ? w.clusterDmg * 1.5 : 0) + (w.frags ? 10 : 0);
      if (o.vehicle) dmg *= 0.6;
      if (o === h) sc -= dmg * 2.2;
      else if (o.team === h.team) sc -= dmg * 1.6;
      else sc += dmg + (!o.vehicle && o.hp <= dmg ? 30 : 0);
    }
    if (!heal && !gas) for (const e of b.world.ents) if (e.kind === 'barrel' && Math.hypot(e.col.x - p.x, e.col.z - p.z) < w.r) {
      for (const o of b.foxes) if (o.alive && Math.hypot(o.pos.x - e.col.x, o.pos.z - e.col.z) < 5) sc += o.team === h.team ? -30 : 22;
    }
    return sc;
  }
}
