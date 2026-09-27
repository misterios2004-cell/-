// Общие утилиты, звук, сохранения.
export const THREE = window.THREE;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hash(i) { let h = Math.imul(i ^ 0x9E3779B9, 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
export function makeNoise(r) {
  const P = new Float32Array(65536); for (let i = 0; i < P.length; i++) P[i] = r() * 2 - 1;
  const g = (i, j) => P[((j & 255) << 8) | (i & 255)];
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 4) => { let s = 0, amp = 1, f = 1, norm = 0; for (let o = 0; o < oct; o++) { s += n(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; } return s / norm * 1.6; };
}
export const fmt = (s, ...a) => { let i = 0; return s.replace(/%s/g, () => a[i++]); };

/* ---------------- настройки и сохранение ---------------- */
const SAVE_KEY = 'lisi-nory-save-v2', LEGACY_KEYS = ['svinyi-okopy-save-v2'];
export const DEFAULT_SETTINGS = { quality: 'auto', sfx: 0.8, music: 0.45, sens: 1, trajectory: false, wind: true, voice: false, turnTime: 45 };
export const Save = {
  data: null,
  load() {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      for (const k of LEGACY_KEYS) if (!raw && localStorage.getItem(k)) raw = localStorage.getItem(k); // перенос прогресса со старой версии
      const s = JSON.parse(raw); if (s && s.v === 2) { this.data = s; }
    } catch (e) { /* хранилище недоступно */ }
    if (!this.data) this.data = { v: 2, settings: { ...DEFAULT_SETTINGS }, campaign: null };
    this.data.settings = { ...DEFAULT_SETTINGS, ...this.data.settings };
    return this.data;
  },
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* без сохранения */ } },
};

