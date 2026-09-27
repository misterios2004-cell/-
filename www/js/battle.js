// Бой: лисы-солдаты, ходы, оружие, техника, снаряды, камера.
import { THREE, clamp, rnd, pick, angDiff, Sound, fmt, say, Save } from './core.js';
import { RANKS, WEAPONS, NATIONS, CRATE_POOL, QUIPS, INF } from './data.js';
import * as MD from './models.js';
import { FOX_BODY, FoxAnim, FoxAction } from './models.js';
import { VFX } from './theme.js';
import { World, WATER_Y, HALF } from './world.js';
import { Effects } from './effects.js';
import { AI } from './ai.js';

export const GRAV = 20;
export const fwd = yaw => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
export const aimDir = (yaw, pitch) => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
const WALK = 3.4, RUN = 6.0, SWIM = 1.8, TURN_SPEED = 2.2, STAMINA = 100;
// Вода: вброд до пояса, глубже — плывём (голова над водой).
const WADE_DEPTH = -1.15, SWIM_Y = -1.25;
const CHARGE_KINDS = new Set(['ballistic', 'grenade']);
const DIRECT_KINDS = new Set(['hitscan', 'burst', 'spread', 'healdart']);

export const VEHICLE_WEAPONS = {
  tank: { name: 'Пушка танка', kind: 'ballistic', dmg: 60, r: 5, speed: 50, cat: 'heavy' },
  artillery: { name: 'Гаубица', kind: 'ballistic', dmg: 80, r: 6.5, speed: 58, cat: 'heavy' },
  pillbox: { name: 'Пулемёт дота', kind: 'burst', dmg: 6, shots: 8, range: 70, spread: 0.03, cat: 'gun' },
};

/* ================= лиса-солдат ================= */
// Столкновения — вертикальная капсула: радиус FOX_BODY.radius, высота FOX_BODY.height.
export class Fox {
  constructor(b, team, spec) {
    this.b = b; this.team = team; this.name = spec.name; this.rankId = spec.rank; this.rank = RANKS[spec.rank];
    this.rosterId = spec.rosterId ?? null; this.boss = !!spec.boss;
    this.maxHp = spec.hp || this.rank.hp; this.hp = this.maxHp;
    this.inv = {}; for (const [k, v] of Object.entries(this.rank.load)) this.inv[k] = v;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0.2;
    this.ground = true; this.swim = false; this.state = 'alive';
    this.status = { poison: false, sleep: 0, hidden: false, burn: 0 };
    this.vehicle = null; this.moving = false; this.running = false; this.anim = FoxAnim.IDLE;
    this.stats = { kills: 0, dmg: 0 }; this.lastHitBy = null; this.wireHit = false;
    this.scale = this.boss ? 1.12 : 1;
    this.collider = { radius: FOX_BODY.radius * this.scale, height: FOX_BODY.height * this.scale };
    this.model = new MD.BipedalFox(team.nation, this.rankId, this.rank.line);
    this.model.root.scale.setScalar(this.scale);
    this.weapon = null; this.grave = null; this.deadT = 0;
    b.scene.add(this.model.root);
  }
  get alive() { return this.state === 'alive'; }
  // Центр масс: середина капсулы (в воде — верх корпуса у поверхности).
  center() { return this.pos.clone().setY(this.pos.y + (this.swim ? 1.2 : FOX_BODY.height * 0.5) * this.scale); }
  head() { return this.pos.clone().setY(this.pos.y + FOX_BODY.eye * this.scale); }
  muzzle(pitch = this.pitch) { return this.pos.clone().add(new THREE.Vector3(0, FOX_BODY.muzzle * this.scale, 0)).addScaledVector(aimDir(this.yaw, pitch), 0.55 * this.scale); }
  // Расстояние от точки до поверхности капсулы (отрицательное — внутри).
  capsuleDist(p) {
    const r = this.collider.radius, y0 = this.pos.y + r, y1 = this.pos.y + this.collider.height - r;
    const cy = clamp(p.y, y0, y1);
    return Math.hypot(p.x - this.pos.x, p.y - cy, p.z - this.pos.z) - r;
  }
  count(id) { return this.inv[id] ?? 0; }
  has(id) { const c = this.count(id); return c === INF || c > 0; }
  use(id) { if (this.inv[id] !== INF && this.inv[id] > 0) this.inv[id]--; }
  give(id, n = 1) { if (this.inv[id] === INF) return; this.inv[id] = (this.inv[id] || 0) + n; }
}

/* ================= техника ================= */
export class Vehicle {
  constructor(b, type, nation, x, z, yaw, hp) {
    this.b = b; this.type = type; this.nation = nation;
    this.maxHp = hp || { tank: 200, pillbox: 150, artillery: 110 }[type]; this.hp = this.maxHp;
    this.model = type === 'tank' ? MD.buildTank(nation) : type === 'pillbox' ? MD.buildPillbox() : MD.buildArtillery(nation);
    const w = b.world;
    const y = type === 'tank' ? w.getH(x, z) : w.flatten(x, z, type === 'pillbox' ? 2.4 : 1.5, type === 'pillbox' ? 2.4 : 2, yaw);
    this.pos = new THREE.Vector3(x, y, z); this.yaw = yaw; this.aimYaw = yaw; this.pitch = type === 'artillery' ? 0.5 : 0.15;
    this.model.position.copy(this.pos); this.model.rotation.y = yaw;
    b.scene.add(this.model);
    const col = type === 'pillbox' ? { kind: 'cyl', x, z, r: 2.4, y0: y - 1, y1: y + 2.0, walk: true }
      : type === 'tank' ? { kind: 'box', x, z, hx: 1.45, hz: 1.9, rot: yaw, y0: y - 1, y1: y + 2.2, walk: false }
        : { kind: 'box', x, z, hx: 1.0, hz: 1.6, rot: yaw, y0: y - 1, y1: y + 1.5, walk: false };
    this.ent = w.addStatic(this.model, col, this.maxHp, 'vehicle');
    this.ent.vehicle = this; this.col = col;
    this.occupant = null; this.fuel = 0; this.dead = false;
    this.weapon = VEHICLE_WEAPONS[type];
  }
  get name() { return { tank: 'Танк', pillbox: 'Дот', artillery: 'Гаубица' }[this.type]; }
  muzzle() {
    const gun = this.model.userData.gun; gun.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(); gun.getWorldPosition(p);
    return p.addScaledVector(aimDir(this.aimYaw, this.pitch), this.type === 'pillbox' ? 1.1 : this.type === 'tank' ? 2.3 : 2.6);
  }
  sync() {
    this.model.position.copy(this.pos); this.model.rotation.y = this.yaw;
    const u = this.model.userData;
    u.turret.rotation.y = angDiff(this.aimYaw, this.yaw);
    u.gun.rotation.x = -this.pitch;
    this.col.x = this.pos.x; this.col.z = this.pos.z; this.col.rot = this.yaw; this.col.y0 = this.pos.y - 1;
    this.col.y1 = this.pos.y + (this.type === 'tank' ? 2.2 : this.type === 'pillbox' ? 2.0 : 1.5);
  }
}

/* ================= бой ================= */
export class Battle {
  constructor(renderer, cfg, hooks) {
    this.renderer = renderer; this.cfg = cfg; this.hooks = hooks || {};
    this.settings = Save.data.settings;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    this.quality = cfg.quality;
    MD.setMaterialQuality(this.quality);
    this.world = new World(this.scene, cfg.map, this.quality);
    renderer.toneMappingExposure = this.world.theme.exposure ?? 1;
    this.fx = new Effects(this.scene, this.world);
    this.ai = new AI(this);
    this.teams = []; this.foxes = []; this.vehicles = []; this.proj = []; this.queue = []; this.mines = []; this.tnts = []; this.gas = [];
    this.crates = []; this.graves = []; this.floats = []; this.airships = [];
    this.wind = new THREE.Vector3();
    this.round = 0; this.turnIdx = -1; this.active = null; this.state = 'intro'; this.introT = 3.2;
    this.timer = 0; this.stamina = STAMINA; this.power = 0; this.charging = false; this.jetFuel = 0;
    this.camMode = null; this.scope = false; this.target = null; this.lastBoom = null; this.boomT = 0; this.shake = 0;
    this.settleT = 0; this.resolveT = 0; this.medalsFound = 0; this.paused = false; this.over = false; this.result = null;
    this.input = { fwd: 0, turn: 0, run: false, jump: false, jumpHeld: false, pitch: 0, dragYaw: 0, dragPitch: 0, fire: false, firePressed: false, fireReleased: false, enter: false, cam: false, scope: false, tap: null, cursor: new THREE.Vector2() };
    this.camPos = new THREE.Vector3(0, 60, 120); this.camLook = new THREE.Vector3();
    this.t = 0;
    this.setupTeams();
    this.setupObjects();
    this.buildAimHelpers();
    Sound.play('turn');
  }

