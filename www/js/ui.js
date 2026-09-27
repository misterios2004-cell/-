// Интерфейс: экраны меню, HUD, управление, кампания.
import { THREE, clamp, pick, Sound, Save, DEFAULT_SETTINGS } from './core.js';
import { NATIONS, PLAYABLE_NATIONS, RANKS, LINES, WEAPONS, CATS, MISSIONS, REGIONS, REGION_BONUS, THEMES, INF } from './data.js';
import * as MD from './models.js';
import { Battle, aimDir } from './battle.js';
import { weaponIcon } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TERRAIN_NAMES = { hills: 'Холмы', trenches: 'Окопы', plateau: 'Плато', islands: 'Острова', river: 'Река', valley: 'Долина', canyon: 'Ущелье', dunes: 'Дюны', island: 'Остров' };
const OBJ_TEXT = { elim: 'Уничтожить противника', boss: 'Уничтожить командира', reach: 'Дойти до флага и закончить там ход', survive: 'Продержаться N раундов' };
const DIFF = { easy: { name: 'Новобранец', k: 1.6 }, normal: { name: 'Сержант', k: 1 }, hard: { name: 'Генерал', k: 0.6 } };
const portraitCache = new Map();
function portrait(nation, rank) {
  const key = nation + rank;
  if (!portraitCache.has(key)) portraitCache.set(key, MD.renderPortrait(NATIONS[nation], rank, RANKS[rank].line, 160));
  return portraitCache.get(key);
}