/* ---------------- звук ---------------- */
export const Sound = {
  ctx: null, master: null, sfxGain: null, musicGain: null, musicOn: false, _musicTimer: null, _step: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor(); this.sfxGain.disconnect(); this.sfxGain.connect(comp); comp.connect(this.master);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    } catch (e) { this.ctx = null; }
  },
  apply() {
    if (!this.ctx) return;
    const s = Save.data.settings;
    this.sfxGain.gain.value = s.sfx; this.musicGain.gain.value = s.music * 0.5;
  },
  noise(dur, freq, vol, type = 'lowpass', decay = 2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    void decay;
  },
  tone(f1, f2, dur, type = 'square', vol = 0.1, delay = 0, out) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.sfxGain); o.start(t); o.stop(t + dur + 0.05);
  },
  play(name, k = 1) {
    if (!this.ctx) return;
    switch (name) {
      case 'boom': this.noise(0.5 + k * 0.5, 300 + k * 500, 0.9); this.tone(90, 30, 0.5 + k * 0.3, 'sine', 0.6); break;
      case 'smallboom': this.noise(0.35, 900, 0.5); this.tone(140, 50, 0.3, 'sine', 0.3); break;
      case 'shot': this.noise(0.12, 2400, 0.5, 'bandpass'); this.tone(300, 80, 0.08, 'square', 0.15); break;
      case 'sniper': this.noise(0.25, 1800, 0.7, 'bandpass'); this.tone(900, 60, 0.2, 'sawtooth', 0.12); break;
      case 'shotgun': this.noise(0.3, 1300, 0.8); break;
      case 'launch': this.noise(0.6, 700, 0.4, 'bandpass'); this.tone(200, 90, 0.4, 'sawtooth', 0.1); break;
      case 'mortar': this.tone(180, 60, 0.25, 'sine', 0.5); this.noise(0.2, 500, 0.4); break;
      case 'throw': this.noise(0.15, 1600, 0.2, 'highpass'); break;
      case 'bounce': this.tone(500, 300, 0.06, 'triangle', 0.12); break;
      case 'splash': this.noise(0.6, 1200, 0.5, 'bandpass'); this.tone(700, 200, 0.3, 'sine', 0.1); break;
      case 'swing': this.noise(0.18, 3000, 0.25, 'highpass'); break;
      case 'punch': this.tone(160, 60, 0.12, 'sine', 0.5); this.noise(0.1, 800, 0.4); break;
      case 'zap': for (let i = 0; i < 4; i++) this.tone(1200 + i * 300, 300, 0.06, 'sawtooth', 0.12, i * 0.05); break;
      case 'flame': this.noise(0.9, 500, 0.5, 'bandpass'); break;
      case 'heal': this.tone(392, 523, 0.5, 'sine', 0.08); this.noise(0.4, 3000, 0.05, 'highpass'); break;
      case 'pickup': this.noise(0.08, 2400, 0.25, 'bandpass'); this.noise(0.1, 1600, 0.2, 'bandpass'); this.tone(220, 180, 0.12, 'triangle', 0.06, 0.08); break;
      case 'medal': this.tone(880, 880, 0.9, 'sine', 0.06); this.tone(1318, 1318, 0.9, 'sine', 0.03, 0.02); this.noise(0.05, 5000, 0.12, 'highpass'); break;
      case 'beep': this.tone(1500, 1500, 0.07, 'square', 0.08); break;
      case 'jump': this.noise(0.12, 900, 0.12, 'bandpass'); break;
      case 'step': this.noise(0.05, 600, 0.06); break;
      case 'jet': this.noise(0.25, 900, 0.18, 'bandpass'); break;
      case 'engine': this.tone(55, 50, 0.3, 'sawtooth', 0.06); break;
      case 'turn': this.tone(196, 196, 0.25, 'triangle', 0.08); this.noise(0.05, 1800, 0.08, 'bandpass'); break;
      case 'tick': this.tone(1200, 1200, 0.03, 'sine', 0.05); break;
      case 'plane': this.tone(110, 95, 2.5, 'sawtooth', 0.05); this.tone(113, 97, 2.5, 'sawtooth', 0.05); break;
      case 'win': [[196, 0], [247, 0.35], [294, 0.7], [392, 1.05]].forEach(([f, d]) => this.tone(f, f, 2.2 - d, 'triangle', 0.07, d)); break;
      case 'lose': [[196, 0], [185, 0.5], [147, 1.0]].forEach(([f, d]) => this.tone(f, f * 0.97, 1.8 - d * 0.5, 'sawtooth', 0.04, d)); this.tone(49, 45, 2.5, 'sine', 0.15); break;
      case 'click': this.noise(0.03, 3000, 0.08, 'bandpass'); break;
      case 'yelp': this.yelp(k); break;
      case 'scream': this.yelp(1.6, true); break;
    }
  },
  // Голос лисы: короткий хриплый лай при ранении, протяжный крик при гибели.
  yelp(pitch = 1, scream = false) {
    if (!this.ctx) return;
    const base = (scream ? 820 : 560) * pitch * rnd(0.92, 1.08), n = scream ? 1 : 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = this.ctx.currentTime + i * 0.2, dur = scream ? 0.7 : 0.14;
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square';
      o.frequency.setValueAtTime(base * (scream ? 0.8 : 1.3), t);
      if (scream) { o.frequency.linearRampToValueAtTime(base * 1.35, t + 0.2); o.frequency.exponentialRampToValueAtTime(base * 0.55, t + dur); }
      else o.frequency.exponentialRampToValueAtTime(base * 0.6, t + dur);
      o2.frequency.value = base * 0.5; o2.detune.value = 12;
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.8;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(scream ? 0.14 : 0.16, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); o2.connect(f); f.connect(g).connect(this.sfxGain);
      o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
      this.noise(dur * 0.8, 2600, 0.12, 'bandpass'); // хрип
    }
  },
  // Процедурная музыка: тревожный пульс в миноре — бас-гул, томы, редкий мотив.
  startMusic(mood = 'march') {
    if (!this.ctx) return;
    this.stopMusic(); this.musicOn = true; this._step = 0; this.mood = mood;
    const bpm = mood === 'menu' ? 72 : 96, step = 60 / bpm / 2;
    const minor = [0, 2, 3, 5, 7, 8, 10, 12];
    const motif = mood === 'menu'
      ? [0, -1, -1, -1, 3, -1, 2, -1, 0, -1, -1, -1, -1, -1, -1, -1, 5, -1, 3, -1, 2, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1]
      : [0, -1, 0, -1, 3, -1, -1, 2, 0, -1, -1, -1, 5, -1, 3, -1, 0, -1, 0, -1, 7, -1, 5, 3, 2, -1, -1, -1, -1, -1, -1, -1];
    const bass = [0, 0, 5, 3];
    let next = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.musicOn) return;
      while (next < this.ctx.currentTime + 0.25) {
        const s = this._step % 32, t = next - this.ctx.currentTime;
        if (s % 8 === 0) { const b = bass[(this._step / 32 | 0) % 4]; const f = 55 * Math.pow(2, minor[b] / 12); this.tone(f, f, step * 7.5, 'sawtooth', 0.05, t, this.musicGain); this.tone(f / 2, f / 2, step * 7.5, 'sine', 0.12, t, this.musicGain); }
        if (mood !== 'menu' && (s % 4 === 0 || s % 16 === 14)) this._kick(t);
        if (mood !== 'menu' && s % 8 === 4) this._drum(t, 0.12);
        const m = motif[s];
        if (m >= 0) { const f = 220 * Math.pow(2, minor[m % 8] / 12); this.tone(f, f * 0.995, step * 1.8, 'triangle', 0.035, t, this.musicGain); }
        this._step++; next += step;
      }
      this._musicTimer = setTimeout(tick, 60);
    };
    tick();
  },
  _drum(delay, vol) {
    const t = this.ctx.currentTime + delay, src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(f).connect(g).connect(this.musicGain); src.start(t, Math.random()); src.stop(t + 0.15);
  },
  _kick(delay) { this.tone(90, 38, 0.3, 'sine', 0.3, delay, this.musicGain); },
  stopMusic() { this.musicOn = false; clearTimeout(this._musicTimer); },
};

/* ---------------- голос комментатора (если есть синтез речи) ---------------- */
export function say(text) {
  if (!Save.data.settings.voice || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; u.rate = 1.1; u.pitch = 0.8;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* нет синтеза */ }
}