  /* ---------- подготовка ---------- */
  zonesFor(nTeams) {
    if (nTeams <= 2) return [{ x: [-62, -22], z: [-48, 48] }, { x: [22, 62], z: [-48, 48] }];
    return [{ x: [-62, -26], z: [-58, -12] }, { x: [26, 62], z: [12, 58] }, { x: [-62, -26], z: [12, 58] }, { x: [26, 62], z: [-58, -12] }];
  }
  spotIn(zone, avoid, minD = 3.5) {
    return this.world.findSpot(zone.x, zone.z, minD, { avoid, maxSlope: 0.22 }) || this.world.findSpot(zone.x, zone.z, 2, { maxSlope: 0.5, minH: -0.5 }) || { x: (zone.x[0] + zone.x[1]) / 2, z: (zone.z[0] + zone.z[1]) / 2 };
  }
  setupTeams() {
    const zones = this.zonesFor(this.cfg.teams.length);
    this.zones = zones;
    this.cfg.teams.forEach((tc, i) => {
      const team = { idx: i, nation: NATIONS[tc.nation], name: tc.name || NATIONS[tc.nation].name, control: tc.control, ai: tc.ai ?? 1.3, foxes: [], cyc: -1, zone: zones[i] };
      this.teams.push(team);
      for (const spec of tc.foxes) {
        const h = new Fox(this, team, spec);
        const s = this.spotIn(zones[i], this.foxes.map(o => o.pos));
        h.pos.set(s.x, this.world.groundAt(s.x, s.z), s.z);
        h.yaw = Math.atan2(-s.x, -s.z * 0.3);
        team.foxes.push(h); this.foxes.push(h);
      }
    });
  }
  setupObjects() {
    const m = this.cfg.mission || {}, w = this.world;
    // техника
    for (const st of (m.structures || [])) {
      const side = st.side, zone = this.zones[side];
      const zx = side === 0 ? [zone.x[0] + 6, zone.x[1] + 6] : [zone.x[0] - 6, zone.x[1] - 6];
      const s = w.findSpot(zx, [-35, 35], 5, { maxSlope: 0.2, avoid: this.foxes.map(h => h.pos) }) || { x: side ? 30 : -30, z: 0 };
      const faceYaw = side === 0 ? Math.PI / 2 : -Math.PI / 2;
      const v = new Vehicle(this, st.type, this.teams[side].nation, s.x, s.z, faceYaw, st.hp);
      this.vehicles.push(v);
      let crew = null;
      if (typeof st.crew === 'number') crew = this.teams[side].foxes[st.crew];
      else if (typeof st.crew === 'string') {
        const team = this.teams[side];
        crew = new Fox(this, team, { name: pick(team.nation.names) + '-дотчик', rank: st.crew });
        team.foxes.push(crew); this.foxes.push(crew);
      }
      if (crew) this.enterVehicle(crew, v, true);
    }
    // бочки
    for (let i = 0; i < (m.props?.barrels || 0); i++) {
      const s = w.findSpot([-50, 50], [-50, 50], 3, { avoid: this.foxes.map(h => h.pos) }); if (!s) continue;
      const obj = w.place(MD.buildBarrel(), s.x, s.z);
      const e = w.addStatic(obj, { kind: 'cyl', x: s.x, z: s.z, r: 0.45, y0: obj.position.y - 1, y1: obj.position.y + 1.1, walk: true }, 1, 'barrel');
      e.pos = obj.position;
    }
    // ящики на карте
    for (let i = 0; i < (m.props?.crates ?? (this.cfg.crates ? 3 : 0)); i++) {
      const s = w.findSpot([-60, 60], [-55, 55], 3, { avoid: this.foxes.map(h => h.pos) }); if (!s) continue;
      this.spawnCrate(Math.random() < 0.3 ? 'health' : 'weapon', s.x, s.z, false);
    }
    // медали
    for (let i = 0; i < (m.medals || 0); i++) {
      const s = w.findSpot([-20, 55], [-55, 55], 4, { avoid: this.foxes.map(h => h.pos) }); if (!s) continue;
      this.spawnCrate('medal', s.x, s.z, false);
    }
    // минное поле
    for (let i = 0; i < (m.minefield || 0); i++) {
      const s = w.findSpot([-18, 18], [-55, 55], 3, { minH: 0.5 }); if (!s) continue;
      this.addMine(new THREE.Vector3(s.x, w.getH(s.x, s.z), s.z), null, true);
    }
    // флаг цели
    if (m.objective?.type === 'reach') {
      const z = this.zones[1], s = w.findSpot([z.x[1] - 12, z.x[1]], [-20, 20], 3) || { x: 55, z: 0 };
      this.flag = w.place(MD.buildFlag(0xE8B84A), s.x, s.z);
      this.flagPos = this.flag.position;
    }
    if (this.cfg.wind) { const a = rnd(0, Math.PI * 2), k = rnd(0.2, 1); this.wind.set(Math.sin(a) * k * 6, 0, Math.cos(a) * k * 6); }
  }
  buildAimHelpers() {
    this.aimDots = [];
    const g = new THREE.SphereGeometry(1, 6, 4);
    for (let i = 0; i < 40; i++) {
      const d = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: VFX.aimDot, transparent: true, opacity: 0.8, depthTest: true }));
      d.scale.setScalar(0.07); d.visible = false; this.scene.add(d); this.aimDots.push(d);
    }
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.08, 6, 48), new THREE.MeshBasicMaterial({ color: VFX.target }));
    this.ring.rotation.x = Math.PI / 2; this.ring.visible = false; this.scene.add(this.ring);
    // маркер активного бойца — тонкое кольцо на земле
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 40), new THREE.MeshBasicMaterial({ color: VFX.marker, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.scene.add(this.marker);
  }

  /* ---------- сообщения ---------- */
  msg(text, kind = 'info') { this.hooks.message?.(text, kind); if (kind === 'quip') say(text); }
  float(pos, text, color) { this.floats.push({ pos: pos.clone(), text, color, t: 1.6 }); }

  /* ---------- ходы ---------- */
  aliveTeams() { return this.teams.filter(t => t.foxes.some(h => h.alive)); }
  isHuman(team) { return team.control === 'human'; }
  nextTurn() {
    if (this.checkEnd()) return;
    const n = this.teams.length;
    let tries = 0;
    do {
      this.turnIdx = (this.turnIdx + 1) % n;
      if (this.turnIdx === 0) this.newRound();
      tries++;
    } while (!this.teams[this.turnIdx].foxes.some(h => h.alive) && tries <= n * 2);
    if (this.checkEnd()) return;
    const team = this.teams[this.turnIdx];
    const list = team.foxes;
    let fox = null;
    for (let k = 1; k <= list.length; k++) { const j = (team.cyc + k) % list.length; if (list[j].alive) { team.cyc = j; fox = list[j]; break; } }
    this.beginFoxTurn(fox);
  }
  newRound() {
    this.round++;
    const m = this.cfg.mission || {};
    if (m.reinforce && m.reinforce.round === this.round) this.reinforce(m.reinforce.ranks);
    if (this.round > 1 && this.cfg.crates !== false && (this.round % 2 === 0 || m.id === 10)) this.airdrop();
    for (let i = this.gas.length - 1; i >= 0; i--) if (--this.gas[i].rounds <= 0) this.gas.splice(i, 1);
    if (this.cfg.wind) { const a = rnd(0, Math.PI * 2), k = rnd(0.1, 1); this.wind.set(Math.sin(a) * k * 6, 0, Math.cos(a) * k * 6); }
    this.hooks.round?.(this.round);
  }
  beginFoxTurn(fox) {
    this.active = fox; this.charging = false; this.power = 0; this.scope = false; this.target = null; this.camMode = null;
    this.stamina = STAMINA; this.jetFuel = 0; this.freeUsed = 0; this.actedMove = false; fox.wireHit = false;
    this.timer = this.cfg.turnTime; this.state = 'turn'; this.lastBoom = null;
    Object.assign(this.input, { dragYaw: 0, dragPitch: 0, tap: null, firePressed: false, fireReleased: false, fire: false, jump: false, enter: false, scope: false });
    if (fox.status.hidden) { fox.status.hidden = false; fox.model.setHidden(false); }
    // статусы
    let skip = false;
    if (fox.status.poison) { this.hurt(fox, 5, null, 'poison'); this.msg(`${fox.name}: яд −5`, 'warn'); }
    if (fox.status.burn > 0) { fox.status.burn--; this.hurt(fox, 5, null, 'burn'); }
    for (const g of this.gas) if (fox.pos.distanceTo(g.pos) < g.r) { fox.status.poison = true; }
    if (fox.status.sleep > 0) { fox.status.sleep--; skip = true; this.msg(`${fox.name} спит и пропускает ход`, 'warn'); }
    if (fox.hp <= 0) skip = true;
    const w = this.defaultWeapon(fox); this.selectWeapon(w, true);
    this.hooks.turn?.(fox);
    Sound.play('turn');
    if (skip) { this.endTurn(); return; }
    if (!this.isHuman(fox.team)) this.ai.begin(fox);
  }
  defaultWeapon(fox) {
    for (const id of ['rifle', 'sniper', 'mg', 'hmg', 'shotgun', 'supershotgun', 'pistol', 'bazooka']) if (fox.has(id)) return id;
    return Object.keys(fox.inv).find(k => fox.has(k)) || null;
  }
  endTurn() {
    if (this.state !== 'turn' && this.state !== 'retreat') return;
    this.state = 'resolve'; this.settleT = 0; this.resolveT = 0; this.charging = false; this.power = 0; this.scope = false; this.ring.visible = false;
    this.hooks.update?.();
  }
  settled() {
    if (this.proj.length || this.queue.length || this.tnts.length) return false;
    if (this.mines.some(m => m.trig >= 0)) return false;
    return this.foxes.every(h => !h.alive || h.ground || h.swim || h.vehicle);
  }
  finishTurn() {
    // гибель
    for (const h of this.foxes) if (h.alive && h.hp <= 0) this.kill(h);
    // мины, поставленные в этот ход, взводятся
    for (const m of this.mines) m.armed = true;
    // цель «дойти до флага»
    const m = this.cfg.mission;
    if (m?.objective?.type === 'reach' && this.active && this.active.team.idx === 0 && this.active.alive && this.flagPos && this.active.pos.distanceTo(this.flagPos) < 4) { this.finish(0, 'Пленный спасён!'); return; }
    this.nextTurn();
  }
  checkEnd() {
    if (this.over) return true;
    const m = this.cfg.mission, obj = m?.objective?.type || 'elim';
    const alive = this.aliveTeams();
    const player = this.teams[0];
    if (this.cfg.mode === 'campaign') {
      if (!player.foxes.some(h => h.alive)) { this.finish(1, 'Отряд разбит'); return true; }
      if (obj === 'boss') { const boss = this.teams[1].foxes[m.boss ?? 0]; if (!boss.alive) { this.finish(0, `${boss.name} повержен. Гарнизон сдаётся!`); return true; } }
      if (obj === 'survive' && this.round > m.objective.rounds) { this.finish(0, 'Продержались до заката!'); return true; }
      if (alive.length === 1 && alive[0] === player) { this.finish(0, 'Противник уничтожен'); return true; }
      return false;
    }
    if (alive.length <= 1) { this.finish(alive.length ? alive[0].idx : -1, alive.length ? `Победили: ${alive[0].name}` : 'Ничья'); return true; }
    return false;
  }
  finish(winner, text) {
    if (this.over) return;
    this.over = true; this.state = 'over';
    const player = this.teams[0];
    this.result = {
      winner, text, playerWon: winner === 0,
      allSurvived: player.foxes.every(h => h.alive),
      medals: this.medalsFound,
      foxes: this.foxes.map(h => ({ name: h.name, team: h.team.idx, rosterId: h.rosterId, kills: h.stats.kills, dmg: h.stats.dmg, alive: h.alive })),
    };
    for (const h of this.foxes) if (h.alive && h.team.idx === winner) h.anim = FoxAnim.CELEBRATE;
    Sound.play(winner === 0 || (this.cfg.mode !== 'campaign' && winner >= 0 && this.isHuman(this.teams[winner])) ? 'win' : 'lose');
    setTimeout(() => this.hooks.end?.(this.result), 2600);
  }

  /* ---------- урон, смерть, лечение ---------- */
  hurt(h, amount, src, cause) {
    if (!h.alive || amount <= 0) return;
    if (h.status.hidden) amount = Math.ceil(amount / 2);
    amount = Math.round(amount);
    h.hp = Math.max(0, h.hp - amount);
    if (src && src !== h) { h.lastHitBy = src; if (src.team !== h.team) src.stats.dmg += amount; }
    this.float(h.head().add(new THREE.Vector3(0, 0.55, 0)), '−' + amount, VFX.damageText);
    h.model.hit();
    Sound.play(h.hp <= 0 ? 'scream' : 'yelp', h.scale > 1 ? 0.8 : 1);
    if (h === this.active && this.state === 'turn' && (!src || src === h) && cause !== 'poison' && cause !== 'burn') {
      this.msg(pick(QUIPS.self), 'quip'); this.endTurn();
    }
  }
  heal(h, amount) {
    if (!h.alive) return;
    const before = h.hp; h.hp = Math.min(h.maxHp, h.hp + amount); h.status.poison = false;
    this.float(h.head().add(new THREE.Vector3(0, 0.55, 0)), '+' + (h.hp - before), VFX.healText);
    this.fx.healBurst(h.pos);
  }
  kill(h) {
    h.state = 'dead'; h.anim = FoxAnim.DEATH; h.deadT = 0;
    if (h.vehicle) { h.vehicle.occupant = null; h.vehicle = null; h.model.root.visible = true; }
    const k = h.lastHitBy; if (k && k.team !== h.team) k.stats.kills++;
    this.msg(fmt(pick(QUIPS.kill), h.name), 'kill');
  }

  /* ---------- оружие ---------- */
  selectWeapon(id, silent) {
    const h = this.active; if (!h) return;
    if (id && !h.has(id)) return;
    h.weapon = id; this.charging = false; this.power = 0;
    h.model.setWeapon(id);
    const w = WEAPONS[id];
    if (w && w.kind === 'airstrike') { this.target = h.pos.clone().addScaledVector(fwd(h.yaw), 25); this.ring.visible = true; }
    else { this.target = null; this.ring.visible = false; }
    if (!w || !(DIRECT_KINDS.has(w.kind))) this.scope = false;
    if (!silent) Sound.play('click');
    this.hooks.update?.();
  }
  currentWeapon() {
    const h = this.active; if (!h) return null;
    if (h.vehicle) return h.vehicle.weapon;
    return WEAPONS[h.weapon] || null;
  }
  canFire() {
    const h = this.active;
    if (!h || this.state !== 'turn' || !h.alive) return false;
    if (h.vehicle) return !h.vehicle.dead;
    const w = this.currentWeapon();
    return !!w && h.has(h.weapon) && (h.ground || this.jetFuel > 0) && !h.swim;
  }
  pressFire() {
    const a = this.active;
    if (a && !a.vehicle && this.isHuman(a.team) && this.input.fwd !== 0) { this.msg('Остановитесь, чтобы стрелять', 'warn'); return; }
    if (!this.canFire()) {
      const h = this.active;
      if (h && h.swim && this.state === 'turn' && this.isHuman(h.team)) this.msg('В воде стрелять нельзя', 'warn');
      return;
    }
    const w = this.currentWeapon();
    if (CHARGE_KINDS.has(w.kind)) { this.charging = true; this.power = 0; }
    else this.fire();
  }
  releaseFire() { if (this.charging) this.fire(); }
  fire() {
    const h = this.active, w = this.currentWeapon(); if (!h || !w) return;
    const inVeh = !!h.vehicle;
    const id = inVeh ? null : h.weapon;
    const yaw = inVeh ? h.vehicle.aimYaw : h.yaw, pitch = inVeh ? h.vehicle.pitch : h.pitch;
    const origin = inVeh ? h.vehicle.muzzle() : h.muzzle();
    const dir = aimDir(yaw, pitch);
    const power = Math.max(0.12, this.power);
    this.charging = false; this.power = 0;
    let ends = !w.free, retreat = false;
    if (!inVeh) {
      const act = { melee: FoxAction.ATTACK, grenade: FoxAction.THROW, place: FoxAction.PLACE, healtouch: FoxAction.PLACE }[w.kind]
        || (['hitscan', 'healdart', 'burst', 'spread', 'flame', 'ballistic'].includes(w.kind) ? FoxAction.FIRE : null);
      if (act) h.model.play(act);
    }
    switch (w.kind) {
      case 'melee': ends = this.fireMelee(h, w); break;
      case 'hitscan': case 'healdart': this.fireHitscan(h, w, origin, dir, 1); break;
      case 'burst': this.fireBurst(h, w, origin, yaw, pitch); break;
      case 'spread': this.fireHitscan(h, w, origin, dir, w.pellets); break;
      case 'flame': this.fireFlame(h, w, origin, dir); break;
      case 'ballistic': this.fireProjectile(h, w, id, origin, dir, power, inVeh); break;
      case 'grenade': this.fireProjectile(h, w, id, origin, dir, power, false); break;
      case 'place': retreat = this.placeItem(h, id, w); if (!retreat) ends = true; break;
      case 'suicide': this.explode(h.center(), w.r, w.dmg, h, {}); h.hp = 0; this.hurt(h, 1, h); break;
      case 'airstrike': this.fireAirstrike(h, w); break;
      case 'shockwave': this.shockwave(h, w); break;
      case 'healtouch': if (!this.healTouch(h, w)) return; break;
      case 'selfheal': if (h.hp >= h.maxHp && !h.status.poison) { this.msg('Здоровье и так полное', 'warn'); return; } this.heal(h, w.heal); Sound.play('heal'); break;
      case 'jetpack': this.jetFuel = w.fuel; this.msg('Ранец включён: держите «Прыжок»', 'info'); Sound.play('jet'); break;
      case 'hide': h.status.hidden = true; h.model.setHidden(true); this.msg(`${h.name} замаскировался`, 'info'); break;
      case 'pickpocket': if (!this.pickpocket(h, w)) return; break;
    }
    if (!inVeh && id) h.use(id);
    if (!inVeh && id && !h.has(id)) { const d = this.defaultWeapon(h); this.selectWeapon(d, true); }
    if (retreat) { this.state = 'retreat'; this.timer = Math.min(this.timer, 5); this.msg('Бегите! Динамит взорвётся через 5 секунд', 'warn'); }
    else if (ends) this.endTurn();
    this.hooks.update?.();
  }
  foxesNear(p, r, filter) { return this.foxes.filter(o => o.alive && !o.vehicle && o.center().distanceTo(p) < r && (!filter || filter(o))); }
  fireMelee(h, w) {
    Sound.play('swing');
    const f = fwd(h.yaw);
    const targets = this.foxesNear(h.center(), w.range + 0.6, o => o !== h).filter(o => { const d = o.pos.clone().sub(h.pos).setY(0); return d.length() < 0.3 || d.normalize().dot(f) > 0.4; });
    targets.sort((a, b) => a.pos.distanceTo(h.pos) - b.pos.distanceTo(h.pos));
    const t = targets[0];
    // удар по технике
    if (!t) {
      const p = h.center().addScaledVector(f, 1.4), c = this.world.solidAt(p.x, p.y, p.z);
      if (c && c !== 'terrain' && c.ent) { this.damageEnt(c.ent, w.dmg * 0.5, h); Sound.play('punch'); return true; }
      this.msg('Мимо — рядом никого', 'warn');
      return true;
    }
    Sound.play(w.stun ? 'zap' : 'punch');
    if (w.stun) { t.status.sleep = Math.max(t.status.sleep, 1); this.fx.sparks(t.center()); }
    this.hurt(t, w.dmg, h);
    t.vel.copy(f).multiplyScalar(w.push).setY(3 + w.push * 0.3); t.ground = false; t.swim = false;
    this.fx.impact(t.center(), 'fox');
    this.msg(pick(QUIPS.hit), 'quip');
    return true;
  }
  traceShot(h, origin, dir, range, ignoreVeh) {
    // луч с проверкой бойцов (капсулы), построек и рельефа
    const step = 0.2, p = origin.clone();
    for (let d = 0; d < range; d += step) {
      p.addScaledVector(dir, step);
      for (const o of this.foxes) {
        if (!o.alive || o === h || o.vehicle) continue;
        if (Math.abs(o.pos.x - p.x) > 0.6 || Math.abs(o.pos.z - p.z) > 0.6) continue;
        if (o.capsuleDist(p) < 0) return { type: 'fox', fox: o, point: p.clone() };
      }
      const y = this.world.getH(p.x, p.z);
      if (p.y <= y) return { type: 'terrain', point: p.clone() };
      for (const c of this.world.colliders) {
        if (p.y > c.y0 && p.y < c.y1 && this.world.inFoot(c, p.x, p.z)) {
          if (ignoreVeh && c === ignoreVeh.col) continue;
          return { type: 'solid', col: c, point: p.clone() };
        }
      }
      if (p.y < WATER_Y && y < WATER_Y) return { type: 'water', point: p.clone() };
    }
    return { type: 'none', point: p.clone() };
  }
  fireHitscan(h, w, origin, dir, n) {
    Sound.play(w.kind === 'spread' ? 'shotgun' : w.scope ? 'sniper' : 'shot');
    this.fx.muzzle(origin);
    let anyHit = false;
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(w.spread || 0)).normalize();
      const r = this.traceShot(h, origin, d, w.range, h.vehicle);
      this.fx.tracer(origin, r.point, w.kind === 'healdart' ? VFX.healTracer : VFX.tracer);
      if (r.type === 'fox') {
        anyHit = true;
        if (w.kind === 'healdart') { this.heal(r.fox, w.heal); Sound.play('heal'); continue; }
        const falloff = w.kind === 'spread' ? clamp(1.2 - r.point.distanceTo(origin) / w.range, 0.3, 1) : 1;
        this.hurt(r.fox, w.dmg * falloff, h);
        if (w.sleep) { r.fox.status.sleep = 1; this.msg(`${r.fox.name} засыпает…`, 'info'); }
        r.fox.vel.addScaledVector(d, 1.5);
        this.fx.impact(r.point, 'fox');
      } else if (r.type === 'solid') { if (r.col.ent) this.damageEnt(r.col.ent, w.dmg * 0.6, h); this.fx.impact(r.point, 'dirt'); }
      else if (r.type === 'terrain') this.fx.impact(r.point, 'dirt');
      else if (r.type === 'water') this.fx.impact(r.point, 'water');
    }
    if (w.kind !== 'healdart') this.msg(anyHit ? pick(QUIPS.hit) : pick(QUIPS.miss), 'quip');
    this.lastBoom = origin.clone().addScaledVector(dir, 8); this.boomT = 1.2;
  }
  fireBurst(h, w, origin, yaw, pitch) {
    for (let i = 0; i < w.shots; i++) {
      this.queue.push({ t: i * 0.09, fn: () => {
        const o = h.vehicle ? h.vehicle.muzzle() : h.muzzle();
        this.fireHitscan(h, { ...w, kind: 'hitscan' }, o, aimDir(yaw + rnd(-1, 1) * w.spread, pitch + rnd(-1, 1) * w.spread), 1);
      } });
    }
  }
  fireFlame(h, w, origin, dir) {
    Sound.play('flame');
    for (let i = 0; i < 20; i++) this.queue.push({ t: i * 0.04, fn: () => this.fx.flame(origin, dir, w.range * 0.5) });
    for (const o of this.foxes) {
      if (!o.alive || o === h || o.vehicle) continue;
      const v = o.center().sub(origin), d = v.length();
      if (d < w.range && v.normalize().dot(dir) > 0.9) {
        if (this.traceShot(h, origin, v, d + 0.5).fox !== o) continue;
        this.hurt(o, w.dmg * (1 - d / w.range * 0.4), h); o.status.burn = 2;
      }
    }
    this.lastBoom = origin.clone().addScaledVector(dir, 4); this.boomT = 1.2;
  }
  fireProjectile(h, w, id, origin, dir, power, inVeh) {
    const speed = w.speed * power;
    const kind = w.kind === 'grenade' ? 'grenade' : 'shell';
    let mesh;
    if (kind === 'grenade') { mesh = MD.buildWeaponModel(id || 'grenade').hand; mesh.children.forEach(c => { c.position.z = 0; }); }
    else {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7, 8).rotateX(Math.PI / 2), MD.mat(id === 'mortar' ? 0x3a3a34 : 0x55533f)); mesh.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 8).rotateX(Math.PI / 2), MD.mat(0xb8322a)); tip.position.z = 0.45; mesh.add(tip);
    }
    this.scene.add(mesh);
    this.proj.push({ kind, w, id, pos: origin.clone(), vel: dir.clone().multiplyScalar(speed), owner: h, t: 0, fuse: w.fuse || 0, mesh, cam: true, wind: w.wind || inVeh && h.vehicle.type !== 'pillbox' });
    Sound.play(kind === 'grenade' ? 'throw' : id === 'mortar' || inVeh ? 'mortar' : 'launch');
    if (kind === 'shell') this.fx.muzzle(origin);
  }
  placeItem(h, id, w) {
    const p = h.pos.clone().addScaledVector(fwd(h.yaw), 0.9); p.y = this.world.groundAt(p.x, p.z, h.pos.y + 0.5);
    if (id === 'mine') { this.addMine(p, h.team, false); this.msg('Мина установлена', 'info'); return false; }
    const m = MD.buildWeaponModel('tnt').hand; m.position.copy(p); m.children.forEach(c => { c.position.z = 0; c.position.y += 0.1; });
    this.scene.add(m);
    this.tnts.push({ pos: p, t: w.fuse, w, owner: h, mesh: m });
    return true;
  }
  addMine(p, team, armed) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.14, 12), MD.mat(0x3d4426)));
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0x551111 }));
    light.position.y = 0.12; g.add(light);
    g.position.copy(p); this.scene.add(g);
    this.mines.push({ pos: p, team, armed, trig: -1, mesh: g, light });
  }
  fireAirstrike(h, w) {
    const t = this.target || h.pos.clone();
    const d = fwd(rnd(0, Math.PI * 2));
    const plane = MD.buildPlane(); plane.position.set(t.x - d.x * 140, 45, t.z - d.z * 140); plane.lookAt(t.x, 45, t.z); plane.rotateY(Math.PI);
    this.scene.add(plane);
    this.airships.push({ obj: plane, dir: d, speed: 45, life: 7, kind: 'plane' });
    Sound.play('plane');
    const delay = 140 / 45;
    for (let i = -2; i <= 2; i++) {
      this.queue.push({ t: delay + i * 0.12, fn: () => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), MD.mat(0x2d2d28)); mesh.scale.set(0.25, 0.25, 0.5);
        this.scene.add(mesh);
        this.proj.push({ kind: 'shell', w: { ...w, r: w.r, dmg: w.dmg }, id: 'bomb', pos: new THREE.Vector3(t.x + d.x * i * 3.2, 42, t.z + d.z * i * 3.2), vel: d.clone().multiplyScalar(6).setY(-6), owner: h, t: 0, mesh, cam: i === 0 });
      } });
    }
    this.ring.visible = false;
  }
  shockwave(h, w) {
    Sound.play('boom', 1.5);
    this.fx.explosion(h.center(), 3, { air: true });
    for (const o of this.foxes) {
      if (!o.alive || o === h) continue;
      const v = o.center().sub(h.center()), d = v.length();
      if (d < w.r) { const f = 1 - d / w.r; this.hurt(o, w.dmg * f + 5, h); o.vel.copy(v.normalize().multiplyScalar(16 * f + 4)).setY(8 * f + 3); o.ground = false; o.swim = false; }
    }
    this.shake = 1;
  }
  healTouch(h, w) {
    const allies = this.foxesNear(h.center(), w.range, o => o !== h && o.team === h.team && (o.hp < o.maxHp || o.status.poison));
    if (!allies.length) { this.msg('Рядом нет раненого союзника', 'warn'); return false; }
    allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    this.heal(allies[0], w.heal); Sound.play('heal');
    return true;
  }
  pickpocket(h, w) {
    const foes = this.foxesNear(h.center(), w.range, o => o.team !== h.team);
    if (!foes.length) { this.msg('Рядом нет противника', 'warn'); return false; }
    const f = foes[0], items = Object.keys(f.inv).filter(k => f.inv[k] > 0 && f.inv[k] !== INF);
    if (!items.length) { this.msg(`У ${f.name} нечего украсть`, 'warn'); return true; }
    const it = pick(items); f.inv[it]--; h.give(it, 1);
    this.msg(`${h.name} украл у ${f.name}: ${WEAPONS[it].name}`, 'good'); Sound.play('pickup');
    return true;
  }

  /* ---------- взрывы ---------- */
  explode(p, r, dmg, owner, opts = {}) {
    const w = this.world;
    const ground = w.groundAt(p.x, p.z, p.y + 0.5);
    const air = p.y - ground > r * 0.8;
    if (!opts.heal && !opts.gas && !air && !opts.noCrater) w.crater(p.x, p.y, p.z, r * 0.85);
    if (opts.heal) { this.fx.healBurst(p); Sound.play('heal'); }
    else if (opts.gas) { this.fx.gasCloud(p, r); Sound.play('smallboom'); this.gas.push({ pos: p.clone(), r, rounds: 2 }); }
    else { this.fx.explosion(p, r, { air }); Sound.play(r > 3 ? 'boom' : 'smallboom', r / 5); this.shake = Math.min(1.4, r * 0.18); }
    if (p.y < 0.3 && w.getH(p.x, p.z) < 0) this.fx.splash(p, 1);
    this.lastBoom = p.clone(); this.boomT = 1.6;
    for (const h of this.foxes) {
      if (!h.alive) continue;
      const c = h.vehicle ? h.vehicle.pos.clone().setY(h.vehicle.pos.y + 1) : h.center(), d = h.vehicle ? c.distanceTo(p) : Math.max(0, h.capsuleDist(p));
      if (d >= r + 0.8) continue;
      const f = 1 - d / (r + 0.8);
      if (opts.heal) { this.heal(h, opts.heal); continue; }
      if (opts.poison && !h.vehicle) { h.status.poison = true; this.msg(fmt(QUIPS.poison[0], h.name), 'warn'); }
      if (h.vehicle) continue;
      this.hurt(h, dmg * f, owner);
      if (opts.fire) h.status.burn = 2;
      const dir = c.clone().sub(p); if (dir.lengthSq() < 0.01) dir.set(0, 1, 0); dir.normalize();
      h.vel.addScaledVector(dir, f * 12).y += 5 * f; h.ground = false; h.swim = false;
    }
    if (!opts.heal && !opts.gas) {
      for (const e of [...w.ents]) {
        if (e.hp <= 0) continue;
        const c = e.col, cy = clamp(p.y, c.y0, c.y1);
        const size = c.kind === 'cyl' ? c.r : Math.min(c.hx, c.hz);
        const d = Math.max(0, Math.hypot(c.x - p.x, c.z - p.z) - size * 0.7);
        const dd = Math.hypot(d, cy - p.y);
        if (dd < r + 0.5) this.damageEnt(e, dmg * (1 - dd / (r + 0.5)) * 1.3 + (e.kind === 'barrel' ? 1 : 0), owner);
      }
      for (const t of w.trees) if (t.obj.visible && Math.hypot(t.obj.position.x - p.x, t.obj.position.z - p.z) < r * 0.8 && t.obj.position.y < p.y + r) {
        t.obj.visible = false; w.removeCollider(t.col);
        for (let i = 0; i < 6; i++) this.fx.chunk(t.obj.position.clone().setY(t.obj.position.y + 1.5), new THREE.Vector3(rnd(-4, 4), rnd(3, 8), rnd(-4, 4)), 0x4a6b2a, 0.35, 2);
      }
      for (const m of this.mines) if (m.trig < 0 && m.pos.distanceTo(p) < r + 0.5) m.trig = 0.15;
      for (const t of this.tnts) if (t.pos.distanceTo(p) < r + 0.5) t.t = Math.min(t.t, 0.1);
      for (const c of this.crates) if (!c.gone && c.pos.distanceTo(p) < r * 0.7 && c.type !== 'medal') { c.gone = true; this.scene.remove(c.obj); this.fx.puff(c.pos, 0x8a6238, 1, 1); }
    }
  }
  damageEnt(e, dmg, owner) {
    if (e.hp <= 0 || dmg <= 0) return;
    e.hp -= dmg;
    if (e.vehicle) {
      this.float(e.vehicle.pos.clone().setY(e.vehicle.pos.y + 3), '−' + Math.round(dmg), VFX.damageText);
      if (e.vehicle.occupant && owner && owner !== e.vehicle.occupant) owner.stats.dmg += Math.round(dmg);
    }
    if (e.hp <= 0) this.destroyEnt(e, owner);
  }
  destroyEnt(e, owner) {
    const w = this.world, pos = new THREE.Vector3(e.col.x, (e.col.y0 + e.col.y1) / 2, e.col.z);
    w.removeCollider(e.col);
    const i = w.ents.indexOf(e); if (i >= 0) w.ents.splice(i, 1);
    this.scene.remove(e.obj);
    if (e.kind === 'barrel') { this.queue.push({ t: 0.12, fn: () => this.explode(pos, 4.5, 40, owner) }); return; }
    if (e.vehicle) {
      const v = e.vehicle; v.dead = true;
      this.queue.push({ t: 0.05, fn: () => this.explode(v.pos.clone().setY(v.pos.y + 1), 5, 30, owner) });
      const occ = v.occupant;
      if (occ) {
        v.occupant = null; occ.vehicle = null; occ.model.root.visible = true;
        occ.pos.copy(v.pos).add(new THREE.Vector3(rnd(-2, 2), 2.5, rnd(-2, 2))); occ.ground = false; occ.vel.set(rnd(-3, 3), 6, rnd(-3, 3));
        this.hurt(occ, 20, owner);
      }
      // обломки
      const wreck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 3), MD.mat(0x2a2622)); wreck.position.copy(v.pos).y += 0.4; wreck.rotation.y = v.yaw; this.scene.add(wreck);
      this.msg(`${v.name} уничтожен!`, 'kill');
      return;
    }
    for (let k = 0; k < 14; k++) this.fx.chunk(pos.clone(), new THREE.Vector3(rnd(-5, 5), rnd(3, 9), rnd(-5, 5)), e.kind === 'sandbags' ? 0xb39d6c : e.kind === 'fence' ? 0x7c5a36 : 0x7d766a, rnd(0.2, 0.5), 2.5);
    this.fx.puff(pos, 0x9a8a70, 3, 2);
    // обрушение строения — бойцы на крыше падают
    for (const h of this.foxes) if (h.alive && w.inFoot(e.col, h.pos.x, h.pos.z, 0.3)) h.ground = false;
  }

  /* ---------- техника ---------- */
  nearVehicle(h) { return this.vehicles.find(v => !v.dead && !v.occupant && v.pos.distanceTo(h.pos) < (v.type === 'pillbox' ? 4.2 : 3.6)); }
  enterVehicle(h, v, silent) {
    h.vehicle = v; v.occupant = h; h.model.root.visible = false; h.pos.copy(v.pos); h.ground = true; h.swim = false;
    v.aimYaw = v.type === 'tank' ? v.yaw : v.aimYaw; v.fuel = v.type === 'tank' ? 12 : 0;
    if (!silent) { this.msg(`${h.name} занимает: ${v.name}`, 'info'); Sound.play('engine'); }
    this.scope = false; this.hooks.update?.();
  }
  exitVehicle(h) {
    const v = h.vehicle; if (!v) return;
    v.occupant = null; h.vehicle = null; h.model.root.visible = true;
    const back = fwd(v.yaw).multiplyScalar(-(v.type === 'pillbox' ? 3.4 : 3));
    for (let a = 0; a < 8; a++) {
      const p = v.pos.clone().add(back.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * Math.PI / 4));
      if (!this.world.blocked(p.x, p.z, this.world.groundAt(p.x, p.z) + 0.1, h.collider.height, h.collider.radius)) { h.pos.set(p.x, this.world.groundAt(p.x, p.z), p.z); break; }
    }
    h.ground = true; this.hooks.update?.();
  }

  /* ---------- ящики, дирижабли, подкрепления ---------- */
  spawnCrate(type, x, z, fromAir) {
    const obj = MD.buildCrate(type);
    const y = fromAir ? 40 : this.world.groundAt(x, z);
    obj.position.set(x, y, z); this.scene.add(obj);
    let chute = null;
    if (fromAir) { chute = MD.buildParachute(); obj.add(chute); chute.position.y = -0.2; }
    this.crates.push({ type, pos: obj.position, obj, chute, falling: fromAir, gone: false, item: type === 'weapon' ? pick(CRATE_POOL) : null });
  }
  airdrop() {
    const blimp = MD.buildBlimp(), z = rnd(-40, 40), dir = Math.random() < 0.5 ? 1 : -1;
    blimp.position.set(-dir * 120, 42, z); blimp.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(blimp);
    const drops = [rnd(-45, 45), rnd(-45, 45)].slice(0, Math.random() < 0.5 ? 1 : 2);
    this.airships.push({ obj: blimp, dir: new THREE.Vector3(dir, 0, 0), speed: 16, life: 16, kind: 'blimp', drops: drops.map(x => ({ x: x * dir, done: false })) });
    this.msg('Дирижабль сбрасывает припасы!', 'good');
  }
  reinforce(ranks) {
    const team = this.teams[1];
    for (const r of ranks) {
      const h = new Fox(this, team, { name: pick(team.nation.names), rank: r });
      const s = this.spotIn(team.zone, this.foxes.map(o => o.pos));
      h.pos.set(s.x, 35, s.z); h.ground = false; h.vel.set(0, 0, 0); h.chute = MD.buildParachute(); h.model.root.add(h.chute); h.chute.position.y = 1.1;
      h.yaw = -Math.PI / 2;
      team.foxes.push(h); this.foxes.push(h);
    }
    this.msg('Подкрепление противника спускается на парашютах!', 'warn');
  }

  /* ---------- управление игроком ---------- */
  handleHuman(dt) {
    const h = this.active, inp = this.input;
    if (!h || !h.alive) return;
    const sens = this.settings.sens;
    if (inp.enter) {
      inp.enter = false;
      if (this.state === 'turn') { if (h.vehicle) this.exitVehicle(h); else { const v = this.nearVehicle(h); if (v) this.enterVehicle(h, v); else this.msg('Рядом нет свободной техники', 'warn'); } }
    }
    if (inp.scope) { inp.scope = false; const w = this.currentWeapon(); if (w && DIRECT_KINDS.has(w.kind) && !h.vehicle) this.scope = !this.scope; }
    if (inp.firePressed) { inp.firePressed = false; this.pressFire(); }
    if (inp.fireReleased) { inp.fireReleased = false; this.releaseFire(); }
    const w = this.currentWeapon();
    // авиаудар: выбор точки
    if (w && w.kind === 'airstrike' && !h.vehicle && this.state === 'turn') {
      const f = fwd(this.camYaw ?? h.yaw), r = new THREE.Vector3(-f.z, 0, f.x);
      this.target.addScaledVector(f, inp.fwd * 30 * dt).addScaledVector(r, -inp.turn * 30 * dt);
      this.target.addScaledVector(r, -inp.dragYaw * 0.12).addScaledVector(f, inp.dragPitch * 0.12);
      inp.dragYaw = 0; inp.dragPitch = 0;
      if (inp.tap) { const p = this.pickGround(inp.tap); if (p) this.target.copy(p); inp.tap = null; }
      this.target.x = clamp(this.target.x, -HALF + 5, HALF - 5); this.target.z = clamp(this.target.z, -HALF + 5, HALF - 5);
      this.target.y = Math.max(0, this.world.groundAt(this.target.x, this.target.z));
      this.ring.visible = true; this.ring.position.copy(this.target).y += 0.3;
      return;
    }
    inp.tap = null;
    // прицел
    const scopeK = this.scope ? 0.35 : 1;
    const yawDelta = -inp.dragYaw * 0.006 * sens * scopeK; inp.dragYaw = 0;
    const pitchDelta = (-inp.dragPitch * 0.005 * sens + inp.pitch * 0.9 * dt) * scopeK; inp.dragPitch = 0;
    if (h.vehicle) {
      const v = h.vehicle;
      v.pitch = clamp(v.pitch + pitchDelta, v.type === 'artillery' ? 0.1 : -0.1, v.type === 'artillery' ? 1.2 : 0.7);
      if (v.type === 'tank') {
        if (this.charging) return;
        v.aimYaw += yawDelta;
        if ((inp.fwd || inp.turn) && v.fuel > 0 && this.state === 'turn') {
          v.yaw += -inp.turn * 1.1 * dt; v.aimYaw += -inp.turn * 1.1 * dt;
          const sp = inp.fwd * 4 * dt, np = v.pos.clone().addScaledVector(fwd(v.yaw), sp);
          const old = { ...v.col };
          v.col.x = -999;
          const blocked = this.world.blocked(np.x, np.z, v.pos.y, 1.5, 1.8) || this.world.getH(np.x, np.z) < -0.8 || Math.abs(this.world.getH(np.x, np.z) - v.pos.y) > 1.2 || !this.world.inside(np.x, np.z);
          Object.assign(v.col, old);
          if (!blocked) { v.pos.set(np.x, this.world.getH(np.x, np.z), np.z); v.fuel -= Math.abs(sp); for (const m of this.mines) if (m.armed && m.trig < 0 && m.pos.distanceTo(v.pos) < 2.2) m.trig = 1; }
          if (Math.random() < 0.1) Sound.play('engine');
        }
        v.sync(); h.pos.copy(v.pos);
      } else {
        v.aimYaw += yawDelta - inp.turn * 1.2 * dt;
        if (v.type === 'artillery') { const d = angDiff(v.aimYaw, v.yaw); if (Math.abs(d) > 0.9) v.aimYaw = v.yaw + Math.sign(d) * 0.9; }
        v.sync();
      }
      return;
    }
    h.pitch = clamp(h.pitch + pitchDelta, -0.6, 1.45);
    if (this.charging) { h.moving = false; h.running = false; h.yaw += yawDelta; return; }
    h.yaw += yawDelta;
    if (this.state !== 'turn' && this.state !== 'retreat') return;
    // ходьба и бег (танковое управление, как в оригинале)
    h.yaw -= inp.turn * TURN_SPEED * dt * (this.scope ? 0.3 : 1);
    const canRun = inp.run && this.stamina > 0 && !h.swim;
    h.running = canRun && inp.fwd > 0;
    const speed = h.swim ? SWIM : h.running ? RUN : WALK;
    if (h.running) this.stamina = Math.max(0, this.stamina - 22 * dt);
    this.moveFox(h, inp.fwd * speed, dt);
    if (inp.fwd) this.scope = false;
    // прыжок / ранец
    if (this.jetFuel > 0 && inp.jumpHeld) {
      this.jetFuel -= dt; h.ground = false; h.swim = false;
      h.vel.y = Math.min(6, h.vel.y + 30 * dt);
      const f = fwd(h.yaw); h.vel.x = f.x * inp.fwd * 6; h.vel.z = f.z * inp.fwd * 6;
      if (Math.random() < 0.5) this.fx.puff(h.pos.clone().setY(h.pos.y + 0.6), 0xffb050, 0.3, 0.4);
      if (Math.random() < 0.15) Sound.play('jet');
      if (this.jetFuel <= 0) this.msg('Топливо ранца кончилось', 'warn');
    } else if (inp.jump && h.ground && !h.swim && this.stamina >= 10) {
      const f = fwd(h.yaw);
      h.vel.set(f.x * inp.fwd * (h.running ? 5 : 3.2), 7, f.z * inp.fwd * (h.running ? 5 : 3.2)); h.ground = false; this.stamina -= 10; Sound.play('jump');
    }
    inp.jump = false;
  }
  moveFox(h, speed, dt) {
    const w = this.world;
    h.moving = Math.abs(speed) > 0.01 && (h.ground || h.swim);
    if (!h.moving) return;
    const f = fwd(h.yaw);
    const wire = w.inWire(h.pos.x, h.pos.z);
    const k = wire ? 0.45 : 1;
    const nx = h.pos.x + f.x * speed * dt * k, nz = h.pos.z + f.z * speed * dt * k;
    const tryMove = (x, z) => {
      if (!w.inside(x, z)) return false;
      if (w.blocked(x, z, h.pos.y, h.collider.height, h.collider.radius)) return false;
      const g = w.groundAt(x, z, h.pos.y);
      if (!h.swim && g - h.pos.y > 0.75) return false;
      if (h.swim && g - h.pos.y > 1.6) return false; // выбраться на берег можно только на пологом месте
      h.pos.x = x; h.pos.z = z;
      return true;
    };
    if (!tryMove(nx, nz) && !tryMove(nx, h.pos.z)) tryMove(h.pos.x, nz);
    if (wire && !h.wireHit) { h.wireHit = true; this.hurt(h, 5, null, 'wire'); this.msg('Колючая проволока! −5', 'warn'); }
    if (Math.random() < (h.running ? 0.12 : 0.06)) Sound.play('step');
    this.checkPickups(h);
    for (const m of this.mines) if (m.armed && m.trig < 0 && m.pos.distanceTo(h.pos) < 1.5) { m.trig = 1.0; this.msg('Щёлк… Мина!', 'warn'); }
  }
  pickGround(tap) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(tap, this.camera);
    const hit = ray.intersectObject(this.world.terrain)[0];
    return hit ? hit.point : null;
  }

  /* ---------- физика бойцов ---------- */
  updFox(h, dt) {
    const w = this.world;
    if (h.state === 'dead') {
      h.deadT += dt;
      h.model.update(dt, FoxAnim.DEATH);
      if (h.deadT > 1.4 && !h.grave) {
        h.grave = MD.buildGrave(h.team.nation); h.grave.position.copy(h.pos); h.grave.position.y = w.groundAt(h.pos.x, h.pos.z); h.grave.rotation.y = h.yaw;
        this.scene.add(h.grave); this.scene.remove(h.model.root);
        this.fx.puff(h.pos.clone().setY(h.pos.y + 0.8), 0xffffff, 1.2, 1.2);
      }
      if (h.grave) h.grave.position.y = Math.max(w.groundAt(h.pos.x, h.pos.z), -0.4);
      return;
    }
    if (h.vehicle) { h.model.update(dt, FoxAnim.IDLE); return; }
    if (!h.ground && !h.swim) {
      const chute = !!h.chute;
      h.vel.y -= GRAV * dt * (chute ? 0.1 : 1);
      if (chute) h.vel.y = Math.max(h.vel.y, -3);
      const steps = Math.max(1, Math.ceil(h.vel.length() * dt / 0.3));
      for (let s = 0; s < steps; s++) {
        const nx = h.pos.x + h.vel.x * dt / steps, nz = h.pos.z + h.vel.z * dt / steps, ny = h.pos.y + h.vel.y * dt / steps;
        if (!w.inside(nx, nz) || w.blocked(nx, nz, ny, h.collider.height, h.collider.radius)) { h.vel.x *= -0.25; h.vel.z *= -0.25; }
        else { h.pos.x = nx; h.pos.z = nz; }
        h.pos.y = ny;
        const g = w.groundAt(h.pos.x, h.pos.z, h.pos.y + 0.3);
        if (h.pos.y <= g && g >= WADE_DEPTH) {
          const vy = h.vel.y; h.pos.y = g; h.vel.set(0, 0, 0); h.ground = true;
          if (chute) { h.model.root.remove(h.chute); h.chute = null; }
          else if (vy < -11) { this.hurt(h, (-vy - 11) * 4, h.lastHitBy && this.state === 'resolve' ? h.lastHitBy : null, 'fall'); this.msg(`${h.name} больно приземлился`, 'warn'); }
          Sound.play('step'); this.checkPickups(h);
          for (const m of this.mines) if (m.armed && m.trig < 0 && m.pos.distanceTo(h.pos) < 1.5) m.trig = 1.0;
          break;
        }
        if (h.pos.y < SWIM_Y + 0.1 && g < WADE_DEPTH) { this.enterWater(h); break; }
      }
    } else if (h.swim) {
      h.pos.y += (SWIM_Y + Math.sin(this.t * 3 + h.pos.x) * 0.05 - h.pos.y) * Math.min(1, dt * 5);
      const g = w.groundAt(h.pos.x, h.pos.z, h.pos.y + 0.3);
      if (g > WADE_DEPTH + 0.05) { h.swim = false; h.ground = true; h.pos.y = g; }
      if (w.isPoisonWater() && !h.status.poison) { h.status.poison = true; this.msg(fmt(QUIPS.poison[0], h.name), 'warn'); }
    } else {
      const g = w.groundAt(h.pos.x, h.pos.z, h.pos.y + 0.3);
      if (g < WADE_DEPTH) this.enterWater(h);
      else if (h.pos.y > g + 0.08) { h.ground = false; h.vel.set(0, 0, 0); }
      else h.pos.y = g;
      // вброд по ядовитой воде тоже отравляет
      if (h.pos.y < WATER_Y - 0.3 && w.isPoisonWater() && !h.status.poison) { h.status.poison = true; this.msg(fmt(QUIPS.poison[0], h.name), 'warn'); }
    }
    // анимация
    const A = FoxAnim;
    const anim = h.anim === A.CELEBRATE ? A.CELEBRATE : h.swim ? A.SWIM : !h.ground ? A.AIR : h.status.sleep > 0 ? A.SLEEP : h.moving ? (h.running ? A.RUN : A.WALK) : (h === this.active && this.state === 'turn' ? A.AIM : A.IDLE);
    h.model.update(dt, anim, h.pitch, !!h.weapon);
    h.model.root.position.copy(h.pos);
    h.model.root.rotation.y = h.yaw;
    if (h.status.burn > 0 && Math.random() < 0.3) this.fx.fireOn(h.pos);
    if (h.status.poison && Math.random() < 0.05) this.fx.puff(h.head(), VFX.gas, 0.3, 0.8);
    h.moving = false;
  }
  enterWater(h) {
    h.swim = true; h.ground = false; h.vel.set(0, 0, 0); h.pos.y = SWIM_Y;
    this.fx.splash(h.pos, 0.8); Sound.play('splash');
    if (Math.random() < 0.5) this.msg(pick(QUIPS.splash), 'quip');
  }
  checkPickups(h) {
    for (const c of this.crates) {
      if (c.gone || c.falling || c.pos.distanceTo(h.pos) > 1.5) continue;
      c.gone = true; this.scene.remove(c.obj);
      if (c.type === 'health') { this.heal(h, 50); this.msg(fmt(QUIPS.crate[0], h.name, 'аптечку, +50'), 'good'); Sound.play('heal'); }
      else if (c.type === 'medal') {
        if (h.team.idx === 0 && this.cfg.mode === 'campaign') { this.medalsFound++; this.msg(fmt(QUIPS.medal[0], h.name), 'good'); Sound.play('medal'); }
        else { this.msg(`${h.name} растоптал медаль`, 'warn'); }
      } else { h.give(c.item, c.item === 'grenade' ? 2 : 1); this.msg(fmt(QUIPS.crate[0], h.name, WEAPONS[c.item].name), 'good'); Sound.play('pickup'); }
      this.hooks.update?.();
    }
  }

  /* ---------- снаряды ---------- */
  updProj(dt) {
    const w = this.world;
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const p = this.proj[i]; p.t += dt;
      let dead = false;
      if (p.rest) {
        const g = w.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3);
        if (p.pos.y > g + 0.3) p.rest = false; else p.pos.y = g + 0.15;
      } else {
        if (p.wind && this.cfg.wind) p.vel.addScaledVector(this.wind, dt);
        p.vel.y -= GRAV * dt;
        const steps = Math.max(1, Math.ceil(p.vel.length() * dt / 0.25));
        for (let s = 0; s < steps && !dead; s++) {
          p.pos.addScaledVector(p.vel, dt / steps);
          if (!w.inside(p.pos.x, p.pos.z) && p.pos.y < -5) { dead = true; break; }
          if (Math.abs(p.pos.x) > HALF + 60 || Math.abs(p.pos.z) > HALF + 60 || p.pos.y < -15) { dead = true; break; }
          const g = w.getH(p.pos.x, p.pos.z);
          if (p.pos.y < WATER_Y && g < WATER_Y) { this.fx.splash(p.pos, 0.6); Sound.play('splash'); if (p.kind === 'shell' && p.pos.y > -1) this.explode(p.pos.clone().setY(0.1), p.w.r * 0.7, p.w.dmg * 0.7, p.owner, { noCrater: true }); dead = true; break; }
          // воздушный разрыв
          if ((p.id === 'airburst' || p.id === 'firerain') && p.vel.y < 0 && p.pos.y - w.groundAt(p.pos.x, p.pos.z) < 7) { this.airburst(p); dead = true; break; }
          let hitHog = null;
          if (p.kind !== 'grenade') for (const o of this.foxes) { if (o.alive && !o.vehicle && (o !== p.owner || p.t > 0.3) && o.capsuleDist(p.pos) < 0.05) { hitHog = o; break; } }
          const solid = w.solidAt(p.pos.x, p.pos.y, p.pos.z);
          if (solid && solid !== 'terrain' && p.owner?.vehicle && solid === p.owner.vehicle.col && p.t < 0.5) continue;
          if (solid || hitHog) {
            if (p.kind === 'grenade') { this.bounce(p, steps, solid); break; }
            if (p.kind === 'frag') { if (hitHog) this.hurt(hitHog, p.w.fragDmg, p.owner); this.fx.impact(p.pos, hitHog ? 'fox' : 'dirt'); dead = true; break; }
            if (solid && solid !== 'terrain' && solid.ent) this.damageEnt(solid.ent, p.w.dmg * 0.8, p.owner);
            this.explode(p.pos.clone(), p.w.r, p.w.dmg, p.owner, { fire: p.w.fire });
            dead = true; break;
          }
        }
      }
      if (!dead && p.kind === 'grenade' && (p.fuse -= dt) <= 0) { this.detonateGrenade(p); dead = true; }
      if (!dead && p.kind === 'shell' && p.id !== 'bomb' && Math.random() < 0.7) this.fx.trail(p.pos);
      if (dead) { this.scene.remove(p.mesh); this.proj.splice(i, 1); continue; }
      p.mesh.position.copy(p.pos);
      if (p.kind === 'grenade') { p.mesh.rotation.x += p.vel.length() * dt * 2; }
      else if (p.vel.lengthSq() > 0.01) p.mesh.lookAt(p.pos.clone().add(p.vel));
    }
  }
  bounce(p, steps, solid) {
    const w = this.world;
    p.pos.addScaledVector(p.vel, -1 / 60 / steps);
    let n;
    if (solid === 'terrain') n = w.normalAt(p.pos.x, p.pos.z);
    else { const c = solid; const d = new THREE.Vector3(p.pos.x - c.x, 0, p.pos.z - c.z); n = p.pos.y > c.y1 - 0.3 ? new THREE.Vector3(0, 1, 0) : d.normalize(); }
    const dot = p.vel.dot(n);
    if (dot < 0) p.vel.addScaledVector(n, -2 * dot);
    p.vel.multiplyScalar(0.5);
    if (Math.abs(dot) > 3) Sound.play('bounce');
    if (p.vel.length() < 1.2) { p.rest = true; p.vel.set(0, 0, 0); }
  }
  detonateGrenade(p) {
    const w = p.w, pos = p.pos.clone().setY(p.pos.y + 0.2);
    if (p.id === 'medball') { this.explode(pos, w.r, 0, p.owner, { heal: w.heal }); return; }
    if (p.id === 'gas') { this.explode(pos, w.r, w.dmg, p.owner, { gas: true, poison: true }); return; }
    this.explode(pos, w.r, w.dmg, p.owner, {});
    if (w.frags) for (let i = 0; i < w.frags; i++) {
      const d = new THREE.Vector3(rnd(-1, 1), rnd(0.2, 0.8), rnd(-1, 1)).normalize();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), MD.mat(0x333333)); this.scene.add(mesh);
      this.proj.push({ kind: 'frag', w, pos: pos.clone().addScaledVector(d, 0.5), vel: d.multiplyScalar(22), owner: p.owner, t: 0.3, mesh });
    }
    if (w.cluster) for (let i = 0; i < w.cluster; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), MD.mat(0x3a3a2a)); this.scene.add(mesh);
      this.proj.push({ kind: 'shell', id: 'bomblet', w: { r: 3, dmg: w.clusterDmg }, pos: pos.clone().setY(pos.y + 0.5), vel: new THREE.Vector3(rnd(-5, 5), rnd(7, 11), rnd(-5, 5)), owner: p.owner, t: 0.3, mesh });
    }
  }
  airburst(p) {
    const w = p.w;
    this.explode(p.pos.clone(), w.r, w.dmg, p.owner, { fire: w.fire });
    for (let i = 0; i < w.burst; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), MD.mat(w.fire ? 0xff7a2a : 0x3a3a2a)); this.scene.add(mesh);
      this.proj.push({ kind: 'shell', id: 'bomblet', w: { r: 3, dmg: w.burstDmg, fire: w.fire }, pos: p.pos.clone(), vel: new THREE.Vector3(p.vel.x * 0.3 + rnd(-4, 4), rnd(0, 3), p.vel.z * 0.3 + rnd(-4, 4)), owner: p.owner, t: 0.3, mesh });
    }
  }

  /* ---------- главный цикл ---------- */
  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.world.update(dt, this.cfg.wind ? this.wind : new THREE.Vector3());
    this.fx.update(dt);
    // очередь отложенных действий (очереди, кассеты, цепные взрывы)
    for (let i = this.queue.length - 1; i >= 0; i--) { const q = this.queue[i]; q.t -= dt; if (q.t <= 0) { this.queue.splice(i, 1); q.fn(); } }
    const h = this.active;
    if (this.state === 'intro') { this.introT -= dt; if (this.introT <= 0 || this.input.firePressed) { this.input.firePressed = false; this.nextTurn(); } }
    else if (this.state === 'turn' || this.state === 'retreat') {
      if (this.isHuman(h.team)) this.handleHuman(dt); else this.ai.tick(dt);
      if (this.charging) { this.power = Math.min(1, this.power + dt / 1.3); if (this.power >= 1 && this.isHuman(h.team)) this.fire(); }
      this.timer -= dt;
      if (this.timer <= 0) { if (this.state === 'turn') this.msg('Время вышло', 'warn'); this.endTurn(); }
      else if (this.timer < 5 && Math.floor(this.timer) !== Math.floor(this.timer + dt)) Sound.play('tick');
    } else if (this.state === 'resolve') {
      this.resolveT += dt;
      if (this.settled() || this.resolveT > 25) { this.settleT += dt; if (this.settleT > 1.3) this.finishTurn(); }
      else this.settleT = 0;
    }
    for (const o of this.foxes) this.updFox(o, dt);
    for (const v of this.vehicles) if (!v.dead && v.type === 'tank' && v !== h?.vehicle) v.sync();
    this.updProj(dt);
    this.updItems(dt);
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.t -= dt; f.pos.y += dt * 1.1; if (f.t <= 0) this.floats.splice(i, 1); }
    this.shake *= Math.pow(0.02, dt);
    this.boomT -= dt;
    this.updCamera(dt);
    this.updHelpers();
  }
  updItems(dt) {
    const w = this.world;
    // мины
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      if (m.trig >= 0) {
        m.light.material.color.setHex(Math.floor(m.trig * 8) % 2 ? 0xff2a1a : 0x551111);
        const before = m.trig; m.trig -= dt;
        if (Math.floor(before * 4) !== Math.floor(m.trig * 4)) Sound.play('beep');
        if (m.trig <= 0) { this.scene.remove(m.mesh); this.mines.splice(i, 1); this.explode(m.pos.clone().setY(m.pos.y + 0.2), 4, 45, null); }
      } else {
        m.light.material.color.setHex(m.armed && Math.floor(this.t * 1.5) % 3 === 0 ? 0xaa2a1a : 0x551111);
        m.pos.y = w.groundAt(m.pos.x, m.pos.z); m.mesh.position.copy(m.pos);
        if (m.pos.y < -0.5) { this.scene.remove(m.mesh); this.mines.splice(i, 1); }
      }
    }
    // динамит
    for (let i = this.tnts.length - 1; i >= 0; i--) {
      const t = this.tnts[i]; t.t -= dt;
      if (Math.random() < 0.5) this.fx.sparks(t.pos.clone().setY(t.pos.y + 0.35));
      if (t.t <= 0) { this.scene.remove(t.mesh); this.tnts.splice(i, 1); this.explode(t.pos.clone().setY(t.pos.y + 0.3), t.w.r, t.w.dmg, t.owner); if (this.state === 'retreat') this.endTurn(); }
    }
    if (this.state === 'retreat' && this.tnts.length === 0) this.endTurn();
    // ящики
    for (const c of this.crates) {
      if (c.gone) continue;
      if (c.falling) {
        c.pos.y -= 3 * dt;
        const g = w.groundAt(c.pos.x, c.pos.z);
        if (c.pos.y <= g) {
          c.pos.y = g; c.falling = false; if (c.chute) { c.obj.remove(c.chute); c.chute = null; }
          if (g < -0.3) { c.gone = true; this.scene.remove(c.obj); this.fx.splash(c.pos, 0.6); }
          else for (const o of this.foxes) if (o.alive && !o.vehicle) this.checkPickups(o);
        }
      } else {
        c.pos.y = Math.max(w.groundAt(c.pos.x, c.pos.z), -0.2);
        if (c.type === 'medal') c.obj.userData.spin.rotation.y += dt * 2;
      }
    }
    // дирижабли и самолёты
    for (let i = this.airships.length - 1; i >= 0; i--) {
      const a = this.airships[i]; a.life -= dt;
      a.obj.position.addScaledVector(a.dir, a.speed * dt);
      if (a.drops) for (const d of a.drops) if (!d.done && Math.sign(a.dir.x) * (a.obj.position.x - d.x) >= 0) {
        d.done = true;
        const x = clamp(a.obj.position.x, -60, 60), z = clamp(a.obj.position.z + rnd(-5, 5), -60, 60);
        this.spawnCrate(Math.random() < 0.35 ? 'health' : 'weapon', x, z, true);
      }
      if (a.life <= 0) { this.scene.remove(a.obj); this.airships.splice(i, 1); }
    }
    // флаг
    if (this.flag) MD.waveFlag(this.flag, this.t);
    // газ
    for (const g of this.gas) if (Math.random() < 0.08) this.fx.gasCloud(g.pos, g.r * 0.6);
  }

  /* ---------- камера ---------- */
  updCamera(dt) {
    const cam = this.camera, h = this.active, w = this.world;
    let pos, look, k = 3.5, fov = 55;
    const W = this.currentWeapon();
    if (this.state === 'intro') {
      const a = this.t * 0.25 + 0.6;
      pos = new THREE.Vector3(Math.sin(a) * 90, 50, Math.cos(a) * 90); look = new THREE.Vector3(0, 0, 0); k = 1.5;
    } else if (this.camMode === 'top') {
      const c = h ? h.pos : new THREE.Vector3();
      pos = new THREE.Vector3(c.x * 0.5, 95, c.z * 0.5 + 70); look = new THREE.Vector3(c.x * 0.5, 0, c.z * 0.5);
    } else if (this.state === 'over') {
      const winners = this.foxes.filter(o => o.alive), c = winners[0]?.pos || new THREE.Vector3();
      const a = this.t * 0.4; pos = c.clone().add(new THREE.Vector3(Math.sin(a) * 9, 5, Math.cos(a) * 9)); look = c.clone().setY(c.y + 1); k = 2;
    } else if (this.proj.some(p => p.cam) && (this.state === 'resolve' || this.state === 'retreat')) {
      const p = this.proj.find(q => q.cam);
      const v = p.vel.clone().setY(0); if (v.lengthSq() < 0.1) v.copy(fwd(h.yaw)); v.normalize();
      pos = p.pos.clone().addScaledVector(v, -11).add(new THREE.Vector3(0, 5, 0)); look = p.pos.clone(); k = 6;
    } else if ((this.state === 'resolve') && this.lastBoom && this.boomT > -1.5) {
      look = this.lastBoom.clone();
      const back = this.camPos.clone().sub(look).setY(0); if (back.lengthSq() < 1) back.set(0, 0, 1);
      pos = look.clone().add(back.normalize().multiplyScalar(16)).add(new THREE.Vector3(0, 9, 0)); k = 3;
    } else if (h) {
      const s = h.scale;
      if (W && W.kind === 'airstrike' && !h.vehicle && this.target) {
        const f = fwd(h.yaw);
        pos = this.target.clone().addScaledVector(f, -22).add(new THREE.Vector3(0, 38, 0)); look = this.target.clone(); k = 5;
      } else if (h.vehicle) {
        const v = h.vehicle, f = fwd(v.aimYaw);
        pos = v.pos.clone().addScaledVector(f, -9).add(new THREE.Vector3(0, 5 + v.pitch * 3, 0));
        look = v.pos.clone().add(new THREE.Vector3(0, 2, 0)).addScaledVector(aimDir(v.aimYaw, v.pitch), 12);
      } else if (this.scope) {
        const d = aimDir(h.yaw, h.pitch);
        pos = h.pos.clone().add(new THREE.Vector3(0, FOX_BODY.eye * s, 0)).addScaledVector(d, 0.35); look = pos.clone().addScaledVector(d, 20);
        fov = W === WEAPONS.sniper || W === WEAPONS.tranq ? 16 : 32; k = 30;
      } else {
        const f = fwd(h.yaw), aiming = this.charging || (W && h.ground && !h.moving);
        const right = new THREE.Vector3(-f.z, 0, f.x);
        const dist = aiming ? 6.4 : 8;
        pos = h.pos.clone().addScaledVector(f, -dist * s).add(new THREE.Vector3(0, (3.3 + Math.max(0, h.pitch) * 1.6) * s, 0)).addScaledVector(right, aiming ? -1.0 : 0);
        look = h.pos.clone().add(new THREE.Vector3(0, FOX_BODY.chest * s, 0)).addScaledVector(aimDir(h.yaw, h.pitch), 7);
        k = 5;
      }
    }
    if (!pos) return;
    // камера не уходит под землю
    const gh = w.getH(pos.x, pos.z);
    if (pos.y < gh + 1) pos.y = gh + 1;
    if (pos.y < 0.8) pos.y = 0.8;
    const a = 1 - Math.exp(-k * dt);
    this.camPos.lerp(pos, a); this.camLook.lerp(look, Math.min(1, a * 1.5));
    cam.position.copy(this.camPos);
    if (this.shake > 0.02) cam.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(this.shake * 0.6));
    cam.lookAt(this.camLook);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }
    const d = new THREE.Vector3(); cam.getWorldDirection(d); this.camYaw = Math.atan2(d.x, d.z);
  }
  updHelpers() {
    const h = this.active, W = this.currentWeapon();
    const show = h && h.alive && this.state === 'turn' && this.isHuman(h.team) && !this.scope;
    // кольцо под активным бойцом
    this.marker.visible = !!h && h.alive && (this.state === 'turn' || this.state === 'retreat') && !this.scope;
    if (h) {
      const p = h.vehicle ? h.vehicle.pos : h.pos, r = h.vehicle ? 3.2 : 1;
      this.marker.position.set(p.x, Math.max(p.y, this.world.groundAt(p.x, p.z)) + 0.06, p.z);
      this.marker.scale.setScalar(r * (1 + Math.sin(this.t * 3) * 0.04));
      this.marker.material.opacity = 0.55 + Math.sin(this.t * 3) * 0.2;
    }
    // точки прицела / траектория
    let n = 0;
    if (show && W && W.kind !== 'airstrike' && W.kind !== 'place' && W.kind !== 'selfheal' && W.kind !== 'jetpack' && W.kind !== 'hide') {
      const inVeh = !!h.vehicle;
      const origin = inVeh ? h.vehicle.muzzle() : h.muzzle();
      const yaw = inVeh ? h.vehicle.aimYaw : h.yaw, pitch = inVeh ? h.vehicle.pitch : h.pitch;
      const dir = aimDir(yaw, pitch);
      if (CHARGE_KINDS.has(W.kind) && this.settings.trajectory) {
        const pw = this.charging ? Math.max(0.12, this.power) : 0.6;
        const p = origin.clone(), v = dir.clone().multiplyScalar(W.speed * pw);
        for (let i = 0; i < 240 && n < this.aimDots.length; i++) {
          if (W.wind && this.cfg.wind) v.addScaledVector(this.wind, 1 / 60);
          v.y -= GRAV / 60; p.addScaledVector(v, 1 / 60);
          if (p.y < this.world.getH(p.x, p.z)) break;
          if (i % 6 === 0) { const d = this.aimDots[n++]; d.visible = true; d.position.copy(p); d.material.color.setHex(VFX.aimDot); d.scale.setScalar(0.07); }
        }
      } else {
        for (let i = 0; i < 8; i++) {
          const d = this.aimDots[n++]; d.visible = true; d.position.copy(origin).addScaledVector(dir, 0.8 + i * 0.9);
          const on = this.charging && i / 8 < this.power;
          d.material.color.setHex(on ? VFX.aimCharge : VFX.aimDot); d.scale.setScalar(on ? 0.1 : 0.05);
        }
      }
    }
    for (let i = n; i < this.aimDots.length; i++) this.aimDots[i].visible = false;
    if (!(W && W.kind === 'airstrike' && this.state === 'turn')) this.ring.visible = false;
  }
  render() { this.renderer.render(this.scene, this.camera); }
  dispose() {
    this.world.dispose();
    this.fx.clear();
    this.scene.traverse(o => { if (o.material && o.material.map && o.material.map !== MD.TEX.ground) { /* общие текстуры не трогаем */ } });
  }
}
