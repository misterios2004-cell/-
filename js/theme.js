// Единая конфигурация визуального стиля: интерфейс, шрифты, PBR-материалы, эффекты.
// Всё, что определяет «взрослый» мрачный тон игры, меняется здесь, а не по коду.

export const UI_THEME = {
  fonts: {
    // Google Fonts с кириллицей. Резервные гарнитуры — системные.
    href: 'https://fonts.googleapis.com/css2?family=Forum&family=Oswald:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap',
    display: '"Oswald", "Arial Narrow", "Roboto Condensed", sans-serif',
    body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
    title: '"Forum", "Times New Roman", Georgia, serif', // заголовки в фэнтези-стиле (есть кириллица)
  },
  // Графит, тёмная сталь и золото — как в меню коллекционных RPG.
  colors: {
    bg: '#0e1012', bg2: '#15181b', panel: 'rgba(16,18,21,.86)', panelSolid: '#171a1e',
    line: 'rgba(214,205,186,.14)', lineStrong: 'rgba(214,205,186,.32)',
    text: '#e4dfd4', muted: '#8e8a80', dim: '#5d5a54',
    accent: '#c9a045', accentHi: '#e8c46a', accentInk: '#140f04',
    ok: '#7d9a62', warn: '#c9973c', danger: '#b8452f', info: '#6f94a8',
  },
};

// Предустановки PBR-материалов (MeshStandardMaterial). roughness/metalness по типу поверхности;
// env — сила отражений карты окружения (по умолчанию 0.3, чтобы местность не «выцветала»).
export const MATERIALS = {
  fur:      { roughness: 0.92, metalness: 0 },
  fabric:   { roughness: 0.95, metalness: 0 },
  leather:  { roughness: 0.7,  metalness: 0 },
  gear:     { roughness: 0.75, metalness: 0.05 },
  metal:    { roughness: 0.45, metalness: 0.65 },
  gunmetal: { roughness: 0.38, metalness: 0.8 },
  helmet:   { roughness: 0.62, metalness: 0.35 },
  wood:     { roughness: 0.85, metalness: 0 },
  stone:    { roughness: 0.96, metalness: 0 },
  concrete: { roughness: 0.97, metalness: 0 },
  foliage:  { roughness: 0.9,  metalness: 0 },
  terrain:  { roughness: 0.98, metalness: 0 },
  eye:      { roughness: 0.18, metalness: 0 },
  armor:    { roughness: 0.3,  metalness: 0.92, env: 1 },    // полированная сталь доспехов
  gold:     { roughness: 0.26, metalness: 1, env: 1.1 },     // окантовка, пряжки, гербы
  gem:      { roughness: 0.12, metalness: 0.2, env: 1 },     // светящиеся камни (эмиссия + ореол-спрайт)
  cloth:    { roughness: 0.82, metalness: 0, env: 0.5 },     // плащи и табарды
};

// Редкость героя (как в коллекционных RPG): зависит от ступени звания (RANKS.level 0–6).
// trim — металл окантовки, glow — свечение камней и рун, css — рамка портрета, stars — звёзды.
export const RARITY = [
  { id: 'common',    name: 'Обычный',     trim: 0x6a645c, glow: 0x9aa0a6, css: '#8d8f93', stars: 1 },
  { id: 'uncommon',  name: 'Необычный',   trim: 0x9a7444, glow: 0x46d46a, css: '#4fbf62', stars: 2 },
  { id: 'rare',      name: 'Редкий',      trim: 0xb8bec8, glow: 0x3a9aff, css: '#3f8fe8', stars: 3 },
  { id: 'epic',      name: 'Эпический',   trim: 0xc39a4c, glow: 0xb45cff, css: '#a45ae6', stars: 4 },
  { id: 'legendary', name: 'Легендарный', trim: 0xdcb04e, glow: 0xffae2e, css: '#e8a93a', stars: 5 },
  { id: 'mythic',    name: 'Мифический',  trim: 0xe0a060, glow: 0xff3a30, css: '#ff4b3a', stars: 6 },
  { id: 'mythic',    name: 'Мифический',  trim: 0xe0a060, glow: 0xff3a30, css: '#ff4b3a', stars: 6 },
];
export const rarityOf = level => RARITY[Math.max(0, Math.min(RARITY.length - 1, level | 0))];

