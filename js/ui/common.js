// Shared UI helpers.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function fmtDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min${m === 0 ? ` ${s}s` : ''}`;
}
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
export function daysAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

let toastTimer;
export function toast(msg, ms = 1800) {
  $$('.toast').forEach(t => t.remove());
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// Bottom sheet. Returns close function. content = HTML string or element.
export function sheet(content, { onClose } = {}) {
  const ov = el(`<div class="overlay sheet"><div class="panel fade"></div></div>`);
  const panel = $('.panel', ov);
  if (typeof content === 'string') panel.innerHTML = content; else panel.appendChild(content);
  const close = () => { ov.remove(); onClose && onClose(); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
  return { close, panel };
}

export function confirmSheet(title, text, { okLabel = 'CONFIRM', danger = false } = {}) {
  return new Promise(res => {
    const s = sheet(`
      <div class="title sm">${esc(title)}</div>
      <p class="sub">${esc(text)}</p>
      <div class="btn-row mt">
        <button class="btn ghost" data-a="no">CANCEL</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(okLabel)}</button>
      </div>`, { onClose: () => res(false) });
    $('[data-a=no]', s.panel).onclick = () => { s.close(); };
    $('[data-a=yes]', s.panel).onclick = () => { s.panel.parentElement.remove(); res(true); };
  });
}

export function promptNumber(title, value, { min = 0, max = 999, step = 1 } = {}) {
  return new Promise(res => {
    const s = sheet(`
      <div class="title sm">${esc(title)}</div>
      <div class="field"><input type="number" inputmode="decimal" value="${value ?? ''}" min="${min}" max="${max}" step="${step}"></div>
      <div class="btn-row mt">
        <button class="btn ghost" data-a="no">CANCEL</button>
        <button class="btn primary" data-a="yes">OK</button>
      </div>`, { onClose: () => res(null) });
    const inp = $('input', s.panel);
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
    const ok = () => { const v = parseFloat(inp.value); s.panel.parentElement.remove(); res(isNaN(v) ? null : v); };
    $('[data-a=no]', s.panel).onclick = () => s.close();
    $('[data-a=yes]', s.panel).onclick = ok;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}

export const ICON_PLACEHOLDER = `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>`;

export function demoHTML(exercise, small = false) {
  const m = exercise.media;
  if (m && m.frames && m.frames.length) {
    return `<div class="demo ${small ? 'small' : ''}" data-demo="${exercise.id}">
      <img src="${m.frames[0]}" alt="" class="f0" loading="lazy" decoding="async">
      ${m.frames[1] ? `<img src="${m.frames[1]}" alt="" class="f1" loading="lazy" decoding="async">` : ''}
    </div>`;
  }
  return `<div class="demo ${small ? 'small' : ''}" data-demo="${exercise.id}"><div class="ph">${ICON_PLACEHOLDER}<span>${small ? 'NO DEMO' : 'NO DEMO · SEE CUES'}</span></div></div>`;
}

export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
}
let audioCtx;
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.value = 0.0001;
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.start(t); o.stop(t + 0.4);
  } catch (_) {}
}
export function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (_) {}
}