export const UI = {
  renderer: null, battle: null, demo: null, screen: null, touch: false,
  init(renderer) {
    this.renderer = renderer;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.touch);
    this.scr = $('#screen'); this.hud = $('#hud'); this.labels = $('#labels');
    this.bindHud(); this.bindInput();
    this.startDemo();
    this.title();
    Sound.init(); // контекст будет разблокирован первым касанием
    const unlock = () => { Sound.init(); if (!Sound.musicOn && !this.battle) Sound.startMusic('menu'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    // кнопка «назад» на Android
    const Cap = window.Capacitor;
    if (Cap?.isNativePlatform?.()) {
      try {
        const App = Cap.registerPlugin('App');
        App.addListener('backButton', () => {
          if (!$('#inv').hidden) this.closeInventory();
          else if (this.battle && !this.battle.over) this.pause(!this.battle.paused);
          else if (this.screen !== 'title') this.title();
          else App.exitApp();
        });
        App.addListener('pause', () => { if (this.battle && !this.battle.over && !this.battle.paused) this.pause(true); Sound.ctx?.suspend(); });
        App.addListener('resume', () => { Sound.ctx?.resume(); });
      } catch (e) { /* плагин недоступен */ }
    }
  },
  quality() {
    const q = Save.data.settings.quality;
    return q === 'auto' ? (this.touch ? 'medium' : 'high') : q;
  },

  /* ================= кадр ================= */
  frame(dt) {
    const b = this.battle || this.demo;
    if (!b) return;
    const steps = Math.min(6, Math.round(dt * 60) || 1);
    for (let i = 0; i < steps; i++) b.update(1 / 60);
    b.render();
    if (this.battle) this.updateHud();
  },
  resize(w, h) {
    for (const b of [this.battle, this.demo]) if (b) { b.camera.aspect = w / h; b.camera.updateProjectionMatrix(); }
  },

  /* ================= экраны ================= */
  show(name, html) {
    this.screen = name;
    this.scr.innerHTML = html;
    this.scr.hidden = !html;
    this.scr.className = 'scr-' + name;
    $$('[data-go]', this.scr).forEach(b => b.addEventListener('click', () => { Sound.play('click'); this[b.dataset.go](); }));
    const first = $('.btn, button', this.scr); if (first && !this.touch) first.focus({ preventScroll: true });
  },
  title() {
    this.stopBattle();
    if (!this.demo) this.startDemo();
    const c = Save.data.campaign;
    const next = c ? MISSIONS.find(m => !c.done[m.id]) : null;
    this.show('title', `
      <div class="titleWrap">
        <h1 class="logo">Свиньи<br>в&nbsp;<span>окопах</span></h1>
        <p class="tag">Пошаговая война свиных армий: звания и повышения, инвентарь, техника, 13 операций кампании.</p>
        <nav class="menu">
          ${c ? `<button class="btn big" data-go="map">Продолжить кампанию<small>${esc(NATIONS[c.nation].name)} · ${next ? 'операция ' + next.id : 'кампания пройдена'}</small></button>` : ''}
          <button class="btn ${c ? '' : 'big'}" data-go="newCampaign">Новая кампания</button>
          <button class="btn" data-go="skirmish">Схватка</button>
          ${c ? '<button class="btn" data-go="barracks">Казарма</button>' : ''}
          <button class="btn" data-go="settings">Настройки</button>
          <button class="btn" data-go="help">Как играть</button>
        </nav>
      </div>
      <p class="credit">Фанатская игра по мотивам Hogs of War (Infogrames, 2000). Не связана с правообладателями.</p>`);
  },

  /* ---------- новая кампания ---------- */
  newCampaign() {
    let nation = 'uk', diff = 'normal', confirmReset = !Save.data.campaign;
    const render = () => {
      const n = NATIONS[nation];
      this.show('newCampaign', `
        <div class="card wide">
          <div class="eyebrow">Новая кампания</div>
          <h2>Выберите армию</h2>
          <div class="nations">${PLAYABLE_NATIONS.map(id => `<button class="nation ${id === nation ? 'on' : ''}" data-n="${id}" style="--c:${NATIONS[id].css}"><img src="${portrait(id, 'grunt')}" alt=""><b>${esc(NATIONS[id].name)}</b></button>`).join('')}</div>
          <div class="cols">
            <fieldset><legend>Имена бойцов</legend><div class="names">${n.names.slice(0, 6).map((nm, i) => `<input id="nm${i}" maxlength="16" value="${esc(nm)}" aria-label="Имя бойца ${i + 1}">`).join('')}</div></fieldset>
            <fieldset><legend>Сложность</legend><div class="seg">${Object.entries(DIFF).map(([k, d]) => `<label><input type="radio" name="diff" value="${k}" ${k === diff ? 'checked' : ''}><span>${d.name}</span></label>`).join('')}</div>
              <p class="note">Сложность влияет на меткость противника.</p></fieldset>
          </div>
          ${Save.data.campaign ? `<p class="warnline">Текущая кампания (${esc(NATIONS[Save.data.campaign.nation].name)}) будет перезаписана.</p>` : ''}
          <div class="row"><button class="btn big" id="go">${confirmReset ? 'Начать кампанию' : 'Да, начать заново'}</button><button class="btn" data-go="title">Назад</button></div>
        </div>`);
      $$('.nation', this.scr).forEach(b => b.addEventListener('click', () => { nation = b.dataset.n; Sound.play('click'); render(); }));
      $$('input[name=diff]', this.scr).forEach(r => r.addEventListener('change', () => { diff = r.value; }));
      $('#go', this.scr).addEventListener('click', () => {
        if (!confirmReset) { confirmReset = true; render(); return; }
        const names = $$('.names input', this.scr).map((i, k) => i.value.trim() || n.names[k]);
        Save.data.campaign = { nation, diff, pp: 0, done: {}, roster: names.map((nm, i) => ({ id: i, name: nm, rank: 'grunt', kills: 0, missions: 0 })) };
        Save.write(); Sound.play('medal'); this.map();
      });
    };
    render();
  },

  /* ---------- карта кампании ---------- */
  map() {
    const c = Save.data.campaign; if (!c) return this.newCampaign();
    this.stopBattle(); if (!this.demo) this.startDemo();
    const avail = m => m.id === 1 || c.done[m.id - 1];
    const pos = {};
    // регионы расположены слева направо, миссии — по три в регионе
    REGIONS.forEach((r, ri) => {
      const ms = MISSIONS.filter(m => m.region === r.id);
      ms.forEach((m, k) => { pos[m.id] = { x: 90 + ri * 190 + (k - (ms.length - 1) / 2) * 52, y: 190 + (k % 2 ? -46 : 40) + (ri % 2 ? 30 : -10) }; });
    });
    const path = MISSIONS.map(m => `${pos[m.id].x},${pos[m.id].y}`).join(' ');
    const regionColors = { farm: '#6f8a3c', swamp: '#4f5f3a', snow: '#c9d3dc', desert: '#d8b878', lard: '#6b4a78' };
    const svg = `<svg viewBox="0 0 1000 380" class="campmap" role="img" aria-label="Карта кампании">
      <rect x="0" y="0" width="1000" height="380" fill="#35505a" rx="8"/>
      ${REGIONS.map((r, ri) => `<g><ellipse cx="${90 + ri * 190}" cy="${190 + (ri % 2 ? 30 : -10)}" rx="100" ry="120" fill="${regionColors[r.theme]}" stroke="#241a11" stroke-width="3"/>
        <text x="${90 + ri * 190}" y="${56 + (ri % 2 ? 30 : -10)}" text-anchor="middle" class="mapRegion">${esc(r.name)}</text></g>`).join('')}
      <polyline points="${path}" fill="none" stroke="#241a11" stroke-width="4" stroke-dasharray="8 7"/>
      ${MISSIONS.map(m => { const p = pos[m.id], st = c.done[m.id] ? 'done' : avail(m) ? 'open' : 'locked';
        return `<g class="node ${st}" data-m="${m.id}" tabindex="${st === 'locked' ? -1 : 0}" role="button" aria-label="Операция ${m.id}: ${esc(m.name)}">
          <circle cx="${p.x}" cy="${p.y}" r="22"/><text x="${p.x}" y="${p.y + 6}" text-anchor="middle">${c.done[m.id] ? '✓' : m.id}</text></g>`; }).join('')}
    </svg>`;
    this.show('map', `
      <div class="card wide mapcard">
        <div class="bar"><div><div class="eyebrow">${esc(NATIONS[c.nation].name)} · ${DIFF[c.diff].name}</div><h2>Карта кампании</h2></div>
          <div class="chips"><span class="chip gold">Очки повышения: <b>${c.pp}</b></span><button class="btn" data-go="barracks">Казарма</button><button class="btn" data-go="title">Меню</button></div></div>
        <div class="mapscroll">${svg}</div>
        <ol class="mlist">${MISSIONS.map(m => `<li class="${c.done[m.id] ? 'done' : avail(m) ? 'open' : 'locked'}"><button data-m="${m.id}" ${avail(m) ? '' : 'disabled'}><b>${m.id}. ${esc(m.name)}</b><small>${esc(REGIONS.find(r => r.id === m.region).name)}${c.done[m.id] ? ' · пройдена' : ''}</small></button></li>`).join('')}</ol>
      </div>`);
    const open = id => { const m = MISSIONS.find(x => x.id === +id); if (m && avail(m)) { Sound.play('click'); this.brief(m); } };
    $$('[data-m]', this.scr).forEach(el => { el.addEventListener('click', () => open(el.dataset.m)); el.addEventListener('keydown', e => { if (e.key === 'Enter') open(el.dataset.m); }); });
  },

  /* ---------- брифинг и выбор отряда ---------- */
  brief(m) {
    const c = Save.data.campaign, region = REGIONS.find(r => r.id === m.region);
    const size = Math.min(m.squad, c.roster.length);
    const sorted = [...c.roster].sort((a, b) => RANKS[b.rank].level - RANKS[a.rank].level || RANKS[b.rank].hp - RANKS[a.rank].hp);
    let chosen = new Set(sorted.slice(0, size).map(r => r.id));
    const counts = {}; m.enemies.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    if (m.reinforce) m.reinforce.ranks.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    const enemyNation = this.enemyNation(m);
    const obj = m.objective.type === 'survive' ? `Продержаться ${m.objective.rounds} раундов` : OBJ_TEXT[m.objective.type];
    const structs = (m.structures || []).map(s => ({ pillbox: 'дот', tank: 'танк', artillery: 'гаубица' }[s.type] + (s.side ? ' противника' : ' (наш)'))).join(', ');
    const render = () => {
      this.show('brief', `
        <div class="card wide">
          <div class="eyebrow">Операция ${m.id} · ${esc(region.name)}</div>
          <h2>${esc(m.name)}</h2>
          <p class="lead">${esc(m.brief)}</p>
          <div class="facts">
            <div><small>Задача</small><b>${esc(obj)}</b></div>
            <div><small>Противник</small><b>${esc(NATIONS[enemyNation].name)}</b></div>
            <div><small>Местность</small><b>${THEMES[region.theme].name}, ${TERRAIN_NAMES[m.terrain].toLowerCase()}</b></div>
            <div><small>Время хода</small><b>${m.turnTime} с</b></div>
          </div>
          <div class="enemies"><small>Силы противника:</small> ${Object.entries(counts).map(([r, n]) => `<span class="chip">${RANKS[r].name}${n > 1 ? ' ×' + n : ''}</span>`).join('')}${structs ? `<span class="chip">Техника: ${structs}</span>` : ''}${m.medals ? `<span class="chip gold">Медалей на карте: ${m.medals}</span>` : ''}</div>
          <h3>Отряд: ${chosen.size} из ${size}</h3>
          <div class="roster">${c.roster.map(r => `<button class="hogcard ${chosen.has(r.id) ? 'on' : ''}" data-id="${r.id}" aria-pressed="${chosen.has(r.id)}">
              <img src="${portrait(c.nation, r.rank)}" alt=""><b>${esc(r.name)}</b><small>${RANKS[r.rank].name} · ${RANKS[r.rank].hp} HP</small></button>`).join('')}</div>
          <div class="row"><button class="btn big" id="go" ${chosen.size ? '' : 'disabled'}>В бой</button><button class="btn" data-go="barracks">Казарма</button><button class="btn" data-go="map">К карте</button></div>
        </div>`);
      $$('.hogcard', this.scr).forEach(b => b.addEventListener('click', () => {
        const id = +b.dataset.id;
        if (chosen.has(id)) chosen.delete(id); else if (chosen.size < size) chosen.add(id); else return;
        Sound.play('click'); render();
      }));
      $('#go', this.scr).addEventListener('click', () => this.startCampaign(m, [...chosen]));
    };
    render();
  },
  enemyNation(m) {
    const c = Save.data.campaign;
    if (m.enemy !== c.nation) return m.enemy;
    return PLAYABLE_NATIONS.find(n => n !== c.nation && n !== 'lard') || 'fr';
  },
  startCampaign(m, ids) {
    const c = Save.data.campaign, region = REGIONS.find(r => r.id === m.region);
    const en = this.enemyNation(m), names = [...NATIONS[en].names].sort(() => Math.random() - 0.5);
    const cfg = {
      mode: 'campaign', mission: m, missionId: m.id, turnTime: m.turnTime, wind: Save.data.settings.wind, crates: true, quality: this.quality(),
      map: { theme: region.theme, terrain: m.terrain, seed: m.seed, props: m.props },
      teams: [
        { nation: c.nation, control: 'human', hogs: ids.map(id => { const r = c.roster.find(x => x.id === id); return { name: r.name, rank: r.rank, rosterId: id }; }) },
        { nation: en, control: 'ai', ai: m.ai * DIFF[c.diff].k, hogs: m.enemies.map((r, i) => ({ name: m.boss === i ? 'Комендант ' + names[i] : names[i % names.length], rank: r, boss: m.boss === i })) },
      ],
    };
    this.startBattle(cfg);
  },

  /* ---------- казарма и повышения ---------- */
  barracks(selId) {
    const c = Save.data.campaign; if (!c) return this.title();
    let sel = selId ?? c.roster[0].id;
    const render = () => {
      const r = c.roster.find(x => x.id === sel), rk = RANKS[r.rank];
      const loadList = Object.entries(rk.load).map(([w, n]) => `<li>${weaponIcon(w)}<span>${WEAPONS[w].name}</span><em>${n === INF ? '∞' : '×' + n}</em></li>`).join('');
      const promos = rk.next.map(nx => {
        const R = RANKS[nx], gain = Object.keys(R.load).filter(w => !rk.load[w]);
        return `<div class="promo" style="--c:${LINES[R.line].color}"><div><b>${R.name}</b><small>${LINES[R.line].name} · ${R.hp} HP</small>
          <p>${gain.length ? 'Новое: ' + gain.map(w => WEAPONS[w].name).join(', ') : 'Больше здоровья и боезапаса'}</p></div>
          <button class="btn" data-promo="${nx}" ${c.pp >= R.cost ? '' : 'disabled'}>Повысить · ${R.cost} оч.</button></div>`;
      }).join('');
      this.show('barracks', `
        <div class="card wide">
          <div class="bar"><div><div class="eyebrow">${esc(NATIONS[c.nation].name)}</div><h2>Казарма</h2></div>
            <div class="chips"><span class="chip gold">Очки повышения: <b>${c.pp}</b></span><button class="btn" data-go="map">К карте</button></div></div>
          <div class="barracks">
            <div class="roster tall">${c.roster.map(x => `<button class="hogcard ${x.id === sel ? 'on' : ''}" data-id="${x.id}"><img src="${portrait(c.nation, x.rank)}" alt=""><b>${esc(x.name)}</b><small>${RANKS[x.rank].name}</small></button>`).join('')}</div>
            <div class="detail">
              <div class="dhead"><img src="${portrait(c.nation, r.rank)}" alt="">
                <div><input id="rename" maxlength="16" value="${esc(r.name)}" aria-label="Имя бойца"><div class="rank" style="--c:${LINES[rk.line].color}">${rk.name} · ${LINES[rk.line].name}</div>
                <div class="stats"><span>${rk.hp} HP</span><span>Побед: ${r.kills}</span><span>Операций: ${r.missions}</span></div></div></div>
              <h3>Снаряжение</h3><ul class="load">${loadList}</ul>
              <h3>Повышение</h3>${promos || '<p class="note">Высшее звание. Дальше расти некуда.</p>'}
            </div>
          </div>
          <details class="tree"><summary>Все ветки званий</summary>${this.treeHtml(r.rank)}</details>
        </div>`);
      $$('.hogcard', this.scr).forEach(b => b.addEventListener('click', () => { sel = +b.dataset.id; Sound.play('click'); render(); }));
      $('#rename', this.scr).addEventListener('change', e => { r.name = e.target.value.trim() || r.name; Save.write(); });
      $$('[data-promo]', this.scr).forEach(b => b.addEventListener('click', () => {
        const nx = b.dataset.promo, cost = RANKS[nx].cost; if (c.pp < cost) return;
        c.pp -= cost; r.rank = nx; Save.write(); Sound.play('medal'); this.toast(`${r.name} теперь ${RANKS[nx].name}!`); render();
      }));
    };
    render();
  },
  treeHtml(cur) {
    const col = (ids) => ids.map(id => `<span class="${id === cur ? 'cur' : ''}">${RANKS[id].name} <small>${RANKS[id].hp} HP · ${RANKS[id].cost} оч.</small></span>`).join('<i>→</i>');
    return `<div class="treeRows">
      <div><span class="${cur === 'grunt' ? 'cur' : ''}">Рядовой <small>50 HP</small></span></div>
      ${['heavy', 'eng', 'spy', 'medic'].map(l => `<div style="--c:${LINES[l].color}"><em>${LINES[l].name}</em>${col(Object.keys(RANKS).filter(k => RANKS[k].line === l).sort((a, b) => RANKS[a].level - RANKS[b].level))}</div>`).join('')}
      <div style="--c:${LINES.officer.color}"><em>Офицеры (после 3-й ступени любой ветки)</em>${col(['commando', 'hero'])}</div></div>`;
  },

  /* ---------- схватка ---------- */
  skirmish() {
    const st = this.skirmState || (this.skirmState = {
      teams: [{ nation: 'uk', control: 'human', n: 4 }, { nation: 'de', control: 'normal', n: 4 }],
      ranks: 'mixed', theme: 'farm', terrain: 'hills', turn: Save.data.settings.turnTime, wind: Save.data.settings.wind, crates: true, vehicles: 'none',
    });
    const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
    const render = () => {
      this.show('skirmish', `
        <div class="card wide">
          <div class="eyebrow">Схватка</div><h2>Настройка боя</h2>
          <div class="teams">${st.teams.map((t, i) => `<div class="teamrow" style="--c:${NATIONS[t.nation].css}">
            <b>Команда ${i + 1}</b>
            <select data-t="${i}" data-k="nation" aria-label="Армия">${PLAYABLE_NATIONS.map(n => opt(n, t.nation, NATIONS[n].name)).join('')}${opt('lard', t.nation, NATIONS.lard.name)}</select>
            <select data-t="${i}" data-k="control" aria-label="Кто управляет">${opt('human', t.control, 'Игрок')}${opt('easy', t.control, 'ИИ: новобранец')}${opt('normal', t.control, 'ИИ: сержант')}${opt('hard', t.control, 'ИИ: генерал')}</select>
            <select data-t="${i}" data-k="n" aria-label="Свиней">${[2, 3, 4, 5, 6].map(n => opt(n, t.n, n + ' свин.')).join('')}</select>
            ${st.teams.length > 2 ? `<button class="btn small" data-del="${i}" aria-label="Убрать команду">✕</button>` : ''}</div>`).join('')}
            ${st.teams.length < 4 ? '<button class="btn small" id="addTeam">+ Команда</button>' : ''}</div>
          <div class="grid2">
            <label>Звания<select id="s-ranks">${opt('grunt', st.ranks, 'Только рядовые')}${opt('mixed', st.ranks, 'Смешанные')}${opt('veteran', st.ranks, 'Ветераны')}${opt('elite', st.ranks, 'Элита')}</select></label>
            <label>Местность<select id="s-theme">${Object.entries(THEMES).map(([k, t]) => opt(k, st.theme, t.name)).join('')}</select></label>
            <label>Рельеф<select id="s-terrain">${Object.entries(TERRAIN_NAMES).map(([k, n]) => opt(k, st.terrain, n)).join('')}</select></label>
            <label>Время хода<select id="s-turn">${[30, 45, 60, 90].map(n => opt(n, +st.turn, n + ' с')).join('')}</select></label>
            <label>Техника<select id="s-veh">${opt('none', st.vehicles, 'Нет')}${opt('pillbox', st.vehicles, 'Доты')}${opt('tank', st.vehicles, 'Танки')}${opt('artillery', st.vehicles, 'Гаубицы')}</select></label>
            <label class="check"><input type="checkbox" id="s-wind" ${st.wind ? 'checked' : ''}> Ветер</label>
            <label class="check"><input type="checkbox" id="s-crates" ${st.crates ? 'checked' : ''}> Ящики и дирижабли</label>
          </div>
          <div class="row"><button class="btn big" id="go">В бой</button><button class="btn" data-go="title">Назад</button></div>
        </div>`);
      $$('select[data-t]', this.scr).forEach(s => s.addEventListener('change', () => { const t = st.teams[+s.dataset.t]; t[s.dataset.k] = s.dataset.k === 'n' ? +s.value : s.value; render(); }));
      $$('[data-del]', this.scr).forEach(b => b.addEventListener('click', () => { st.teams.splice(+b.dataset.del, 1); render(); }));
      $('#addTeam', this.scr)?.addEventListener('click', () => { const used = st.teams.map(t => t.nation); st.teams.push({ nation: PLAYABLE_NATIONS.find(n => !used.includes(n)), control: 'normal', n: 4 }); render(); });
      const bindSel = (id, k, num) => $(id, this.scr).addEventListener('change', e => { st[k] = num ? +e.target.value : e.target.value; });
      bindSel('#s-ranks', 'ranks'); bindSel('#s-theme', 'theme'); bindSel('#s-terrain', 'terrain'); bindSel('#s-turn', 'turn', true); bindSel('#s-veh', 'vehicles');
      $('#s-wind', this.scr).addEventListener('change', e => { st.wind = e.target.checked; });
      $('#s-crates', this.scr).addEventListener('change', e => { st.crates = e.target.checked; });
      $('#go', this.scr).addEventListener('click', () => this.startSkirmish(st));
    };
    render();
  },
  rankPreset(p) {
    const lv1 = ['gunner', 'sapper', 'scout', 'orderly'], lv2 = ['bombardier', 'engineer', 'sniper', 'medic'], lv3 = ['pyrotech', 'saboteur', 'spy', 'surgeon'];
    if (p === 'grunt') return 'grunt';
    if (p === 'mixed') return pick(['grunt', 'grunt', ...lv1]);
    if (p === 'veteran') return pick([...lv1, ...lv2, ...lv2]);
    return pick([...lv3, 'commando', 'hero']);
  },
  startSkirmish(st, seed) {
    const ctl = { easy: 2.2, normal: 1.3, hard: 0.5 };
    const structures = [];
    if (st.vehicles !== 'none') st.teams.slice(0, 2).forEach((t, i) => structures.push({ type: st.vehicles, side: i }));
    const cfg = {
      mode: 'skirmish', turnTime: st.turn, wind: st.wind, crates: st.crates, quality: this.quality(),
      mission: { structures, props: { houses: 3, sandbags: 6, fences: 4, crates: st.crates ? 4 : 0, barrels: 5, wire: st.terrain === 'trenches' ? 6 : 2, bridges: 3, mill: st.theme === 'farm' ? 1 : 0 }, objective: { type: 'elim' } },
      map: { theme: st.theme, terrain: st.terrain, seed: seed ?? (Math.random() * 1e9 | 0), props: { houses: 3, sandbags: 6, fences: 4, wire: st.terrain === 'trenches' ? 6 : 2, bridges: 3, mill: st.theme === 'farm' ? 1 : 0 } },
      teams: st.teams.map(t => {
        const names = [...NATIONS[t.nation].names].sort(() => Math.random() - 0.5);
        return { nation: t.nation, control: t.control === 'human' ? 'human' : 'ai', ai: ctl[t.control] ?? 1.3, hogs: Array.from({ length: t.n }, (_, i) => ({ name: names[i % names.length], rank: this.rankPreset(st.ranks) })) };
      }),
    };
    this.lastSkirm = st;
    this.startBattle(cfg);
  },

  /* ---------- настройки ---------- */
  settings(back = 'title') {
    const s = Save.data.settings;
    let resetArmed = false;
    const render = () => {
      this.show('settings', `
        <div class="card">
          <div class="eyebrow">Настройки</div><h2>Параметры</h2>
          <fieldset><legend>Графика</legend><div class="seg">${[['auto', 'Авто'], ['low', 'Низкая'], ['medium', 'Средняя'], ['high', 'Высокая']].map(([k, n]) => `<label><input type="radio" name="q" value="${k}" ${s.quality === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
            <p class="note">Тени и дальность прорисовки. Применяется со следующего боя.</p></fieldset>
          <label class="slider">Звуки<input type="range" id="sfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
          <label class="slider">Музыка<input type="range" id="music" min="0" max="1" step="0.05" value="${s.music}"></label>
          <label class="slider">Чувствительность прицела<input type="range" id="sens" min="0.4" max="2" step="0.1" value="${s.sens}"></label>
          <label class="check"><input type="checkbox" id="traj" ${s.trajectory ? 'checked' : ''}> Показывать траекторию навесного огня (подсказка)</label>
          <label class="check"><input type="checkbox" id="wind" ${s.wind ? 'checked' : ''}> Ветер в кампании</label>
          <label class="check"><input type="checkbox" id="voice" ${s.voice ? 'checked' : ''}> Голос комментатора (синтез речи устройства)</label>
          <div class="row"><button class="btn" id="back">Готово</button><button class="btn danger" id="reset">${resetArmed ? 'Точно стереть прогресс?' : 'Сбросить прогресс'}</button></div>
        </div>`);
      $$('input[name=q]', this.scr).forEach(r => r.addEventListener('change', () => { s.quality = r.value; Save.write(); }));
      for (const k of ['sfx', 'music', 'sens']) $('#' + k, this.scr).addEventListener('input', e => { s[k] = +e.target.value; Sound.apply(); Save.write(); });
      $('#traj', this.scr).addEventListener('change', e => { s.trajectory = e.target.checked; Save.write(); });
      $('#wind', this.scr).addEventListener('change', e => { s.wind = e.target.checked; Save.write(); });
      $('#voice', this.scr).addEventListener('change', e => { s.voice = e.target.checked; Save.write(); });
      $('#back', this.scr).addEventListener('click', () => back === 'pause' ? this.pause(true) : this.title());
      $('#reset', this.scr).addEventListener('click', () => {
        if (!resetArmed) { resetArmed = true; render(); return; }
        Save.data.campaign = null; Save.data.settings = { ...DEFAULT_SETTINGS }; Save.write(); this.toast('Прогресс стёрт'); this.title();
      });
    };
    render();
  },
  help() {
    this.show('help', `
      <div class="card wide">
        <div class="eyebrow">Наставление бойцу</div><h2>Как играть</h2>
        <div class="helpcols">
          <div>
            <h3>Ход</h3>
            <p>Армии ходят по очереди, за ход действует одна свинья. Пока идёт время хода, свинья может бегать, прыгать, плавать, подбирать ящики и садиться в технику. Выстрел заканчивает ход; лечение руками, самолечение, аптечка, ранец и карманная кража — нет.</p>
            <p>Стрелять можно только стоя на земле: не в прыжке и не в воде. Сила броска и выстрела из базуки, миномёта и гранат зависит от того, сколько держать «Огонь».</p>
            <h3>Звания</h3>
            <p>Все начинают рядовыми. За операции дают очки повышения: 1 за победу, 1 если все выжили, по 1 за найденную медаль и ${REGION_BONUS} за освобождённый регион. В казарме очки тратятся на повышение по одной из четырёх веток. После третьей ступени любая ветка ведёт в Коммандо, затем в Героя.</p>
            <h3>Опасности</h3>
            <p>Зелёная вода отравляет. Отравление, как и горение, отнимает здоровье каждый ход, пока свинью не вылечат. Колючая проволока ранит и замедляет. Мины взрываются через секунду после того, как рядом прошла свинья. Красные бочки взрываются.</p>
          </div>
          <div>
            <h3>Клавиатура и мышь</h3>
            <table class="keys">
              <tr><td><kbd>W</kbd> <kbd>S</kbd></td><td>вперёд / назад</td></tr>
              <tr><td><kbd>A</kbd> <kbd>D</kbd> <kbd>←</kbd> <kbd>→</kbd></td><td>поворот</td></tr>
              <tr><td><kbd>↑</kbd> <kbd>↓</kbd>, колесо, перетаскивание</td><td>наводка</td></tr>
              <tr><td><kbd>Shift</kbd></td><td>бег (тратит выносливость)</td></tr>
              <tr><td><kbd>Пробел</kbd></td><td>огонь: зажать и отпустить</td></tr>
              <tr><td><kbd>Enter</kbd></td><td>прыжок; с ранцем — удерживать</td></tr>
              <tr><td><kbd>Tab</kbd> / <kbd>I</kbd></td><td>инвентарь; <kbd>1</kbd>–<kbd>9</kbd> быстрый выбор</td></tr>
              <tr><td><kbd>F</kbd></td><td>сесть в технику / выйти</td></tr>
              <tr><td><kbd>V</kbd></td><td>оптический прицел</td></tr>
              <tr><td><kbd>C</kbd></td><td>обзор карты</td></tr>
              <tr><td><kbd>Backspace</kbd></td><td>пропустить ход</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>пауза</td></tr>
            </table>
            <h3>Сенсорный экран</h3>
            <p>Джойстик слева — ходьба и повороты. Проведите пальцем по полю — наводка. Кнопки справа: огонь (удерживать), прыжок, бег, техника. Для авиаудара коснитесь точки на карте.</p>
          </div>
        </div>
        <div class="row"><button class="btn" data-go="title">Назад</button></div>
      </div>`);
  },

  /* ================= бой ================= */
  startDemo() {
    const nations = [...PLAYABLE_NATIONS].sort(() => Math.random() - 0.5);
    const theme = pick(['farm', 'snow', 'desert', 'farm']);
    const cfg = {
      mode: 'demo', turnTime: 18, wind: false, crates: true, quality: this.quality() === 'high' ? 'medium' : this.quality(),
      mission: { props: { houses: 2, sandbags: 4, fences: 3, crates: 3, barrels: 4 }, structures: [{ type: 'pillbox', side: 1 }] },
      map: { theme, terrain: pick(['hills', 'plateau', 'trenches']), seed: Math.random() * 1e9 | 0, props: { houses: 2, sandbags: 4, fences: 3, mill: theme === 'farm' ? 1 : 0 } },
      teams: nations.slice(0, 2).map(n => ({ nation: n, control: 'ai', ai: 1.2, hogs: Array.from({ length: 3 }, () => ({ name: pick(NATIONS[n].names), rank: this.rankPreset('mixed') })) })),
    };
    this.demo = new Battle(this.renderer, cfg, { end: () => { setTimeout(() => { if (this.demo && !this.battle) { this.demo.dispose(); this.demo = null; this.startDemo(); } }, 3000); } });
    this.demo.introT = 1;
    const c = this.renderer.domElement; this.resize(c.clientWidth, c.clientHeight);
  },
  startBattle(cfg) {
    if (this.demo) { this.demo.dispose(); this.demo = null; }
    this.stopBattle();
    this.lastCfg = cfg;
    Sound.init(); Sound.stopMusic();
    this.show('none', '');
    this.hud.hidden = false; this.labels.innerHTML = ''; this.labelEls = new Map();
    this.feed = [];
    const b = this.battle = new Battle(this.renderer, cfg, {
      message: (t, k) => this.pushFeed(t, k),
      turn: h => this.onTurn(h),
      update: () => this.refreshWeapon(),
      round: r => { if (r > 1) this.pushFeed(`Раунд ${r}`, 'round'); if (cfg.mission?.objective?.type === 'survive') this.pushFeed(`До заката: ${Math.max(0, cfg.mission.objective.rounds - r + 1)} раунд.`, 'good'); },
      end: res => this.results(res),
    });
    const c = this.renderer.domElement; this.resize(c.clientWidth, c.clientHeight);
    this.buildTeamsHud();
    this.refreshWeapon();
    if (cfg.mission?.tips) cfg.mission.tips.forEach((t, i) => setTimeout(() => this.pushFeed('Совет: ' + t, 'tip'), 3500 + i * 6000));
    Sound.startMusic('march');
    void b;
  },
  stopBattle() {
    if (this.battle) { this.battle.dispose(); this.battle = null; }
    this.hud.hidden = true; this.labels.innerHTML = ''; $('#scope').hidden = true; $('#inv').hidden = true;
    for (const k in this.keys) this.keys[k] = false;
    Sound.stopMusic();
  },
  pause(on) {
    const b = this.battle; if (!b || b.over) return;
    b.paused = on;
    if (!on) { this.show('none', ''); return; }
    this.show('pause', `<div class="card"><h2>Пауза</h2><div class="row col">
      <button class="btn big" id="res">Продолжить</button><button class="btn" id="restart">Начать бой заново</button>
      <button class="btn" id="set">Настройки</button><button class="btn danger" id="quit">${b.cfg.mode === 'campaign' ? 'Отступить на карту' : 'Выйти в меню'}</button></div></div>`);
    $('#res', this.scr).addEventListener('click', () => this.pause(false));
    $('#restart', this.scr).addEventListener('click', () => this.startBattle(this.lastCfg));
    $('#set', this.scr).addEventListener('click', () => this.settings('pause'));
    $('#quit', this.scr).addEventListener('click', () => { const camp = b.cfg.mode === 'campaign'; this.stopBattle(); camp ? this.map() : this.title(); });
  },
  results(res) {
    const b = this.battle; if (!b || b.result !== res) return;
    const cfg = b.cfg;
    const rows = res.hogs.filter(h => cfg.mode !== 'campaign' || h.team === 0).map(h => `<tr><td>${esc(h.name)}</td><td>${h.kills}</td><td>${h.dmg}</td><td>${h.alive ? 'в строю' : 'пал'}</td></tr>`).join('');
    let extra = '', buttons = '';
    if (cfg.mode === 'campaign') {
      const c = Save.data.campaign, m = cfg.mission, first = !c.done[m.id];
      if (res.playerWon) {
        const lastInRegion = MISSIONS.filter(x => x.region === m.region).pop().id === m.id;
        const parts = first ? [['Операция выполнена', 1], ['Все выжили', res.allSurvived ? 1 : 0], ['Медали', res.medals], ['Регион освобождён', lastInRegion ? REGION_BONUS : 0]] : [['Повторное прохождение', 0], ['Медали', 0]];
        const total = parts.reduce((s, p) => s + p[1], 0);
        c.pp += total; c.done[m.id] = true;
        extra = `<div class="pp">${parts.map(p => `<span>${p[0]}<b>+${p[1]}</b></span>`).join('')}<span class="tot">Итого очков<b>+${total}</b></span></div>`;
        buttons = `<button class="btn big" id="next">${MISSIONS.find(x => x.id === m.id + 1) ? 'К следующей операции' : 'Кампания пройдена!'}</button><button class="btn" id="bar">Казарма</button>`;
      } else buttons = `<button class="btn big" id="again">Ещё раз</button>`;
      for (const h of res.hogs) if (h.team === 0 && h.rosterId != null) { const r = c.roster.find(x => x.id === h.rosterId); if (r) { r.kills += h.kills; r.missions++; } }
      Save.write();
      buttons += `<button class="btn" id="tomap">К карте</button>`;
    } else buttons = `<button class="btn big" id="rematch">Реванш</button><button class="btn" id="setup">Настроить бой</button><button class="btn" data-go="title">Меню</button>`;
    const won = res.playerWon || (cfg.mode !== 'campaign' && res.winner >= 0 && b.teams[res.winner].control === 'human');
    this.hud.hidden = true;
    this.show('results', `<div class="card">
      <div class="eyebrow">${cfg.mode === 'campaign' ? 'Операция ' + cfg.mission.id + ': ' + esc(cfg.mission.name) : 'Схватка'}</div>
      <h2 class="${won ? 'win' : 'lose'}">${won ? 'Победа' : res.winner < 0 ? 'Ничья' : cfg.mode === 'campaign' ? 'Поражение' : 'Бой окончен'}</h2>
      <p class="lead">${esc(res.text)}</p>${extra}
      <table class="res"><thead><tr><th>Боец</th><th>Убито</th><th>Урон</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="row">${buttons}</div></div>`);
    const on = (id, fn) => $('#' + id, this.scr)?.addEventListener('click', fn);
    on('next', () => { this.stopBattle(); const n = MISSIONS.find(x => x.id === cfg.mission.id + 1); n ? this.brief(n) : this.map(); });
    on('bar', () => { this.stopBattle(); this.barracks(); });
    on('again', () => this.startBattle(this.lastCfg));
    on('tomap', () => { this.stopBattle(); this.map(); });
    on('rematch', () => this.startSkirmish(this.lastSkirm));
    on('setup', () => { this.stopBattle(); this.skirmish(); });
  },

  /* ================= HUD ================= */
  bindHud() {
    this.hudEls = {
      teams: $('#hTeams'), timer: $('#hTimer'), round: $('#hRound'), card: $('#hCard'), wind: $('#hWindArrow'), windVal: $('#hWindVal'),
      wbtn: $('#hWeapon'), stam: $('#hStam'), power: $('#hPower'), jet: $('#hJet'), feed: $('#hFeed'), banner: $('#hBanner'),
      veh: $('#bVeh'), scope: $('#bScope'), fire: $('#bFire'), run: $('#bRun'),
    };
    $('#hWeapon').addEventListener('click', () => this.openInventory());
    $('#bPause').addEventListener('click', () => this.pause(true));
    $('#bCam').addEventListener('click', () => { const b = this.battle; if (b) b.camMode = b.camMode === 'top' ? null : 'top'; $('#bCam').classList.toggle('on', b?.camMode === 'top'); });
    $('#bScope').addEventListener('click', () => { if (this.battle) this.battle.input.scope = true; });
    $('#bVeh').addEventListener('click', () => { if (this.battle) this.battle.input.enter = true; });
    $('#bSkip').addEventListener('click', () => { const b = this.battle; if (b && b.state === 'turn' && b.isHuman(b.active.team)) { b.msg('Ход пропущен', 'info'); b.endTurn(); } });
    $('#bJump').addEventListener('pointerdown', e => { e.preventDefault(); const i = this.battle?.input; if (i) { i.jump = true; i.jumpHeld = true; } });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#bJump').addEventListener(ev, () => { const i = this.battle?.input; if (i) i.jumpHeld = false; });
    $('#bRun').addEventListener('click', () => { this.runToggle = !this.runToggle; $('#bRun').classList.toggle('on', this.runToggle); this.syncKeys(); });
    const fire = $('#bFire');
    fire.addEventListener('pointerdown', e => { e.preventDefault(); fire.setPointerCapture?.(e.pointerId); Sound.init(); const i = this.battle?.input; if (i) { i.firePressed = true; i.fire = true; } });
    const rel = () => { const i = this.battle?.input; if (i && i.fire) { i.fire = false; i.fireReleased = true; } };
    fire.addEventListener('pointerup', rel); fire.addEventListener('pointercancel', rel);
    for (const [id, d] of [['bUp', 1], ['bDown', -1]]) {
      const el = $('#' + id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); this.pitchBtn = d; this.syncKeys(); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { this.pitchBtn = 0; this.syncKeys(); });
    }
    $('#invClose').addEventListener('click', () => this.closeInventory());
    $('#inv').addEventListener('click', e => { if (e.target.id === 'inv') this.closeInventory(); });
    // джойстик
    const stick = $('#stick'), knob = $('#knob');
    let sp = null;
    stick.addEventListener('pointerdown', e => { e.preventDefault(); sp = { id: e.pointerId, x: e.clientX, y: e.clientY }; stick.setPointerCapture?.(e.pointerId); });
    stick.addEventListener('pointermove', e => {
      if (!sp || e.pointerId !== sp.id) return;
      let dx = e.clientX - sp.x, dy = e.clientY - sp.y; const r = 44, l = Math.hypot(dx, dy); if (l > r) { dx *= r / l; dy *= r / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const fx = dx / r, fy = -dy / r;
      this.stickFwd = Math.abs(fy) > 0.25 ? Math.sign(fy) * Math.min(1, (Math.abs(fy) - 0.25) / 0.6) : 0;
      this.stickTurn = Math.abs(fx) > 0.25 ? Math.sign(fx) * Math.min(1, (Math.abs(fx) - 0.25) / 0.6) : 0;
      this.stickRun = l >= r * 0.98 && fy > 0.8;
      this.syncKeys();
    });
    const end = () => { sp = null; knob.style.transform = ''; this.stickFwd = 0; this.stickTurn = 0; this.stickRun = false; this.syncKeys(); };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  },
  buildTeamsHud() {
    const b = this.battle;
    this.hudEls.teams.innerHTML = b.teams.map(t => `<div class="tm" data-t="${t.idx}" style="--c:${t.nation.css}"><span>${esc(t.nation.short)}${t.control === 'ai' ? ' · ИИ' : ''}</span><i></i></div>`).join('');
  },
  onTurn(h) {
    const b = this.battle, human = b.isHuman(h.team);
    const el = this.hudEls.banner;
    el.innerHTML = `<small style="color:${h.team.nation.css}">${esc(h.team.nation.name)}${human ? '' : ' · ход противника'}</small><b>${esc(h.name)}</b><em>${h.rank.name}</em>`;
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => { el.hidden = true; }, 2200);
    this.hud.classList.toggle('enemyTurn', !human);
    this.closeInventory();
    this.refreshWeapon();
  },
  refreshWeapon() {
    const b = this.battle; if (!b || !b.active) return;
    const h = b.active, w = b.currentWeapon();
    const id = h.vehicle ? h.vehicle.type : h.weapon;
    const n = h.vehicle ? INF : h.count(h.weapon);
    this.hudEls.wbtn.innerHTML = `${weaponIcon(id)}<span><b>${w ? esc(w.name) : 'Нет оружия'}</b><small>${h.vehicle ? 'техника · ' + h.vehicle.hp + ' HP' : n === INF ? 'без ограничений' : 'осталось ' + n}</small></span>`;
  },
  updateHud() {
    const b = this.battle, E = this.hudEls, h = b.active;
    const human = h && b.isHuman(h.team) && (b.state === 'turn' || b.state === 'retreat');
    this.hud.classList.toggle('locked', !human);
    // команды
    for (const t of b.teams) {
      const el = E.teams.querySelector(`[data-t="${t.idx}"]`); if (!el) continue;
      el.classList.toggle('cur', !!h && h.team === t && !b.over);
      const pips = t.hogs.map(o => `<b class="${o.alive ? '' : 'dead'} ${o === h ? 'act' : ''}" style="--f:${o.alive ? o.hp / o.maxHp : 0}"></b>`).join('');
      const i = el.querySelector('i'); if (i.innerHTML !== pips) i.innerHTML = pips;
    }
    const tsec = Math.max(0, Math.ceil(b.timer));
    E.timer.textContent = b.state === 'turn' || b.state === 'retreat' ? tsec : '·';
    E.timer.classList.toggle('low', (b.state === 'turn' || b.state === 'retreat') && tsec <= 10);
    E.round.textContent = b.round ? `Раунд ${b.round}` : '';
    if (h) {
      const st = [];
      if (h.status.poison) st.push('<span class="st poison">яд</span>');
      if (h.status.burn) st.push('<span class="st burn">горит</span>');
      if (h.status.sleep) st.push('<span class="st sleep">сон</span>');
      if (h.status.hidden) st.push('<span class="st hide">маскировка</span>');
      if (h.swim) st.push('<span class="st swim">плывёт</span>');
      const html = `<b style="color:${h.team.nation.css}">${esc(h.name)}</b><small>${h.rank.name}</small><span class="hp"><i style="width:${h.hp / h.maxHp * 100}%;background:${h.team.nation.css}"></i></span><em>${h.hp}/${h.maxHp}</em>${st.join('')}`;
      if (E.card.innerHTML !== html) E.card.innerHTML = html;
    }
    E.stam.style.width = (human ? b.stamina : 0) + '%';
    E.power.style.width = (b.power * 100) + '%';
    E.jet.parentElement.hidden = !(b.jetFuel > 0);
    E.jet.style.width = clamp(b.jetFuel / 5, 0, 1) * 100 + '%';
    // ветер
    const wl = b.wind.length();
    const rel = (b.camYaw ?? 0) - Math.atan2(b.wind.x, b.wind.z);
    E.wind.setAttribute('transform', `rotate(${(rel * 180 / Math.PI).toFixed(1)}) scale(${!b.cfg.wind || wl < 0.1 ? 0 : clamp(0.45 + wl / 10, 0.45, 1).toFixed(2)})`);
    E.windVal.textContent = b.cfg.wind ? Math.round(wl / 6 * 10) : '—';
    // контекстные кнопки
    const w = b.currentWeapon();
    E.scope.hidden = !(w && ['hitscan', 'burst', 'spread', 'healdart'].includes(w.kind) && !h?.vehicle);
    E.scope.classList.toggle('on', b.scope);
    const nearV = h && !h.vehicle && b.nearVehicle(h);
    E.veh.hidden = !(h && (h.vehicle || nearV));
    E.veh.textContent = h?.vehicle ? 'Выйти' : nearV ? `Сесть: ${nearV.name.toLowerCase()}` : '';
    E.fire.classList.toggle('charging', b.charging);
    E.fire.style.setProperty('--p', b.power);
    $('#scope').hidden = !b.scope;
    this.updateLabels();
  },
  updateLabels() {
    const b = this.battle, cam = b.camera, W = this.renderer.domElement.clientWidth, H = this.renderer.domElement.clientHeight;
    const v = new THREE.Vector3();
    const seen = new Set();
    for (const h of b.hogs) {
      let el = this.labelEls.get(h);
      if (!el) { el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = '<span></span><i><b></b></i><em></em>'; this.labels.appendChild(el); this.labelEls.set(h, el); el.querySelector('b').style.background = h.team.nation.css; }
      seen.add(el);
      const ownFollow = h === b.active && b.isHuman(h.team) && b.state === 'turn' && b.camMode !== 'top';
      const visible = h.alive && !b.scope && !ownFollow && !(h.status.hidden && h.team !== b.active?.team && !b.isHuman(h.team));
      if (!visible) { el.style.display = 'none'; continue; }
      const top = h.vehicle ? h.vehicle.pos.clone().setY(h.vehicle.pos.y + 3.4) : h.pos.clone().setY(h.pos.y + 2.25 * h.scale);
      v.copy(top).project(cam);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.transform = `translate(${((v.x + 1) / 2 * W).toFixed(1)}px,${((1 - v.y) / 2 * H).toFixed(1)}px) translate(-50%,-100%)`;
      const far = cam.position.distanceTo(top) > 38 && h !== b.active;
      const name = far ? `${h.hp}` : `${h.name} · ${h.hp}`;
      const sp = el.firstChild; if (sp.textContent !== name) sp.textContent = name;
      el.querySelector('b').style.width = (h.hp / h.maxHp * 100) + '%';
      const st = (h.status.poison ? 'яд ' : '') + (h.status.sleep ? 'сон ' : '') + (h.status.burn ? 'огонь ' : '') + (h.vehicle ? h.vehicle.name.toLowerCase() + ' ' + h.vehicle.hp : '');
      const em = el.lastChild; if (em.textContent !== st) em.textContent = st;
      el.classList.toggle('act', h === b.active);
    }
    // всплывающие числа
    let fi = 0;
    this.floatEls = this.floatEls || [];
    for (const f of b.floats) {
      let el = this.floatEls[fi++];
      if (!el) { el = document.createElement('div'); el.className = 'flt'; this.labels.appendChild(el); this.floatEls.push(el); }
      v.copy(f.pos).project(cam);
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.textContent = f.text; el.style.color = f.color; el.style.opacity = Math.min(1, f.t * 1.5);
      el.style.transform = `translate(${((v.x + 1) / 2 * W).toFixed(1)}px,${((1 - v.y) / 2 * H).toFixed(1)}px) translate(-50%,-50%)`;
    }
    for (let i = fi; i < this.floatEls.length; i++) this.floatEls[i].style.display = 'none';
  },
  pushFeed(text, kind) {
    const el = document.createElement('div'); el.className = 'fd ' + (kind || ''); el.textContent = text;
    this.hudEls.feed.prepend(el);
    while (this.hudEls.feed.children.length > 5) this.hudEls.feed.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, kind === 'tip' ? 7000 : 4200);
  },
  toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.hidden = true; }, 2500); },

  /* ---------- инвентарь ---------- */
  openInventory() {
    const b = this.battle; if (!b || !b.active || !b.isHuman(b.active.team) || b.state !== 'turn' || b.active.vehicle || b.charging) return;
    const h = b.active;
    const items = Object.keys(h.inv);
    const grid = CATS.map(([cat, name]) => {
      const list = items.filter(id => WEAPONS[id].cat === cat); if (!list.length) return '';
      return `<section><h4>${name}</h4><div class="igrid">${list.map(id => {
        const w = WEAPONS[id], n = h.count(id), stat = w.dmg ? `урон ${Math.round(w.kind === 'burst' ? w.dmg * w.shots : w.kind === 'spread' ? w.dmg * w.pellets : w.dmg)}` : w.heal ? `лечит ${w.heal}` : '';
        return `<button class="item ${id === h.weapon ? 'on' : ''}" data-w="${id}" ${n === INF || n > 0 ? '' : 'disabled'} title="${esc(w.desc)}">
          ${weaponIcon(id)}<b>${w.name}</b><small>${n === INF ? '∞' : '×' + n}${stat ? ' · ' + stat : ''}</small><p>${esc(w.desc)}</p></button>`;
      }).join('')}</div></section>`;
    }).join('');
    $('#invBody').innerHTML = grid;
    $('#invTitle').textContent = `Инвентарь: ${h.name}, ${h.rank.name.toLowerCase()}`;
    $$('#invBody .item').forEach(el => el.addEventListener('click', () => { b.selectWeapon(el.dataset.w); this.closeInventory(); }));
    $('#inv').hidden = false; b.paused = true;
  },
  closeInventory() { const inv = $('#inv'); if (inv.hidden) return; inv.hidden = true; if (this.battle) this.battle.paused = false; },

  /* ---------- ввод ---------- */
  keys: {},
  syncKeys() {
    const b = this.battle; if (!b) return;
    const k = this.keys, i = b.input;
    i.fwd = clamp((k.w ? 1 : 0) - (k.s ? 1 : 0) + (this.stickFwd || 0), -1, 1);
    i.turn = clamp((k.d || k.right ? 1 : 0) - (k.a || k.left ? 1 : 0) + (this.stickTurn || 0), -1, 1);
    i.run = !!(k.shift || this.runToggle || this.stickRun);
    i.pitch = (k.up ? 1 : 0) - (k.down ? 1 : 0) + (this.pitchBtn || 0);
  },
  bindInput() {
    const map = { KeyW: 'w', KeyS: 's', KeyA: 'a', KeyD: 'd', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ShiftLeft: 'shift', ShiftRight: 'shift' };
    window.addEventListener('keydown', e => {
      const b = this.battle;
      if (!b) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Escape') { if (!$('#inv').hidden) this.closeInventory(); else this.pause(!b.paused); e.preventDefault(); return; }
      if (b.paused && $('#inv').hidden) return;
      if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); if ($('#inv').hidden) this.openInventory(); else this.closeInventory(); return; }
      if (!$('#inv').hidden) return;
      if (map[e.code]) { this.keys[map[e.code]] = true; this.syncKeys(); e.preventDefault(); }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { Sound.init(); b.input.firePressed = true; b.input.fire = true; } }
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyJ') { e.preventDefault(); if (!e.repeat) b.input.jump = true; b.input.jumpHeld = true; }
      if (e.code === 'KeyF') b.input.enter = true;
      if (e.code === 'KeyV') b.input.scope = true;
      if (e.code === 'KeyC') $('#bCam').click();
      if (e.code === 'Backspace') $('#bSkip').click();
      if (/^Digit[1-9]$/.test(e.code) && b.active && b.isHuman(b.active.team) && !b.active.vehicle) {
        const ids = Object.keys(b.active.inv).filter(id => b.active.has(id)); const id = ids[+e.code.slice(5) - 1]; if (id) b.selectWeapon(id);
      }
    });
    window.addEventListener('keyup', e => {
      const b = this.battle; if (!b) return;
      if (map[e.code]) { this.keys[map[e.code]] = false; this.syncKeys(); }
      if (e.code === 'Space' && b.input.fire) { b.input.fire = false; b.input.fireReleased = true; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyJ') b.input.jumpHeld = false;
    });
    window.addEventListener('blur', () => { for (const k in this.keys) this.keys[k] = false; this.syncKeys(); if (this.battle?.input.fire) { this.battle.input.fire = false; this.battle.input.fireReleased = true; } });
    // перетаскивание по полю — наводка; короткое касание — выбор точки
    const cv = this.renderer.domElement;
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      if (!this.battle) return;
      Sound.init();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
      cv.setPointerCapture?.(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id || !this.battle) return;
      const i = this.battle.input;
      i.dragYaw += e.clientX - drag.x; i.dragPitch += e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const up = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy); drag = null;
      if (moved < 8 && this.battle) {
        const r = cv.getBoundingClientRect();
        this.battle.input.tap = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('wheel', e => { if (this.battle) { this.battle.input.dragPitch += e.deltaY * 0.15; e.preventDefault(); } }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  },
};
export { aimDir };
