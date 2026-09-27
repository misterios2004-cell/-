// Точка входа: рендерер, цикл кадров, приложение.
import { THREE, Save } from './core.js';
import { initTextures } from './models.js';
import { UI } from './ui.js';

Save.load();
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const touch = matchMedia('(pointer: coarse)').matches;
const q = Save.data.settings.quality;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : touch ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  UI.resize(w, h);
}
addEventListener('resize', resize);

initTextures();
UI.init(renderer);
window.__ui = UI; // для автотестов
resize();
document.getElementById('boot').remove();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  UI.frame(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Нативная оболочка (Android): полноэкранный режим.
const Cap = window.Capacitor;
if (Cap?.isNativePlatform?.()) {
  try { Cap.registerPlugin('StatusBar').hide().catch(() => {}); } catch (e) { /* плагин недоступен */ }
}

// Офлайн-режим для установленного веб-приложения.
// <pwa>
if ('serviceWorker' in navigator && location.protocol === 'https:' && !Cap?.isNativePlatform?.()) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// </pwa>
