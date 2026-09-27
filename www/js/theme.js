// Единая конфигурация визуального стиля: интерфейс, шрифты, PBR-материалы, эффекты.
// Всё, что определяет «взрослый» мрачный тон игры, меняется здесь, а не по коду.

export const UI_THEME = {
  fonts: {
    // Google Fonts с кириллицей. Резервные гарнитуры — системные.
    href: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap',
    display: '"Oswald", "Arial Narrow", "Roboto Condensed", sans-serif',
    body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },
  // Графит, тёмная сталь и приглушённый янтарь — цвет лисьего меха.
  colors: {
    bg: '#0e1012', bg2: '#15181b', panel: 'rgba(16,18,21,.86)', panelSolid: '#171a1e',
    line: 'rgba(214,205,186,.14)', lineStrong: 'rgba(214,205,186,.32)',
    text: '#e4dfd4', muted: '#8e8a80', dim: '#5d5a54',
    accent: '#c47a34', accentHi: '#e0964a', accentInk: '#140d06',
    ok: '#7d9a62', warn: '#c9973c', danger: '#b8452f', info: '#6f94a8',
  },
};

// Предустановки PBR-материалов (MeshStandardMaterial). roughness/metalness по типу поверхности.
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
  marker: 0xc47a34,      // кольцо под активным бойцом
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
    '--display': f.display, '--body': f.body, '--mono': f.mono,
  };
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v);
}
