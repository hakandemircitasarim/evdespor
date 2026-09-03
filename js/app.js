// Uygulama kabuğu: hash router + alt navigasyon.
import * as store from './store.js';
import { $, el } from './ui/common.js';
import { renderToday } from './ui/today.js';
import { renderWorkout } from './ui/workout.js';
import { renderSummary } from './ui/summary.js';
import { renderProgram } from './ui/program.js';
import { renderProgress } from './ui/progress.js';
import { renderSettings } from './ui/settings.js';
import { renderLibrary } from './ui/library.js';
import { renderOnboarding } from './ui/onboarding.js';
import { renderHistory } from './ui/history.js';

store.load();

const NAV = [
  { id: 'today', label: 'BUGÜN', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>' },
  { id: 'program', label: 'PROGRAM', icon: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>' },
  { id: 'progress', label: 'GELİŞİM', icon: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 16l4-5 4 3 6-8"/></svg>' },
  { id: 'settings', label: 'AYARLAR', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>' },
];

const ROUTES = {
  today: renderToday,
  workout: renderWorkout,
  summary: renderSummary,
  program: renderProgram,
  progress: renderProgress,
  history: renderHistory,
  settings: renderSettings,
  library: renderLibrary,
  onboarding: renderOnboarding,
};
const NAV_PARENT = { library: 'program', history: 'progress' };

export function navigate(route) { location.hash = '#' + route; }

function parse() {
  const h = location.hash.replace(/^#/, '') || 'today';
  const [name, ...rest] = h.split('/');
  return { name, params: rest };
}

export function render() {
  const app = $('#app');
  const state = store.get();
  let { name, params } = parse();
  if (!state.settings.onboarded && name !== 'onboarding') { location.hash = '#onboarding'; return; }
  if (name === 'workout' && !state.activeSession) { location.hash = '#today'; return; }
  const fn = ROUTES[name] || renderToday;
  app.innerHTML = '';
  const hideNav = ['workout', 'summary', 'onboarding'].includes(name);
  const screen = el(`<main class="screen ${hideNav ? 'no-nav' : ''} fade"></main>`);
  app.appendChild(screen);
  fn(screen, params, state);
  if (!hideNav) {
    const active = NAV_PARENT[name] || name;
    const nav = el(`<nav class="bottom">${NAV.map(n => `<button data-nav="${n.id}" class="${n.id === active ? 'active' : ''}">${n.icon}<span>${n.label}</span></button>`).join('')}</nav>`);
    nav.addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (b) navigate(b.dataset.nav); });
    app.appendChild(nav);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();

// Ekranı antrenman sırasında açık tut (destekleyen cihazlarda).
let wakeLock = null;
async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return;
    if (store.get().activeSession && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!store.get().activeSession && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (_) { wakeLock = null; }
}
store.subscribe(requestWakeLock);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { wakeLock = null; requestWakeLock(); } });
requestWakeLock();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e)));
}