// Геральдика фракций для доспехов героев: ткань (плащ, табард), подбой, сталь, тип шлема.
export const HERALDRY = {
  uk:  { cloth: 0x1c4a2c, cloth2: 0x0c2416, steel: 0x8c929a, helm: 'greathelm', plume: 0xb02a22 },
  fr:  { cloth: 0x1e3574, cloth2: 0x0c1838, steel: 0xa2a6ae, helm: 'crested',   plume: 0xd8d2c4 },
  de:  { cloth: 0x5e1618, cloth2: 0x1a1a1e, steel: 0x5a5e66, helm: 'sallet',    plume: 0x1a1a1e },
  us:  { cloth: 0x1a2a52, cloth2: 0x6e1a22, steel: 0x9ea2aa, helm: 'winged',    plume: 0xe8e4dc },
  ru:  { cloth: 0x741a16, cloth2: 0x2a1410, steel: 0x8e867a, helm: 'spangen',   plume: 0x3a2e26 },
  jp:  { cloth: 0x1e1616, cloth2: 0xa4301c, steel: 0x3a3438, helm: 'kabuto',    plume: 0xa4301c },
  ash: { cloth: 0x161318, cloth2: 0x3a0c0c, steel: 0x2a262c, helm: 'horned',    plume: 0xff3a1a },
};

// Цвета персонажа: рыжая лиса с тёмными «чулками» и белой грудкой, приглушённые тона.
export const FOX_PALETTE = {
  fur: 0x8a4a24, furDark: 0x5e3118, furLight: 0xd9cdb8, socks: 0x1e1814,
  nose: 0x0d0b0a, eye: 0xb88a2a, pupil: 0x0a0806, innerEar: 0x2a1c16,
  boots: 0x1a1612, belt: 0x2b241c, vest: 0x2a2d2a, pouch: 0x33352f,
};

// Визуальные эффекты: никаких звёздочек и мультяшных вспышек — дым, пыль, короткие вспышки.
export const VFX = {
  explosion: { flash: 0xffd9a0, fire: [0xd8762c, 0xa84a1c], smoke: 0x3a3836, smokeOpacity: 0.85, dirt: 0x2c241c, ring: 0xffe6c0, lightColor: 0xff9a50 },
  gas: 0x6f7f3a,
  heal: 0x8fc79a,        // мягкое свечение вместо искр
  tracer: 0xffd79a,
  healTracer: 0x9fd8a8,
  muzzle: 0xffd9a0,
  splash: 0xaebcc0,
  marker: 0xe8c46a,      // кольцо под активным бойцом
  target: 0xb8452f,      // кольцо авиаудара
  aimDot: 0xe0c49a, aimCharge: 0xd0642c,
  damageText: '#f0e6d8', healText: '#9fd8a8',
};

// Применяет токены интерфейса как CSS-переменные.
export function applyUiTheme(root = document.documentElement) {
  const c = UI_THEME.colors, f = UI_THEME.fonts;
  const map = {
    '--bg': c.bg, '--bg2': c.bg2, '--panel': c.panel, '--panel-solid': c.panelSolid, '--line': c.line, '--line-strong': c.lineStrong,
    '--text': c.text, '--muted': c.muted, '--dim': c.dim, '--accent': c.accent, '--accent-hi': c.accentHi, '--accent-ink': c.accentInk,
    '--ok': c.ok, '--warn': c.warn, '--danger': c.danger, '--info': c.info,
    '--display': f.display, '--body': f.body, '--mono': f.mono, '--title': f.title,
  };
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v);
}
